/**
 * 模型网关：只依赖全局 fetch，兼容 OpenAI Chat Completions 协议。
 * 配置优先级：请求自带 Key > 用户模型配置 > 环境变量。
 * 不在这里保存任何密钥明文到数据库或日志。
 */

/**
 * 轻量模型路由：能力优先，价格其次，且在不确定时保留用户配置。
 * - 图片请求：当前模型没有图片输入能力时，回退到声明了 text+image 的 deepseek-flash。
 * - 深度思索：固定使用 deepseek-reasoner。
 * - 快速问答：在质量下限足够时降级到最便宜的 flash。
 * - 检索任务：仅当用户配置了更贵的 pro 时，降到 chat；普通配置不动。
 * - Work 任务：保留用户配置，避免为省成本牺牲代码/文件任务质量。
 * - 其余任务保留用户配置的模型；分类结果只用于 trace 和预算观察。
 */
const MODEL_CAPABILITIES = {
  // costRank / qualityRank 是相对档位，不是账单价：1 最便宜/最基础，数字越大越贵、能力越强。
  'deepseek-flash': { images: true, label: 'DeepSeek-V4.1-Flash', costRank: 1, qualityRank: 1 },
  'deepseek-chat': { images: false, label: 'DeepSeek-Chat', costRank: 2, qualityRank: 2 },
  'deepseek-v4-pro': { images: false, label: 'DeepSeek-V4-Pro', costRank: 3, qualityRank: 3 },
  'deepseek-reasoner': { images: false, label: 'DeepSeek-Reasoner', costRank: 4, qualityRank: 4 },
}

const TASK_QUALITY_FLOOR = { quick: 1, retrieval: 2 }
const COST_ROUTE_TARGET = { quick: 'deepseek-flash', retrieval: 'deepseek-chat' }

function modelMeta(model) {
  return MODEL_CAPABILITIES[String(model || '').trim()] || null
}

export function modelSupportsImages(model) {
  return Boolean(modelMeta(model)?.images)
}

export function classifyTask(text, { mode = 'chat', projectId = '', images = [] } = {}) {
  const input = String(text || '')
  if (Array.isArray(images) && images.length) return 'vision'
  if (projectId || mode === 'work' || /代码|脚本|报错|调试|构建|测试|部署|接口|函数|文件|目录|写入|创建|修改|删除|命令|执行/i.test(input)) return 'work'
  if (/查询|搜索|检索|资料|公告|通知|资源|数据|通讯录/i.test(input)) return 'retrieval'
  if (input.length <= 48 && !/[?？]/i.test(input)) return 'quick'
  return 'chat'
}

export function routeModel({ baseModel = 'deepseek-flash', text = '', mode = 'chat', projectId = '', images = [], deepThink = false } = {}) {
  const base = String(baseModel || 'deepseek-flash').trim() || 'deepseek-flash'
  const taskClass = classifyTask(text, { mode, projectId, images })
  const hasImages = Array.isArray(images) && images.length > 0
  if (hasImages && (!modelSupportsImages(base) || (deepThink && !modelSupportsImages('deepseek-reasoner')))) {
    return { model: 'deepseek-flash', taskClass: 'vision', reason: 'image-capability-fallback', imageFallback: true }
  }
  if (deepThink) return { model: 'deepseek-reasoner', taskClass, reason: 'deep-think', imageFallback: false }

  const baseMeta = modelMeta(base)
  const target = COST_ROUTE_TARGET[taskClass]
  const targetMeta = modelMeta(target)
  if (baseMeta && targetMeta && target !== base) {
    const floor = TASK_QUALITY_FLOOR[taskClass] || 0
    if (targetMeta.qualityRank >= floor && targetMeta.costRank < baseMeta.costRank) {
      return {
        model: target,
        taskClass,
        reason: `${taskClass}-cost`,
        imageFallback: false,
      }
    }
  }
  return { model: base, taskClass, reason: 'configured-model', imageFallback: false }
}

