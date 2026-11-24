/**
 * 九规智能中枢 · 长期语义记忆
 *
 * 设计：
 * - 事实存储在 jg.sqlite 的 memories 表，按 user_id 隔离；支持 global / project / conversation 作用域。
 * - 写入时调用文本嵌入接口生成向量（DashScope 兼容端点，可用环境变量替换）；
 *   接口不可用时自动降级为字符 n-gram 词法相似度，不影响主流程。
 * - 每轮把与当前请求最相关的少量记忆注入上下文，并记录使用次数；不做“全量记忆塞提示词”。
 * - 模型可通过 memory_write / memory_search / memory_forget / memory_list 工具显式读写。
 */
import { createHash } from 'node:crypto'
import {
  upsertMemory,
  listMemories,
  listActiveMemories,
  listMemoryEmbeddings,
  setMemoryEmbedding,
  touchMemories,
  archiveMemory,
  supersedeMemory,
  getMemory,
  memoryCount,
} from './db.mjs'

const EMBED_ENDPOINT = (process.env.JG_MEMORY_EMBEDDING_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings').trim()
const EMBED_MODEL = (process.env.JG_MEMORY_EMBEDDING_MODEL || 'text-embedding-v4').trim()
const EMBED_KEY = (process.env.JG_MEMORY_EMBEDDING_KEY || process.env.DASHSCOPE_API_KEY || process.env.QWEN_IMAGE_API_KEY || '').trim()
const EMBED_TIMEOUT_MS = Math.min(60000, Math.max(3000, Number(process.env.JG_MEMORY_EMBEDDING_TIMEOUT_MS) || 20000))
const RECALL_LIMIT = 4
const MAX_INJECT_CHARS = 760

const queryCache = new Map()
const backfillAt = new Map()

function log(message) {
  if (process.env.JG_MEMORY_DEBUG) console.log(`[jg-memory] ${message}`)
}

export function memoryEmbeddingEnabled() {
  return Boolean(EMBED_KEY && EMBED_ENDPOINT && EMBED_MODEL)
}

async function embedTexts(texts = []) {
  if (!memoryEmbeddingEnabled() || !texts.length) return null
  const out = []
  for (let offset = 0; offset < texts.length; offset += 8) {
    const batch = texts.slice(offset, offset + 8)
    try {
      const res = await fetch(EMBED_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${EMBED_KEY}` },
        body: JSON.stringify({ model: EMBED_MODEL, input: batch, encoding_format: 'float' }),
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
      const rows = Array.isArray(data?.data) ? data.data : []
      for (let i = 0; i < batch.length; i += 1) {
        const row = rows.find((x) => Number(x.index) === i) || rows[i]
        const vec = Array.isArray(row?.embedding) ? row.embedding.map(Number) : null
        if (!vec || !vec.length) throw new Error('empty embedding')
        out.push(vec)
      }
    } catch (error) {
      log(`embedding failed: ${error?.message || error}`)
      return null
    }
  }
  return out
}

function cacheKey(text) {
  return createHash('sha1').update(String(text || '').slice(0, 500)).digest('hex')
}

async function embedQuery(text) {
  const key = cacheKey(text)
  const hit = queryCache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.vec
  const vecs = await embedTexts([String(text || '').slice(0, 500)])
  const vec = vecs?.[0] || null
  if (vec) {
    if (queryCache.size > 200) queryCache.clear()
    queryCache.set(key, { at: Date.now(), vec })
  }
  return vec
}

function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]) || 0
    const y = Number(b[i]) || 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function compactText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：""''（）()\[\]{}<>《》\-—…·,.!?;:'"()]/g, '')
}

function bigrams(text) {
  const s = compactText(text)
  const out = new Set()
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2))
  if (!out.size && s) out.add(s)
  return out
}

function lexicalScore(query, item) {
  const q = bigrams(query)
  const t = bigrams(`${item.text} ${(item.tags || []).join(' ')}`)
  if (!q.size || !t.size) return 0
  let overlap = 0
  for (const g of q) if (t.has(g)) overlap += 1
  const coverage = overlap / q.size
  const jaccard = overlap / (q.size + t.size - overlap)
  const exact = compactText(item.text).includes(compactText(query).slice(0, 12)) ? 0.15 : 0
  return Math.min(1, coverage * 0.6 + jaccard * 0.4 + exact)
}

function scopeAllowed(item, { projectId = '', conversationId = '' } = {}) {
  if (item.scope === 'project') return Boolean(projectId) && item.scopeRef === String(projectId)
  if (item.scope === 'conversation') return Boolean(conversationId) && item.scopeRef === String(conversationId)
  // 未提供项目/会话上下文时，不按作用域裁剪；提供上下文后，全局记忆仍对该上下文可见。
  return true
}

function recencyBoost(item) {
  const age = Date.now() - Number(item.updatedAt || 0)
  if (age < 3 * 24 * 3600 * 1000) return 0.04
  if (age < 14 * 24 * 3600 * 1000) return 0.02
  return 0
}

/**
 * 召回与当前请求相关的长期记忆；有向量走向量余弦，缺失时退回词法相似度。
 * 返回 [{ ...item, score }]，不做跨用户读取。
 */
export async function recallMemories({ userId, query = '', projectId = '', conversationId = '', includeAllScopes = false, limit = RECALL_LIMIT } = {}) {
  if (!userId) return []
  const all = listActiveMemories(userId, 600).filter((x) => includeAllScopes || scopeAllowed(x, { projectId, conversationId }))
  if (!all.length) return []
  const q = String(query || '').trim()
  const vectors = new Map(listMemoryEmbeddings(userId, 600).map((x) => [x.id, x.embedding]))
  const queryVec = q.length >= 2 ? await embedQuery(q) : null
  const scored = []
  for (const item of all) {
    let score = 0
    const memVec = vectors.get(item.id) || null
    if (queryVec && memVec) {
      score = cosine(queryVec, memVec) + lexicalScore(q, item) * 0.08 + recencyBoost(item)
    } else {
      score = lexicalScore(q, item) + recencyBoost(item)
    }
    if (item.pinned) score += 0.2
    scored.push({ ...item, score })
  }
  const threshold = queryVec ? 0.42 : 0.18
  const picked = scored
    .filter((x) => x.pinned || x.score >= threshold)
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
  const pinned = picked.filter((x) => x.pinned).slice(0, 2)
  const others = picked.filter((x) => !x.pinned).slice(0, Math.max(0, limit - pinned.length))
  const items = [...pinned, ...others].slice(0, limit)
  if (items.length) touchMemories(items.map((x) => x.id))
  return items
}

/**
 * 组装注入模型的长期记忆块。没有召回结果时仍返回一条使用规则，
 * 让模型知道 memory_* 工具存在并知道何时写入。
 */
export async function memoryContextForTurn({ user, text = '', projectId = '', conversationId = '', includeRules = true } = {}) {
  const rules = `长期记忆：系统会根据对话自动沉淀跨会话稳定的偏好、身份事实、长期约束与已定决策；当用户明确要求“记住”，或你从对话中识别出稳定偏好/背景/拍板结论时，也可调用 memory_write 补充（kind 选 preference/fact/decision/entity；不要保存一次性任务、临时上下文、密码/密钥等敏感信息）。用户问“你记得什么/我的偏好”或需要历史约束时，先调用 memory_search，不要凭空编造。${projectId ? '当前处于项目工作区：项目专属稳定信息用 scope=project，projectId 由当前会话上下文自动带入；不要写成 global。' : ''}`
  maybeBackfillEmbeddings(user?.id || '')
  try {
    const items = await recallMemories({ userId: user?.id || '', query: text, projectId, conversationId })
    if (!items.length) return includeRules ? rules : ''
    let budget = MAX_INJECT_CHARS
    const lines = []
    for (const item of items) {
      const label = { preference: '偏好', fact: '事实', decision: '决策', entity: '实体', task: '任务' }[item.kind] || '事实'
      const scope = item.scope === 'project' ? '项目' : item.scope === 'conversation' ? '本会话' : '全局'
      const body = String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, 170)
      const line = `- [${label}·${scope}] ${body}`
      if (line.length > budget) break
      budget -= line.length
      lines.push(line)
    }
    const header = '与本轮可能相关的长期记忆（仅作参考；与用户当前指令冲突时以当前指令为准；不要主动宣称“我记得”，除非用户询问）：'
    return `${includeRules ? `${rules}\n` : ''}${header}\n${lines.join('\n')}`
  } catch (error) {
    log(`recall failed: ${error?.message || error}`)
    return includeRules ? rules : ''
  }
}

/** 明确更替信号：只有出现这些表达才允许让旧记忆退出召回。 */
const MEMORY_CHANGE_RE = /(改为|改成|更换为|换成|替换成|替换为|改用|不再用|不再使用|以后不要|从现在开始|现在起|最新(?:口径|方案|版本))/
/** 强信号：用户明确要求长期记住，或声明以后/默认/不要再。 */
const STRONG_DIRECTIVE_RE = /(记住|记一下|记着|以后都|以后每次|每次都|长期(?:用|按|保持|坚持)|默认(?:用|按|走|是|采用)|不要再|别再|以后不要)/
/** 偏好信号：习惯、倾向、优先/统一口径、明确好恶。 */
const PREFERENCE_RE = /(我喜欢|我更喜欢|我习惯|我一般|我通常|我倾向于|优先(?:用|选|按|采用)|统一(?:用|按|采用|口径)|不要给我|别给我|我不喜欢|我不希望|希望以后|尽量(?:用|按|给我))/
/** 身份/单位事实：跨会话稳定的个人背景。 */
const IDENTITY_RE = /(我是|我在|我叫|我负责|我的岗位|我的职务|我们单位|我们集团|我们部门|我所在|我的团队)/
/** 已定决策：项目或个人已经拍板的选择。 */
const DECISION_RE = /(定了|确定|就按|就用|采用|选定|最终(?:用|定|采用)|统一口径|已经定|敲定|决定用)/
/** 项目指代：信息归属于当前工作区。 */
const PROJECT_REF_RE = /(本项目|当前项目|这个项目|该项目|我们这个|这套系统|本系统|工作区)/
/** 一次性/临时任务：自动记忆宁可漏记，也不把本轮操作保存成长期偏好。 */
const ONESHOT_RE = /(这次|本次|此次|今天|现在|先帮我|临时|马上|立刻|随便|帮我查一下|这一次|本次先|待会儿|等下|上一条消息|下一条消息)/
/** 明显的过程指令与联调内容，不属于跨会话稳定事实。 */
const PROCEDURAL_RE = /(第一步|第二步|第三步|完整输出\s*\d+\s*段|只写一行|不要再调用工具|SECTION-\d+|MAXTOK[_-]?\d*)/i
const AUTO_META_RE = /(长期记忆联调测试|自动记忆测试|记忆测试代号|测试记忆|测试代号|recall-e2e-test)/i
const SENSITIVE_RE = /(密码|口令|密钥|token|api[_ -]?key|身份证|银行卡|信用卡|验证码|手机号)/i

function autoMemoryExcluded(raw) {
  const text = String(raw || '')
  return SENSITIVE_RE.test(text) || ONESHOT_RE.test(text) || PROCEDURAL_RE.test(text) || AUTO_META_RE.test(text)
}

/** 清洗“记住：/请记一下，”这类指令前缀，只保留要长期记住的事实本身。 */
function cleanMemoryText(raw) {
  return String(raw || '')
    .replace(/^(?:请|麻烦|麻烦你|帮我)?\s*(?:记住|记一下|记着|记下来)[：:,，\s]*/i, '')
    .replace(/^(?:以后|以后都|以后每次|每次都|默认|统一|优先)\s*/, '')
    .replace(/[。！？\s]+$/g, '')
    .trim()
}

/** 从一句话里提炼可沉淀的候选；返回 [{ text, kind, scope, scopeRef, confidence, strong }]。 */
export function extractMemoryCandidates(text = '', { projectId = '' } = {}) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (raw.length < 6 || raw.length > 260 || autoMemoryExcluded(raw)) return []
  const strong = STRONG_DIRECTIVE_RE.test(raw)
  const preference = PREFERENCE_RE.test(raw)
  const identity = IDENTITY_RE.test(raw)
  const decision = DECISION_RE.test(raw) || MEMORY_CHANGE_RE.test(raw)
  if (!strong && !preference && !identity && !decision) return []

  const content = cleanMemoryText(raw)
  if (content.length < 4) return []

  let kind = 'fact'
  if (identity) kind = 'entity'
  else if (decision) kind = 'decision'
  else if (preference || strong) kind = 'preference'

  // 身份/个人背景强制全局；项目指代或项目内决策归项目；其余在项目内归项目、否则全局。
  const scope = identity ? 'global' : (projectId && (PROJECT_REF_RE.test(raw) || decision || preference)) ? 'project' : (projectId ? 'project' : 'global')
  const confidence = strong || decision ? 0.7 : 0.58

  return [{ text: content, kind, scope, scopeRef: scope === 'project' ? projectId : '', confidence, strong, replace: MEMORY_CHANGE_RE.test(raw) }]
}

/** 只合并高度重合的同义条目；相似但数值、方案或结论不同的内容仍分别保留。 */
function nearDuplicateText(a, b) {
  const left = compactText(a)
  const right = compactText(b)
  if (!left || !right) return false
  if (left === right) return true
  const minLength = Math.min(left.length, right.length)
  const maxLength = Math.max(left.length, right.length)
  if (minLength >= 8 && minLength / maxLength >= 0.7 && (left.includes(right) || right.includes(left))) return true
  if (minLength < 12) return false
  // 英文、数字和版本号是决策锚点；锚点不同，即使其余文字高度相似也不能合并。
  const anchors = (text) => (String(text).toLowerCase().match(/[a-z0-9]+(?:[._-][a-z0-9]+)*/g) || []).sort().join('|')
  if (anchors(left) !== anchors(right)) return false
  const leftGrams = bigrams(left)
  const rightGrams = bigrams(right)
  let overlap = 0
  for (const gram of leftGrams) if (rightGrams.has(gram)) overlap += 1
  if (overlap * 2 / (leftGrams.size + rightGrams.size) >= 0.84) return true
  // 同一内容仅调整语序时，bigram 会漏报；用字符集合补一层。
  const leftChars = new Set(left)
  const rightChars = new Set(right)
  let charOverlap = 0
  for (const char of leftChars) if (rightChars.has(char)) charOverlap += 1
  return charOverlap * 2 / (leftChars.size + rightChars.size) >= 0.9
}

function findAutoDuplicate(userId, candidate) {
  return listActiveMemories(userId, 600).find((item) => item.kind === candidate.kind
    && item.scope === candidate.scope
    && String(item.scopeRef || '') === String(candidate.scopeRef || '')
    && nearDuplicateText(item.text, candidate.text)) || null
}

function memoryTopicText(text) {
  return compactText(text)
    .replace(/[a-z0-9]+(?:[._-][a-z0-9]+)*/g, '')
    .replace(/改为|改成|更换为|换成|替换成|替换为|改用|不再用|不再使用|以后不要|从现在开始|现在起|优先使用|优先用|统一使用|统一用|采用|使用|作为|以后|记住/g, '')
}

function hasSharedNgram(left, right, size) {
  if (left.length < size || right.length < size) return false
  for (let i = 0; i <= left.length - size; i += 1) if (right.includes(left.slice(i, i + size))) return true
  return false
}

function sameMemoryTopic(a, b) {
  const left = memoryTopicText(a)
  const right = memoryTopicText(b)
  if (left.length < 2 || right.length < 2) return false
  if (left === right || hasSharedNgram(left, right, 4)) return true
  const leftGrams = bigrams(left)
  const rightGrams = bigrams(right)
  if (!leftGrams.size || !rightGrams.size) return false
  let overlap = 0
  for (const gram of leftGrams) if (rightGrams.has(gram)) overlap += 1
  const score = overlap * 2 / (leftGrams.size + rightGrams.size)
  return score >= 0.55 || (score >= 0.3 && hasSharedNgram(left, right, 3))
}

function findSupersessionTargets(userId, candidate) {
  if (!candidate.replace) return []
  return listActiveMemories(userId, 600).filter((item) => item.kind !== 'task'
    && item.scope === candidate.scope
    && String(item.scopeRef || '') === String(candidate.scopeRef || '')
    && sameMemoryTopic(item.text, candidate.text))
}

function applySupersession(userId, item, targets) {
  const supersededIds = []
  for (const target of targets) {
    if (target.id !== item?.id && supersedeMemory(userId, target.id, item?.id)) supersededIds.push(target.id)
  }
  return supersededIds
}

/** 单条写入并异步补向量；返回 item 或 null。 */
function persistCandidate(user, candidate, { conversationId = '', messageId = '', tags = ['auto-capture'] } = {}) {
  try {
    const supersessionTargets = findSupersessionTargets(user.id, candidate)
    const duplicate = candidate.replace ? null : findAutoDuplicate(user.id, candidate)
    if (duplicate) return duplicate
    const { item, created } = upsertMemory({
      userId: user.id,
      kind: candidate.kind,
      scope: candidate.scope,
      scopeRef: candidate.scopeRef,
      text: candidate.text,
      tags,
      confidence: candidate.confidence,
      sourceConversationId: conversationId,
      sourceMessageId: messageId,
    })
    if (created && item?.id) {
      embedTexts([item.text])
        .then((vecs) => { if (vecs?.[0]) setMemoryEmbedding(user.id, item.id, vecs[0], EMBED_MODEL) })
        .catch(() => {})
    }
    const supersededIds = applySupersession(user.id, item, supersessionTargets)
    return supersededIds.length ? { ...item, supersededIds } : item
  } catch (error) {
    log(`auto capture failed: ${error?.message || error}`)
    return null
  }
}

/**
 * 低成本自动捕获：从用户消息中识别稳定的偏好、身份事实与已定决策，
 * 规则提炼入库并异步补向量；不调用额外模型，不猜测一次性任务。
 */
export function autoCaptureMemory({ user, text = '', projectId = '', conversationId = '', messageId = '' } = {}) {
  if (!user?.id) return null
  const candidates = extractMemoryCandidates(text, { projectId })
  if (!candidates.length) return null
  return persistCandidate(user, candidates[0], { conversationId, messageId })
}

const MODEL_DISTILL_HINT_RE = /(以后|长期|默认|偏好|习惯|喜欢|不喜欢|倾向|统一|优先|决定|确定|定了|就按|选定|负责|岗位|职务|单位|集团|部门|团队|技术栈|口径|规范|约束|记住|不再|别再)/

/** 只有用户原话可能含稳定信息时才调用额外模型，避免普通问答白耗一次调用和提炼配额。 */
export function shouldAttemptMemoryDistill(text = '') {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  return raw.length >= 6 && raw.length <= 600 && !autoMemoryExcluded(raw) && MODEL_DISTILL_HINT_RE.test(raw)
}

/**
 * 一轮结束后的规则沉淀只采信用户原话。助手答复可能是在建议、复述或执行任务，
 * 不能反向当成用户已经确认的偏好；模型提炼时可把答复作为确认上下文。
 */
export function distillTurnMemory({ user, text = '', projectId = '', conversationId = '', messageId = '' } = {}) {
  if (!user?.id) return []
  const out = []
  for (const candidate of extractMemoryCandidates(text, { projectId })) {
    const item = persistCandidate(user, candidate, { conversationId, messageId })
    if (item) out.push(item)
  }
  return out
}

/** 模型候选在入库前走与规则提炼一致的临时内容过滤、作用域约束和保守去重。 */
export function distillModelMemory({ user, candidate = {}, projectId = '', conversationId = '', messageId = '', sourceText = '' } = {}) {
  if (!user?.id) return null
  const text = String(candidate?.text || '').replace(/\s+/g, ' ').trim()
  if (text.length < 4 || text.length > 120 || autoMemoryExcluded(text)) return null
  const kind = ['preference', 'fact', 'decision', 'entity'].includes(candidate?.kind) ? candidate.kind : 'fact'
  const scope = candidate?.scope === 'project' && projectId ? 'project' : 'global'
  return persistCandidate(user, {
    text,
    kind,
    scope,
    scopeRef: scope === 'project' ? projectId : '',
    confidence: 0.62,
    replace: candidate?.replace === true || MEMORY_CHANGE_RE.test(String(sourceText || '')),
  }, { conversationId, messageId, tags: ['auto-distill'] })
}

/** 工具入口：写入一条记忆；自动入口可启用保守同义去重，手动管理仍按原文更新。 */
export async function writeMemory({ user, args = {} } = {}) {
  const input = {
    userId: user?.id || '',
    kind: args.kind,
    scope: args.scope,
    scopeRef: args.scopeRef || (args.scope === 'project' ? args.projectId : '') || '',
    text: args.content || args.text,
    tags: args.tags,
    confidence: args.confidence,
    pinned: args.pinned,
    sourceConversationId: args.conversationId || '',
    sourceMessageId: args.messageId || '',
  }
  const candidate = {
    text: input.text,
    kind: ['preference', 'fact', 'decision', 'entity', 'task'].includes(args.kind) ? args.kind : 'fact',
    scope: args.scope === 'project' || args.scope === 'conversation' ? args.scope : 'global',
    scopeRef: input.scopeRef,
    replace: args.replace === true,
  }
  const supersessionTargets = findSupersessionTargets(user?.id || '', candidate)
  if (args.dedupe && !candidate.replace) {
    const duplicate = findAutoDuplicate(user?.id || '', candidate)
    if (duplicate) return { item: duplicate, created: false, deduplicated: true, embedded: duplicate.hasEmbedding, embeddingModel: duplicate.embeddingModel || '' }
  }
  const { item, created } = upsertMemory(input)
  let embedded = false
  let savedItem = item
  if (item?.id) {
    const vecs = await embedTexts([item.text])
    if (vecs?.[0]) {
      setMemoryEmbedding(user.id, item.id, vecs[0], EMBED_MODEL)
      embedded = true
      savedItem = getMemory(user.id, item.id)
    }
  }
  const supersededIds = applySupersession(user.id, savedItem, supersessionTargets)
  return { item: savedItem, created, embedded, embeddingModel: embedded ? EMBED_MODEL : '', supersededIds }
}

export async function searchMemory({ user, query = '', limit = 8, projectId = '', conversationId = '' } = {}) {
  const items = await recallMemories({
    userId: user?.id || '',
    query,
    projectId,
    conversationId,
    // 显式检索是用户主动查询自己的记忆库；未指定作用域时搜索全部本人记忆。
    // 自动注入仍走默认的作用域隔离，避免把其他项目记忆带入当前项目。
    includeAllScopes: !projectId && !conversationId,
    limit: Math.min(20, Math.max(1, Number(limit) || 8)),
  })
  return items.map((x) => ({ ...x, score: Number(x.score.toFixed(3)) }))
}

export function listMemoryItems({ user, query = '', limit = 100, projectId = '', conversationId = '' } = {}) {
  const all = listMemories({ userId: user?.id || '', q: query, limit: Number(limit) || 100 })
  if (!projectId && !conversationId) return all
  return all.filter((item) => scopeAllowed(item, { projectId, conversationId }))
}

export function forgetMemory({ user, id = '', query = '', projectId = '', conversationId = '' } = {}) {
  if (id) {
    const item = getMemory(user?.id, id)
    if (!item || !scopeAllowed(item, { projectId, conversationId })) return { archived: false, item: null }
    const archived = archiveMemory(user?.id, id)
    return { archived, item }
  }
  const q = String(query || '').trim()
  if (!q) return { archived: false, item: null }
  const candidates = listMemories({ userId: user?.id, q, limit: 20 }).filter((item) => scopeAllowed(item, { projectId, conversationId }))
  const best = candidates[0]
  if (!best) return { archived: false, item: null }
  const archived = archiveMemory(user?.id, best.id)
  return { archived, item: best }
}

export function memoryStats(user) {
  return { count: memoryCount(user?.id || ''), embeddingEnabled: memoryEmbeddingEnabled(), embeddingModel: EMBED_MODEL }
}

/** 每 10 分钟最多补一次历史记忆向量，避免每轮都打嵌入接口。 */
function maybeBackfillEmbeddings(userId) {
  if (!userId || !memoryEmbeddingEnabled()) return
  const last = backfillAt.get(userId) || 0
  if (Date.now() - last < 10 * 60 * 1000) return
  backfillAt.set(userId, Date.now())
  backfillMemoryEmbeddings(userId, 10).catch(() => {})
}

/** 为历史记忆补向量（每次最多 20 条，避免一次打爆接口）。 */
export async function backfillMemoryEmbeddings(userId, limit = 20) {
  if (!userId || !memoryEmbeddingEnabled()) return 0
  const missing = listMemoryEmbeddings(userId, 2000).filter((x) => !x.embedding).slice(0, limit)
  if (!missing.length) return 0
  const items = listActiveMemories(userId, 2000).filter((x) => missing.some((m) => m.id === x.id))
  const vecs = await embedTexts(items.map((x) => x.text))
  if (!vecs) return 0
  items.forEach((item, i) => { if (vecs[i]) setMemoryEmbedding(userId, item.id, vecs[i], EMBED_MODEL) })
  return items.length
}