export class ModelError extends Error {
  constructor(message, { code = 'MODEL_ERROR', status = 502, detail = '' } = {}) {
    super(message)
    this.name = 'ModelError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

function trimSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

export function resolveModelConfig({ userConfig = {}, request = {}, env = process.env } = {}) {
  const requestKey = String(request.ownApiKey || '').trim()
  const storedKey = String(userConfig.apiKey || '').trim()
  const envKey = String(env.JG_MODEL_API_KEY || env.DEEPSEEK_API_KEY || '').trim()
  const apiKey = requestKey || storedKey || envKey
  const requestBase = String(request.baseUrl || '').trim()
  const userBase = String(userConfig.baseUrl || userConfig.endpoint || '').trim()
  const envBase = String(env.JG_MODEL_BASE_URL || env.DEEPSEEK_BASE_URL || '').trim()
  const baseUrl = trimSlash(
    (requestBase.startsWith('http') ? requestBase : '')
    || envBase
    || (/^https?:\/\//i.test(userBase) && !/ai\.jg\.local/i.test(userBase) ? userBase : '')
    || 'https://api.deepseek.com',
  )
  const requestModel = String(request.modelName || '').trim()
  const userModel = String(userConfig.defaultModel || '').trim()
  // defaultModel 在界面上是展示名（可能含中文与空格），只有看起来像模型 ID 时才直接使用。
  const usableUserModel = /^[A-Za-z0-9._:\-/]+$/.test(userModel) ? userModel : ''
  const model = String(requestModel || usableUserModel || env.JG_MODEL_NAME || env.DEEPSEEK_MODEL || 'deepseek-flash').trim()
  const timeoutMs = Math.max(8000, Math.min(180000, Number(env.JG_MODEL_TIMEOUT_MS || 60000)))
  return { apiKey, baseUrl, model, timeoutMs, source: requestKey ? 'request' : storedKey ? 'user-config' : envKey ? 'env' : 'none' }
}

function endpointOf(baseUrl) {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`
  return `${baseUrl}/chat/completions`
}

function extractContent(payload) {
  const choice = payload && payload.choices && payload.choices[0]
  const message = choice && (choice.message || choice.delta)
  if (message && typeof message.content === 'string') return message.content
  if (Array.isArray(message?.content)) {
    return message.content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
  }
  return ''
}

export async function chatCompletion({ messages, model, apiKey, baseUrl, timeoutMs = 60000, temperature = 0.3 }) {
  if (!apiKey) {
    throw new ModelError('未配置模型密钥：请在启动环境设置 JG_MODEL_API_KEY，或在「设置 · 模型与密钥」保存个人 Key 后重试', {
      code: 'MODEL_KEY_MISSING',
      status: 503,
    })
  }
  if (!Array.isArray(messages) || !messages.length) {
    throw new ModelError('模型请求缺少消息', { code: 'MODEL_BAD_REQUEST', status: 400 })
  }
  const endpoint = endpointOf(baseUrl)
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timeout = error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    throw new ModelError(timeout ? `模型网关超时（${Math.round(timeoutMs / 1000)} 秒）` : `模型网关不可达：${error?.message || error}`, {
      code: timeout ? 'MODEL_TIMEOUT' : 'MODEL_UNREACHABLE',
      status: timeout ? 504 : 502,
      detail: endpoint,
    })
  }
  const rawText = await response.text()
  let payload = null
  try { payload = rawText ? JSON.parse(rawText) : null } catch { /* 保留原文用于错误提示 */ }
  if (!response.ok) {
    const upstream = payload?.error?.message || payload?.message || rawText.slice(0, 240)
    const code = response.status === 401 || response.status === 403 ? 'MODEL_AUTH_FAILED'
      : response.status === 429 ? 'MODEL_RATE_LIMITED'
        : response.status >= 500 ? 'MODEL_UPSTREAM_ERROR' : 'MODEL_BAD_REQUEST'
    throw new ModelError(`模型网关返回 ${response.status}${upstream ? `：${upstream}` : ''}`, {
      code,
      status: response.status === 401 || response.status === 403 ? 502 : response.status,
      detail: endpoint,
    })
  }
  const content = extractContent(payload).trim()
  if (!content) {
    throw new ModelError('模型返回了空内容', { code: 'MODEL_EMPTY', status: 502, detail: endpoint })
  }
  return {
    content,
    model: payload?.model || model,
    usage: payload?.usage || null,
    latencyMs: Date.now() - startedAt,
    upstreamStatus: response.status,
  }
}

/** 流式对话：逐段回调 onDelta，最终返回完整正文与 usage；不改变调用方的用量口径。 */
export async function chatCompletionStream({ messages, model, apiKey, baseUrl, timeoutMs = 60000, temperature = 0.3, onDelta = null }) {
  if (!apiKey) {
    throw new ModelError('未配置模型密钥：请在启动环境设置 JG_MODEL_API_KEY，或在「设置 · 模型与密钥」保存个人 Key 后重试', {
      code: 'MODEL_KEY_MISSING',
      status: 503,
    })
  }
  if (!Array.isArray(messages) || !messages.length) {
    throw new ModelError('模型请求缺少消息', { code: 'MODEL_BAD_REQUEST', status: 400 })
  }
  const endpoint = endpointOf(baseUrl)
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timeout = error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    throw new ModelError(timeout ? `模型网关超时（${Math.round(timeoutMs / 1000)} 秒）` : `模型网关不可达：${error?.message || error}`, {
      code: timeout ? 'MODEL_TIMEOUT' : 'MODEL_UNREACHABLE',
      status: timeout ? 504 : 502,
      detail: endpoint,
    })
  }
  if (!response.ok) {
    const rawText = await response.text().catch(() => '')
    let payload = null
    try { payload = rawText ? JSON.parse(rawText) : null } catch { /* 保留原文用于错误提示 */ }
    const upstream = payload?.error?.message || payload?.message || rawText.slice(0, 240)
    const code = response.status === 401 || response.status === 403 ? 'MODEL_AUTH_FAILED'
      : response.status === 429 ? 'MODEL_RATE_LIMITED'
        : response.status >= 500 ? 'MODEL_UPSTREAM_ERROR' : 'MODEL_BAD_REQUEST'
    throw new ModelError(`模型网关返回 ${response.status}${upstream ? `：${upstream}` : ''}`, {
      code,
      status: response.status === 401 || response.status === 403 ? 502 : response.status,
      detail: endpoint,
    })
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let usage = null
  let resolvedModel = model
  let firstDeltaMs = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      const lines = part.split('\n')
      const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())
      if (!dataLines.length) continue
      const data = dataLines.join('')
      if (data === '[DONE]') continue
      let chunk = null
      try { chunk = JSON.parse(data) } catch { continue }
      if (chunk?.model) resolvedModel = chunk.model
      if (chunk?.usage) usage = chunk.usage
      const delta = extractContent(chunk)
      if (delta) {
        if (firstDeltaMs === null) firstDeltaMs = Date.now() - startedAt
        content += delta
        if (typeof onDelta === 'function') onDelta(delta)
      }
    }
  }
  const text = content.trim()
  if (!text) {
    throw new ModelError('模型返回了空内容', { code: 'MODEL_EMPTY', status: 502, detail: endpoint })
  }
  return {
    content: text,
    model: resolvedModel,
    usage,
    latencyMs: Date.now() - startedAt,
    firstDeltaMs,
    upstreamStatus: response.status,
  }
}
