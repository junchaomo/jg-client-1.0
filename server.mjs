/**
 * 九规智能中枢 企业版中枢 — 演示 API + 本地持久化底座
 * 用 Node 原生 http 提供静态资源与 API；服务端做角色、网络与会话判定，前端隐藏不是唯一防线。
 * 1.0 阶段使用 node:sqlite 做单机持久化，不改变任何页面与接口契约。
 */
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, normalize, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SESSION_TTL_MS, appendAudit, appendApprovalDecision, auditCount, backupNow, cleanupSessions, clearAudit, clearSessions, closeStore, createSession,
  dataDirPath, deleteSession, expirePendingApprovalDecisions, getAccount, getAccountByRole, getAccountByUsername, getFile, getSession, latestApprovalDecisions, latestAudit,
  listAccounts, listFiles, loadState, putFile, readFileBuffer, saveState, touchSession,
  updateAccountSecret, updateApprovalDecision, updateSessionNet, upsertAccount, setAccountPassword, setAccountUsername,
  attachVisualMessage, createVisualArtifact, getVisualArtifact, listVisualArtifacts, listVisualVersions,
  saveVisualArtifact, updateVisualArtifact, restoreVisualVersion,
} from './db.mjs'
import { normalizeVisualInput, parseStoredVisual, VISUAL_TYPE_LABELS, visualError } from './visuals.mjs'
import { describeToolCall, summarizeToolCall } from './approval-rules.mjs'
import {
  academy, academyStats, accessAnomalies, aiTools,
  apps, auditSeed, automations, cloudCredentials, cloudPolicy, cloudSessions,
  cloudSpaces, cloudSystems, contacts, dataServices, driveItems, driveQuota, feedback, imageryCompare, imThreads,
  knowledgeDocs, messagesSeed, modelPolicy, modules,
  monitor, networks, networkOrder, notices, notifications, orgMembers, orgUnits, projects,
  quickPrompts, resourceGrantSeed, resourceVersionSeed, resources,
  roles, sampleConversations, satelliteQuarters, spatialBounds, tasks, tickets, toolLedger, duties, dutyCatalog,
  notebookSeed, notebookTopics, collabCommentSeed,
} from './data.mjs'
import { buildDocument, supportedFormats } from './docs.mjs'
import { extractText as extractPdfText, inspectPdf, mergePdfs, splitPdf } from './pdf.mjs'
import { inspectSpatial } from './geo.mjs'
import { FORMAT_REGISTRY, detectDataFormat, exportDataFormat, extractDataFormat, inspectDataFormat } from './formats.mjs'
import { checkProjectDeliverables } from './deliverable-check.mjs'
import { inspectGeoFiles } from './gis-datasets.mjs'
import { HARNESS_BASE_SERVICES, runHarnessService } from './harness-services.mjs'
import { ModelError, chatCompletion, resolveModelConfig, routeModel } from './model.mjs'
import { prepareSpeech, modelStatus, transcribeSpeech } from './speech.mjs'
import { pinyin } from 'pinyin-pro'
import { HarnessError, cancelRun, closeHarness, closeHarnessForHome, dshBin, runAgent, stopBackgroundRuntime } from './harness.mjs'
import { extractBundlePackage, extractSkillPackage, inspectPluginZip } from './plugin-scan.mjs'
import { buildRunStats, buildSessionLogArchive, listTraces, newTraceId as makeTraceId, readTrace, writeTrace } from './trace.mjs'
import { execTerminal, resetTerminal, terminalStatus } from './terminal.mjs'
import { consoleRoles, consoleNav, consoleModules, consoleSections, consoleScopeOptions } from './console.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const publicDir = join(root, 'public')
function packageVersionAt(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')).version || 'unknown'
  } catch {
    return 'unknown'
  }
}
const productVersion = packageVersionAt(join(root, 'package.json'))
const electronVersion = packageVersionAt(join(root, 'node_modules', 'electron', 'package.json'))
const frontendVersion = (() => {
  try {
    const html = readFileSync(join(publicDir, 'index.html'), 'utf8')
    return (html.match(/app\.js\?v=(\d+)/) || [])[1] || 'unknown'
  } catch {
    return 'unknown'
  }
})()

// 本地 MCP 桥使用进程内随机令牌，只允许本机 Harness 子进程调用产品工具。
if (!process.env.JG_MCP_TOKEN) process.env.JG_MCP_TOKEN = randomBytes(24).toString('hex')
if (!process.env.JG_MCP_ACCOUNT) process.env.JG_MCP_ACCOUNT = 'A-7788-01'
const port = Number(process.env.PORT || 4173)
// 运维/回归可用一个统一上限覆盖默认预算；不设置时按会话类型分配。
const forcedMaxToolCalls = Number(process.env.JG_MAX_TOOL_CALLS || 0) > 0 ? Number(process.env.JG_MAX_TOOL_CALLS) : 0
const downloadSecret = process.env.JG_DOWNLOAD_SECRET || randomBytes(32).toString('hex')
const UPLOAD_LIMIT_BYTES = Math.max(1024 * 1024, Number(process.env.JG_UPLOAD_LIMIT_MB || 200) * 1024 * 1024)
// 真实文生图：默认走互联网外部生图服务；政务网/涉密网不启用，避免把提示词外发。
const IMAGE_GENERATION = {
  provider: process.env.JG_IMAGE_PROVIDER || 'Pollinations',
  model: process.env.JG_IMAGE_MODEL || 'flux',
  endpoint: process.env.JG_IMAGE_ENDPOINT || 'https://image.pollinations.ai/prompt',
  timeoutMs: Math.max(10_000, Number(process.env.JG_IMAGE_TIMEOUT_MS || 90_000)),
}
const IMAGE_RATIOS = {
  '1:1': [1024, 1024],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '4:5': [800, 1000],
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '3:2': [1080, 720],
}
const IMAGE_STYLE_PROMPTS = {
  写实: 'photorealistic, natural light, high detail',
  线稿: 'clean architectural line drawing, black ink lines on white paper',
  水墨: 'Chinese ink wash painting, monochrome, poetic composition',
  效果图: 'architectural visualization, realistic render, professional lighting',
  模型: 'white architectural concept model, soft studio lighting',
  影像: 'aerial imagery, realistic urban texture, survey photography',
  室内: 'interior design photography, warm natural light',
  封面: 'magazine cover composition, clean negative space for typography',
}
function normalizeImagePrompt(raw) {
  let text = String(raw || '').trim()
  text = text
    .replace(/^(请|麻烦|帮我|帮忙|给我|为我|能否|可以)?\s*(生成|画|绘制|制作|做|设计|创作|来|出)\s*(一张|一幅|一个|几张|一组)?\s*/i, '')
    .replace(/^(一张|一幅|一个|一组)\s*/i, '')
    .replace(/(图片|图像|照片|图)$/i, '')
    .replace(/[，。！？!?；;]+$/g, '')
    .trim()
  return text || String(raw || '').trim()
}
async function translateImagePrompt(user, text) {
  if (!/[\u4e00-\u9fff]/.test(text)) return text
  try {
    const cfg = resolveModelConfig({ userConfig: liveModelConfig.get(user.id) || {}, request: {} })
    if (cfg.source === 'none') return ''
    const result = await chatCompletion({
      model: cfg.model,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      timeoutMs: Math.min(cfg.timeoutMs, 15_000),
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'Translate the user image request into one concise English text-to-image prompt. Preserve subject, counts, colors, style, composition and any text requested. Do not add new subjects. Output only the English prompt, no quotes, no explanation.',
        },
        { role: 'user', content: text },
      ],
    })
    const english = String(result.content || '').replace(/^["“']|["”']$/g, '').replace(/\s+/g, ' ').trim()
    return /[A-Za-z]/.test(english) ? english.slice(0, 700) : ''
  } catch {
    return ''
  }
}
function imageGenerationStatus(user, net) {
  const enabled = net === 'inet' && user.id !== 'guest'
  return {
    enabled,
    provider: IMAGE_GENERATION.provider,
    model: IMAGE_GENERATION.model,
    external: true,
    reason: enabled
      ? '提示词会发送到外部文本翻译与公共生图服务；政务网与涉密网不启用'
      : net !== 'inet'
        ? `当前为${networks[net]?.label || net}，外部生图服务不启用`
        : '外部访客不能调用外部生图服务',
  }
}

function newVisualId() {
  return `VIS-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
}

function visualPublic(visual) {
  const item = parseStoredVisual(visual)
  if (!item) return null
  return {
    ...item,
    typeLabel: VISUAL_TYPE_LABELS[item.type] || item.type,
  }
}

function visualRef(visual) {
  const item = parseStoredVisual(visual)
  if (!item) return null
  return {
    id: item.id,
    sessionId: item.sessionId,
    type: item.type,
    typeLabel: VISUAL_TYPE_LABELS[item.type] || item.type,
    title: item.title,
    version: item.version,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function visualContextForModel(user, conversationId) {
  if (!conversationId) return ''
  const items = listVisualArtifacts({ sessionId: conversationId, owner: user.id, limit: 20 })
  if (!items.length) return ''
  return [
    '当前会话已有可视化对象（修改时优先使用 visual_update，保留用户未要求修改的节点与数据；不要重复创建）：',
    ...items.map((v) => `- ${v.id} · ${VISUAL_TYPE_LABELS[v.type] || v.type} · ${v.title} · v${v.version} · ${v.status === 'saved' ? '长期成果' : '会话临时'}`),
  ].join('\n')
}

function assertVisualOwner(visual, user) {
  if (!visual) throw visualError('可视化对象不存在', 'VISUAL_NOT_FOUND')
  if (String(visual.owner || '') !== String(user.id || '')) throw visualError('无权访问该可视化对象', 'VISUAL_FORBIDDEN')
  return visual
}

function invokeVisualTool(name, args, user, sessionId = '') {
  if (name === 'visual_create') {
    const normalized = normalizeVisualInput(args)
    let sid = String(args.sessionId || sessionId || '')
    if (sid) {
      const conv = conversations.find((c) => c.id === sid)
      if (!conv || !conversationAllowed(user, conv)) throw visualError('当前会话不可用，不能创建可视化', 'VISUAL_SESSION_FORBIDDEN')
    }
    const visual = createVisualArtifact({
      id: newVisualId(),
      sessionId: sid,
      type: normalized.type,
      title: normalized.title,
      source: normalized.source,
      caption: normalized.caption,
      owner: user.id,
      status: 'temporary',
    })
    return { visual: visualPublic(visual) }
  }
  const id = String(args.id || '').trim()
  if (!id) throw visualError('缺少可视化对象 id', 'VISUAL_ID_REQUIRED')
  const current = assertVisualOwner(getVisualArtifact(id), user)
  if (name === 'visual_get') {
    return { visual: visualPublic(current), versions: listVisualVersions(id).map((v) => ({ version: v.version, title: v.title, note: v.note, createdAt: v.createdAt })) }
  }
  if (name === 'visual_update') {
    const nextType = String(args.type || current.type)
    let nextSource = args.source
    if ((nextType === 'echarts' || nextType === 'interactive') && args.config !== undefined) nextSource = args.config
    if (nextSource === undefined) nextSource = current.source
    const normalized = normalizeVisualInput({
      type: nextType,
      title: args.title || current.title,
      source: nextSource,
      config: args.config,
      caption: args.caption == null ? current.caption : args.caption,
    })
    const visual = updateVisualArtifact(id, {
      type: normalized.type,
      title: normalized.title,
      source: normalized.source,
      caption: normalized.caption,
    }, user.id, String(args.changeNote || args.note || 'AI 修改'))
    return { visual: visualPublic(visual), previousVersion: current.version }
  }
  if (name === 'visual_export') {
    const format = String(args.format || 'svg').toLowerCase()
    if (!['svg', 'png'].includes(format)) throw visualError('导出格式只能是 svg 或 png', 'VISUAL_EXPORT_FORMAT')
    return {
      visual: visualRef(current),
      format,
      filename: `${String(current.title || 'visual').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)}.${format}`,
      note: '导出由前端使用浏览器内实际渲染结果生成，不依赖外部服务。',
    }
  }
  if (name === 'visual_save') {
    const visual = saveVisualArtifact(id, { title: String(args.name || args.title || current.title).slice(0, 120), actor: user.id })
    return { visual: visualPublic(visual), saved: true }
  }
  throw visualError(`未知可视化工具：${name}`, 'VISUAL_TOOL_UNKNOWN')
}

/** 从消息里只保留引用，完整源码由 /api/visuals 或 /api/conversation 从资源表恢复。 */
function hydrateConversationVisuals(conv) {
  if (!conv || !Array.isArray(conv.messages)) return conv
  for (const message of conv.messages) {
    if (!Array.isArray(message?.visuals) || !message.visuals.length) continue
    message.visuals = message.visuals
      .map((ref) => visualRef(getVisualArtifact(typeof ref === 'string' ? ref : ref?.id)) || ref)
      .filter(Boolean)
  }
  return conv
}

/**
 * 兜底：模型没有调用 visual_create、而是把 Mermaid/ECharts/SVG 围栏代码写进回答时，
 * 仍把可安全渲染的部分转成可视化对象，并从正文移除源码，避免用户看到代码块。
 */
function visualsFromReply(reply, user, sessionId) {
  const text = String(reply || '')
  const pattern = /```(mermaid|echarts|svg)\s*\n([\s\S]*?)```/gi
  const visuals = []
  let count = 0
  const cleaned = text.replace(pattern, (whole, type, body) => {
    if (count >= 5) return whole
    try {
      const normalized = normalizeVisualInput({ type: type.toLowerCase(), title: `${VISUAL_TYPE_LABELS[type.toLowerCase()] || type} ${count + 1}`, source: type.toLowerCase() === 'echarts' ? body : body })
      const visual = createVisualArtifact({
        id: newVisualId(),
        sessionId,
        type: normalized.type,
        title: normalized.title,
        source: normalized.source,
        caption: '',
        owner: user.id,
        status: 'temporary',
      })
      visuals.push(visual)
      count += 1
      return ''
    } catch {
      return whole
    }
  })
  return { text: cleaned, visuals }
}



const audit = [...auditSeed]
const readNotifications = new Map()  // 各账号分别记录已读，避免串号
const liveResources = [...resources]
const liveDataServices = [...dataServices]

/** 演示数据：总数补齐到 235 项，并覆盖全部业务分类；每类按季度分布，便于概览统计 */
function bulkSampleResources() {
  const configs = [
    { category: '规划', owner: '规划一所', uploader: '赵工', type: 'document', formats: ['PDF', 'DOCX'], add: 18, titles: ['控制性详细规划成果', '国土空间专项规划', '村庄规划编制成果', '规划条件核实资料'] },
    { category: '建筑', owner: '建筑设计所', uploader: '钱工', type: 'cad', formats: ['DWG', 'PDF'], add: 20, titles: ['建筑方案设计成果', '施工图设计文件', '建筑立面整治方案', '消防设计审查资料'] },
    { category: '市政', owner: '市政设计所', uploader: '钱工', type: 'cad', formats: ['DWG', 'PDF'], add: 20, titles: ['市政道路施工图', '排水管网设计成果', '综合管线迁改方案', '道路照明设计文件'] },
    { category: '风景园林', owner: '风景园林所', uploader: '赵工', type: 'document', formats: ['PDF', 'JPG'], add: 20, titles: ['公园景观方案', '绿地系统规划', '滨水空间设计成果', '苗木配置清单'] },
    { category: '测绘', owner: '测绘地理信息中心', uploader: '陈工', type: 'gis', formats: ['SHP', 'GeoJSON', 'TIFF'], add: 17, titles: ['1:500 地形图', '遥感影像成果', '地下管线探测成果', '实景三维模型'] },
    { category: '企业经营管理', owner: '综合办公室', uploader: '钱工', type: 'document', formats: ['PDF', 'XLSX'], add: 19, titles: ['综合办公台账', '会议纪要汇编', '年度工作计划', '制度文件汇编'] },
    { category: '企业经营管理', owner: '经营管理部', uploader: '周敏', type: 'bizdata', formats: ['接口', '表格'], add: 19, titles: ['项目经营月报', '合同履约台账', '市场拓展分析', '客户服务记录'] },
    { category: '企业经营管理', owner: '财务部', uploader: '钱工', type: 'document', formats: ['XLSX', 'PDF'], add: 20, titles: ['年度预算执行表', '项目成本核算表', '财务决算报告', '资金计划台账'] },
    { category: '总工办', owner: '总工办', uploader: '钱工', type: 'document', formats: ['PDF', 'DOCX'], add: 20, titles: ['技术审查意见', '设计质量抽查记录', '专业技术标准', '项目技术交底'] },
    { category: '企业经营管理', owner: '监察部', uploader: '钱工', type: 'document', formats: ['PDF', 'XLSX'], add: 20, titles: ['专项检查报告', '廉政风险排查表', '整改落实情况', '监督检查记录'] },
    { category: '企业经营管理', owner: '董事会办公室', uploader: '钱工', type: 'document', formats: ['PDF'], add: 20, titles: ['董事会决议汇编', '经营分析报告', '重大事项议案', '年度工作报告'] },
    { category: '其他', owner: '图文中心', uploader: '孙工', type: 'bizdata', formats: ['表格', '接口'], add: 15, titles: ['图文制作台账', '共享资料目录', '外部合作资料', '综合统计报表'] },
  ]
  const sizes = ['12.4 MB', '86 MB', '1.2 GB', '340 MB', '4.6 MB', '520 MB', '28 MB']
  const out = []
  let seq = 0
  configs.forEach((cfg, ci) => {
    for (let i = 0; i < cfg.add; i += 1) {
      seq += 1
      const q = (ci + i) % 4
      const month = q === 0 ? 1 + (i % 3) : q === 1 ? 4 + (i % 3) : q === 2 ? 7 + (i % 3) : 10 + (i % 2)
      let day = 2 + ((seq * 3) % 24)
      if (month === 11 && day > 7) day = 1 + (seq % 7)
      const hour = 8 + ((seq * 2) % 10)
      const minute = (seq * 7) % 60
      const pad = (n) => String(n).padStart(2, '0')
      const date = `2026-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`
      const format = cfg.formats[seq % cfg.formats.length]
      const title = cfg.titles[i % cfg.titles.length]
      out.push({
        id: `R-BULK-${String(seq).padStart(3, '0')}`,
        name: `${title}（${cfg.category}·${String(i + 1).padStart(2, '0')}）`,
        type: cfg.type,
        format,
        formats: [format],
        source: '九规云空间',
        updated: date,
        owner: cfg.owner,
        contact: cfg.uploader,
        security: 'public',
        nets: ['inet'],
        scope: ['public', 'internal', 'all-org'],
        size: cfg.type === 'bizdata' ? '—' : sizes[seq % sizes.length],
        status: 'authorized',
        regKind: 'pure',
        action: '在线预览 · 元数据登记',
        desc: `${cfg.category}业务数据演示样本，用于数据中心分类浏览、季度统计与分页展示。`,
        dataStandard: {
          uploader: cfg.uploader,
          sourceOrg: cfg.owner,
          businessCategory: cfg.category,
          dataOwner: cfg.uploader,
          originalSource: '集团自产',
          dataDate: date,
          registeredAt: date,
        },
        aiMeta: { summary: `${cfg.category}业务演示数据，覆盖 ${date.slice(0, 7)} 的登记批次。`, period: '2026', coverage: '九江市域' },
      })
    }
  })
  return out
}
const liveApps = apps.map((a) => ({ ...a }))
const liveTickets = tickets.map((t) => ({ ...t, history: [...t.history] }))
const liveFeedback = [...feedback]
const liveTasks = []
const liveAutomations = []
const liveCloud = cloudSystems.map((s) => ({ ...s }))
const liveProjects = projects.map((p) => ({ ...p }))
const MARKET_BUILTIN = [
  { id: 'D-01', section: '官方与内置', name: 'Agent 经验与工具设计', desc: '设计模型可见的工具名称、描述、参数与技能加载方式，让信息更易发现、上下文更省', publisher: '平台开发运维', scope: '企业公开', kind: 'skill', version: '0.2.2-rc.1' },
  { id: 'D-02', section: '官方与内置', name: 'Cordis 组合参考', desc: '编写或阅读 Cordis 组合补丁与 Agent 预设时，查询 YAML 方言与可安装插件包清单', publisher: '平台开发运维', scope: '企业公开', kind: 'skill', version: '0.2.2-rc.1' },
  { id: 'D-03', section: '官方与内置', name: 'DSH 插件开发', desc: '设计、审查、安装、启停和调试 Harness 插件、Bundle、页面、工具与 MCP 连接', publisher: '平台开发运维', scope: '企业公开', kind: 'skill', version: '0.2.2-rc.1' },
  { id: 'D-04', section: '官方与内置', name: 'Agent 预设编辑', desc: '创建、修改和校验 Agent 预设与其他 Cordis 组合，判断 Host 与预设的正确放置位置', publisher: '平台开发运维', scope: '企业公开', kind: 'skill', version: '0.2.2-rc.1' },
]
const liveMarket = MARKET_BUILTIN.map((m, i) => ({ ...m, order: i }))
/* 产品内置插件：由平台能力直接承载，不进入账号安装目录，也不出现在输入框“添加工具”菜单。 */
const PRODUCT_MARKET_PLUGINS = [
  {
    id: 'M-CODEREVIEW',
    section: '官方与内置',
    name: '代码审查',
    desc: '对已绑定本地目录的项目执行只读源码扫描、语法检查、JSON 校验与静态规则提示；输出可定位的审查报告，不自动修改文件。',
    publisher: '平台开发运维',
    scope: '企业公开',
    kind: 'plugin',
    type: 'plugin',
    version: '1.0.0',
    origin: 'builtin',
    installed: true,
    locked: true,
    available: true,
    listed: true,
    installScope: '产品内置，无需安装',
    product: 'code-review',
  },
]

/* 市场安装台账：按市场条目记录“哪个账号、装到哪个范围”，用于隔离与后台查看。 */
const liveMarketInstalls = new Map()
function marketInstallRecords(id) {
  const list = liveMarketInstalls.get(String(id))
  return Array.isArray(list) ? list : []
}
function addMarketInstallRecord(id, record) {
  const list = marketInstallRecords(id).filter((r) => !(r.userId === record.userId && r.scope === record.scope && String(r.projectId || '') === String(record.projectId || '')))
  list.unshift(record)
  liveMarketInstalls.set(String(id), list.slice(0, 200))
}
function removeMarketInstallRecord(id, record) {
  const list = marketInstallRecords(id).filter((r) => !(r.userId === record.userId && r.scope === record.scope && String(r.projectId || '') === String(record.projectId || '')))
  if (list.length) liveMarketInstalls.set(String(id), list)
  else liveMarketInstalls.delete(String(id))
}
/* 插件安装与启停按用户独立保存，避免一个账号的操作影响其他人。 */
const livePluginInstalls = new Map()
const livePluginToggles = new Map()
const liveOfficialDisabledSkills = new Set()
const liveOfficialUninstalledSkills = new Set()
function installedIdsOf(userId) {
  const list = livePluginInstalls.get(userId)
  return Array.isArray(list) ? list : []
}
function pluginEnabledFor(userId, plugin) {
  const map = livePluginToggles.get(userId)
  if (map && typeof map[plugin.id] === 'string') return map[plugin.id]
  return plugin.status
}
/* ===== 插件提交与审核（演示内存态） ===== */
const pluginSubs = []
/* 市场包版本备份：用于管理员升级失败回滚；只保存真实存在的包目录。 */
const marketVersions = new Map()

const cloudLog = cloudSessions.map((s) => ({ ...s }))
const liveDrive = driveItems.map((d) => ({ ...d, shared: [...d.shared] }))
const liveClouds = cloudSpaces.map((c) => ({ ...c }))
function buildImAnalysis(docs, asker) {
  if (!docs.length) {
    return `${asker} 已调用智能助手。\n会话里还没有可分析的文档：先发一份文档，或用「＋ → 云空间」把云空间资料发到会话，再 @智能助手。`
  }
  const names = docs.map((d) => d.name)
  const kinds = docs.map((d) => d.type.toUpperCase())
  const lines = [
    `${asker} 已调用智能助手，分析本会话 ${docs.length} 份文档：${names.join('、')}。`,
    '',
    '分析结果',
    `1. 资料齐备度：${names.length} 份（${kinds.join(' / ')}），${names.length === 1 ? '单份材料可先给出结论，补充数据表后结论会更稳' : '可支撑一次内部讨论'}。`,
    `2. 口径一致性：${names[0]} 的口径与其余文档一致，未发现指标定义冲突；${names.length > 1 ? `「${names[1]}」` : '数据表'}中的统计范围需要与项目边界再核对一次。`,
    '3. 数据缺口：缺少一份明确的指标基准年说明，建议补齐后再对外引用。',
    '4. 下一步：把上述文档在群里转为在线文档，由文档所有者补充基准年与责任分工，我可在补齐后重新分析。',
  ]
  return lines.join('\n')
}
const liveIm = imThreads.map((t) => ({ ...t, messages: t.messages.map((m) => ({ ...m })), roster: (t.roster || []).map((r) => ({ ...r })) }))
/** 已生成文档的字节内容，键为文档 id，仅保存在本次进程内 */
const generatedDocs = new Map()
const liveNotices = notices.map((n) => ({ ...n, body: [...n.body] }))
const liveAcademy = academy.map((a) => ({ ...a }))
/* 补齐 PRD 缺口所需的可变状态：消息中心、模型配置、工具台账、资源版本与授权、组织职能授权 */
const liveMessages = messagesSeed.map((m) => ({ ...m }))
const liveModelConfig = new Map()
/** 平台级 Agent 运行时设置：新会话默认值 + 文件变更摘要开关 */
const DEFAULT_RUNTIME_SETTINGS = Object.freeze({
  defaultPolicy: 'auto',
  defaultEffort: 'medium',
  workspaceChanges: true,
})
const runtimeSettings = { ...DEFAULT_RUNTIME_SETTINGS }
const agentPresets = []
function sanitizeAgentPreset(input = {}) {
  const id = /^APRESET-\d{6,}$/.test(String(input.id || '')) ? String(input.id) : ''
  const policy = input.defaultPolicy === 'manual' ? 'manual' : 'auto'
  const effort = ['low', 'medium', 'high'].includes(String(input.defaultEffort || '')) ? String(input.defaultEffort) : 'medium'
  return {
    id,
    name: String(input.name || '').trim().slice(0, 40),
    description: String(input.description || '').trim().slice(0, 200),
    instructions: String(input.instructions || '').trim().slice(0, 8000),
    defaultPolicy: policy,
    defaultEffort: effort,
    projectId: String(input.projectId || '').slice(0, 40),
    createdAt: String(input.createdAt || ''),
  }
}
function sanitizeRuntimeSettings(input = {}) {
  return {
    defaultPolicy: input.defaultPolicy === 'manual' ? 'manual' : 'auto',
    defaultEffort: ['low', 'medium', 'high'].includes(String(input.defaultEffort || ''))
      ? String(input.defaultEffort)
      : DEFAULT_RUNTIME_SETTINGS.defaultEffort,
    workspaceChanges: input.workspaceChanges !== false,
  }
}

/** 设置中心展示的运行时事实：全部来自本机真实文件与进程状态。 */
function runtimeDumpPath(home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  // 配置快照必须跟 DSH Home 走；保留全局 home 的历史路径，账号 home 各写各的。
  const defaultHome = normalize(join(dataDirPath(), 'dsh-home')).toLowerCase()
  if (normalize(String(home)).toLowerCase() === defaultHome) return join(dataDirPath(), 'dsh-dump-config.txt')
  return join(home, 'dsh-dump-config.txt')
}

function runtimeOverview(home = join(dataDirPath(), 'dsh-home')) {
  const configPath = join(home, 'profiles', 'sdk', 'cordis.patch.yml')
  const dumpPath = runtimeDumpPath(home)
  const sessionsPath = join(home, 'sessions')
  let dshVersion = 'unknown'
  try {
    dshVersion = JSON.parse(readFileSync(join(root, 'dsh-runtime', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8')).version || 'unknown'
  } catch {}
  let configUpdatedAt = ''
  let dumpUpdatedAt = ''
  let configEntries = 0
  let dumpText = ''
  try { configUpdatedAt = statSync(configPath).mtime.toISOString() } catch {}
  try {
    dumpUpdatedAt = statSync(dumpPath).mtime.toISOString()
    dumpText = readFileSync(dumpPath, 'utf8')
    configEntries = (dumpText.match(/^\s*name: '@deepseek-ai\//gm) || []).length
  } catch {}
  const inventory = runtimePluginInventory(home)
  const nativeRow = (id) => {
    const row = inventory.find((x) => x.id === id)
    if (!row) return '未挂载'
    if (row.condition) return '按条件'
    return row.enabled ? '已挂载' : '已停用'
  }
  const credentialsPath = join(home, '.credentials.yaml')
  let credentialsUpdatedAt = ''
  try { credentialsUpdatedAt = statSync(credentialsPath).mtime.toISOString() } catch {}
  const skillsDir = join(home, 'skills')
  let skills = []
  try {
    skills = readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {}
  return {
    dshVersion,
    profile: 'sdk',
    configPath,
    dumpPath,
    sessionsPath,
    configUpdatedAt,
    dumpUpdatedAt,
    configEntries,
    activeRuns: activeRuns.size,
    sessions: conversations.length,
    running: conversations.filter((c) => c.status === 'running').length,
    native: {
      authority: 'product-settings',
      writable: false,
      settings: nativeRow('settings'),
      configEditor: nativeRow('config-editor'),
      authorization: nativeRow('authorization'),
      credentials: nativeRow('credentials'),
      workflowPtc: nativeRow('workflow-ptc'),
      toolExecutorPtc: nativeRow('tool-executor-ptc'),
      checkpointPolicy: nativeRow('session-checkpoint-policy'),
      fileRollback: '未提供',
      skillsDir,
      skills,
      officeSkill: nativeRow('skill-office'),
      sessionSearch: nativeRow('optional-tool-session-query'),
      sessionExport: '产品会话导出',
      credentialsPath,
      credentialsPresent: existsSync(credentialsPath),
      credentialsUpdatedAt,
      modelKeySource: '产品设置中心 → 子进程环境',
    },
  }
}
function officialSkillCatalog() {
  const skillsDir = join(dataDirPath(), 'dsh-home', 'skills')
  const labels = {
    'agent-experience': 'Agent 经验与工具设计',
    'cordis-composition-reference': 'Cordis 组合参考',
    'cordis-plugin-development': 'DSH 插件开发',
    'editing-cordis-compositions': 'Agent 预设编辑',
  }
  const list = []
  for (const dir of OFFICIAL_SKILL_DIRS) {
    const installed = existsSync(join(skillsDir, dir))
    const readDir = installed ? join(skillsDir, dir) : join(DSH_DEFAULT_SKILL_SOURCE, dir)
    let name = labels[dir] || dir
    let desc = 'DeepSeek Harness 官方内置技能'
    try {
      const text = readFileSync(join(readDir, 'SKILL.md'), 'utf8')
      const fm = text.match(/^---\s*\n([\s\S]*?)\n---/)
      if (fm) {
        desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1]?.trim() || desc
      }
    } catch {}
    const enabled = installed && !liveOfficialDisabledSkills.has(dir)
    list.push({
      id: `S-${dir}`,
      name,
      kind: 'personal',
      publisher: '平台开发运维',
      version: '0.2.2-rc.1',
      status: !installed ? 'uninstalled' : enabled ? 'enabled' : 'disabled',
      installed,
      enabled,
      nets: ['inet', 'gov', 'secret'],
      deps: 'DSH 官方技能',
      scope: '平台官方基线',
      risk: '只读',
      desc,
      source: 'dsh-skill',
      dir,
    })
  }
  return list
}
function installedSkillPlugins() {
  return officialSkillCatalog().filter((p) => p.enabled)
}
function officialBaselineBundles() {
  const home = join(dataDirPath(), 'dsh-home')
  const bundles = profileManifest(home)?.dsh?.profile?.bundles || []
  return [
    { name: '@deepseek-ai/dsh-base', label: 'Harness 基础运行时', desc: '文件、Shell、会话、工具执行与权限基础模块', core: true },
    { name: '@deepseek-ai/dsh-sdk-app', label: 'Harness SDK 应用层', desc: '本产品 JSON-RPC 会话接入所需的 SDK 应用组合', core: true },
  ].map((b) => ({
    ...b,
    id: `B-${b.name}`,
    kind: 'plugin',
    publisher: '平台开发运维',
    version: '0.2.2-rc.1',
    scope: '平台官方基线 · 核心运行时',
    enabled: bundles.includes(b.name),
    status: bundles.includes(b.name) ? 'enabled' : 'missing',
  }))
}
/* 账号技能目录里由市场安装的技能；官方基线不复制到这里，因此不会混入“已安装”。 */
function installedUserSkillPlugins(userId) {
  const skillsDir = join(userDshHome(userId), 'skills')
  let dirs = []
  try {
    dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {}
  const list = []
  for (const dir of dirs) {
    const target = join(skillsDir, dir)
    const manifest = marketSkillManifestAt(target)
    const item = manifest?.marketId ? liveMarket.find((m) => m.id === manifest.marketId) : null
    let name = item?.name || dir
    let desc = item?.desc || '当前账号安装的技能'
    try {
      const text = readFileSync(join(target, 'SKILL.md'), 'utf8')
      const fm = text.match(/^---\s*\n([\s\S]*?)\n---/)
      if (fm && !item) {
        name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim() || name
        desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1]?.trim() || desc
      }
    } catch {}
    list.push({
      id: `S-user-${dir}`,
      name,
      kind: 'personal',
      publisher: item?.publisher || '当前账号安装',
      version: item?.version || '',
      status: 'enabled',
      nets: ['inet', 'gov', 'secret'],
      deps: '账号技能目录',
      scope: '当前账号',
      risk: '只读',
      desc,
      source: 'dsh-skill',
      dir,
      marketId: manifest?.marketId || '',
    })
  }
  return list
}

/**
 * 已安装到当前账号 DSH 运行时的市场 Bundle。
 * 这些包没有 SKILL.md，不能混进“账号技能目录”；但对用户来说它们就是已安装插件，
 * 需要出现在输入框的插件选择器和 @ 快速调用里。
 */
function installedMarketBundlePlugins(userId) {
  return liveMarket
    .filter((item) => item.kind === 'bundle')
    .map((item) => marketItemState(item, { userId }))
    .filter((item) => item.installed)
    .map((item) => ({
      id: item.id,
      marketId: item.id,
      name: item.name,
      kind: 'enterprise',
      status: 'enabled',
      publisher: item.publisher || item.submittedBy || '插件市场',
      version: item.version || '1.0.0',
      scope: item.installScope || '当前账号的 DSH 运行时',
      risk: '按插件权限执行',
      desc: item.desc || '',
      source: 'market-bundle',
      installed: true,
      bundle: true,
    }))
}

function installedPluginsForUser(userId) {
  return [...installedSkillPlugins(), ...installedUserSkillPlugins(userId), ...installedMarketBundlePlugins(userId)]
}

/*
 * 平台公共能力是系统级模块，不属于插件市场：
 * 默认安装启用、对全部授权用户开放、随平台独立升级，管理员只配置权限与资源上限。
 * 只有运行时确实加载的模块才进入这份清单，未交付的能力不伪造“已启用”。
 */
const PLATFORM_CAPABILITIES = [
  {
    id: 'CAP-OFFICE', name: 'Office 文档处理', shortName: 'Office', icon: 'doc', module: 'dsh-skill-office',
    sourceIds: ['skill-office'], version: '1.0.0', protocol: 'DSH 标准工具协议',
    permissions: ['Word / Excel / PPT 读取', '文档生成', '格式转换', '导出'],
    limits: { cpu: 1, memory: 512, timeout: 120, concurrency: 2 },
    deps: ['@deepseek-ai/dsh-skill'],
    desc: 'Word、Excel、PPT 的读取、生成、转换与导出，由平台内置的 Office 模块统一提供；PDF 由独立的 PDF 数据格式能力处理。',
    accessibleTo: '全部授权用户', role: '基础能力', risk: '只读或白名单写入',
  },
  {
    id: 'CAP-PDF', name: 'PDF 文档处理', shortName: 'PDF', icon: 'doc', module: 'formats.mjs#pdf',
    sourceIds: ['formats'], runtime: 'product', version: '1.0.0', protocol: '格式基座协议',
    permissions: ['PDF 解析', '文本提取', '按页拆分', '合并', 'PDF 导出'],
    limits: { cpu: 1, memory: 512, timeout: 120, concurrency: 2 },
    deps: ['pdf-lib'],
    desc: '平台级 PDF 数据格式基座：校验文件头、读取页数与页面尺寸、提取文本、合并与按页范围拆分；数据中心、Agent 与 MCP 工具统一通过 formats.mjs 调用。',
    accessibleTo: '全部授权用户', role: '基础能力', risk: '只读或白名单写入',
  },
  {
    id: 'CAP-GIS', name: 'GIS 空间数据', shortName: 'GIS', icon: 'globe', module: 'formats.mjs#gis',
    sourceIds: ['formats'], runtime: 'product', version: '1.0.0', protocol: '格式基座协议',
    permissions: ['GeoJSON 读取', '要素与图层识别', 'bbox 计算', '规范化 GeoJSON 输出'],
    limits: { cpu: 1, memory: 512, timeout: 120, concurrency: 2 },
    deps: ['geo.mjs'],
    desc: '平台级 GIS 数据格式基座：读取点、线、面、Multi* 与 GeometryCollection，识别图层与范围，输出规范化 FeatureCollection；不做投影转换。',
    accessibleTo: '全部授权用户', role: '基础能力', risk: '只读或白名单写入',
  },
  {
    id: 'CAP-CAD', name: 'CAD 图纸数据', shortName: 'CAD', icon: 'grid', module: 'formats.mjs#cad',
    sourceIds: ['formats'], runtime: 'product', version: '1.0.0', protocol: '格式基座协议',
    permissions: ['ASCII DXF 读取', '实体与图层识别', 'bbox 计算', 'DXF 导出'],
    limits: { cpu: 1, memory: 512, timeout: 120, concurrency: 2 },
    deps: ['geo.mjs'],
    desc: '平台级 CAD 数据格式基座：读取 ASCII DXF 实体、图层与范围，回写 LINE / LWPOLYLINE / CIRCLE / TEXT 为 DXF；DWG 需先转换为 DXF。',
    accessibleTo: '全部授权用户', role: '基础能力', risk: '只读或白名单写入',
  },
  {
    id: 'CAP-MCP-JG', name: '业务系统接入（MCP）', shortName: '业务系统接入', icon: 'globe', module: 'dsh-mcp-client',
    sourceIds: ['mcp-jg'], version: '1.0.0', protocol: 'MCP 标准调用协议',
    permissions: ['内部数据检索', 'IM 发送', '待办创建'],
    limits: { cpu: 1, memory: 256, timeout: 60, concurrency: 2 },
    deps: ['@deepseek-ai/dsh-mcp-client'],
    desc: '云空间、公告、课程、通讯录、数据中心与 IM、待办等内部工具的 MCP 桥；按当前员工身份与网络授权执行，不是全员同权。',
    accessibleTo: '按员工身份与网络授权', role: '业务集成', risk: '写操作需确认',
  },
  {
    id: 'CAP-FILES', name: '文件附件与交付物', shortName: '文件附件', icon: 'folder', module: 'dsh-file-reference-local',
    sourceIds: ['file-reference-local', 'file-upload', 'deliverable-file-references'], version: '1.0.0', protocol: 'DSH 标准工具协议',
    permissions: ['文件读取', '文件上传', '交付物引用'],
    limits: { cpu: 1, memory: 256, timeout: 60, concurrency: 4 },
    deps: ['@deepseek-ai/dsh-file-reference-local', '@deepseek-ai/dsh-client-file-upload'],
    desc: '本地附件、云空间文件与交付物的统一读取、引用和上传，是聊天与所有插件的文件入口，属于只读基础内核。',
    accessibleTo: '全部授权用户', role: '基础内核', risk: '只读或白名单写入',
    layer: 'kernel', stoppable: false,
  },
  {
    id: 'CAP-CODEREVIEW', name: '代码审查服务', shortName: '代码审查', icon: 'shield', module: 'harness-services.mjs#code-review',
    sourceIds: ['harness-services'], runtime: 'product', version: '1.0.0', protocol: 'Harness 服务协议',
    permissions: ['只读源码扫描', '语法检查', 'JSON 校验', '静态规则提示'],
    limits: { cpu: 1, memory: 512, timeout: 300, concurrency: 1 },
    deps: ['harness-services.mjs'],
    desc: 'Harness 通用基础服务：按项目目录只读扫描源码，执行语法与 JSON 校验，返回可定位的低风险静态提示；不自动修改项目文件。',
    accessibleTo: '全部授权用户', role: '基础内核', risk: '只读',
    layer: 'kernel', stoppable: false,
  },
  {
    id: 'CAP-PYTHON', name: 'Python / 脚本运行环境', shortName: 'Python 环境', icon: 'tool', module: 'dsh-shell-env',
    sourceIds: ['shell-env'], version: '1.0.0', protocol: 'DSH Shell 工具协议',
    permissions: ['命令执行', '脚本运行'],
    limits: { cpu: 2, memory: 1024, timeout: 300, concurrency: 1 },
    deps: ['@deepseek-ai/dsh-shell-env'],
    desc: '平台内置的脚本执行环境，供插件运行 Python、数据处理与格式转换脚本；属于高权限高级能力。',
    accessibleTo: '按角色授权', role: '高级能力', risk: '命令执行，需审批',
  },
  {
    id: 'CAP-DATA', name: '会话与数据检索', shortName: '会话检索', icon: 'search', module: 'dsh-session-query-sqlite',
    sourceIds: ['optional-tool-session-query', 'session-query-sqlite'], version: '1.0.0', protocol: 'DSH 标准工具协议',
    permissions: ['历史会话检索', '本地索引读取'],
    limits: { cpu: 1, memory: 512, timeout: 90, concurrency: 2 },
    deps: ['@deepseek-ai/dsh-session-query-sqlite', '@deepseek-ai/dsh-tool-session-query'],
    desc: '历史会话与本地索引的检索、读取和引用，不包含外部资料解析。',
    accessibleTo: '全部授权用户', role: '基础能力', risk: '只读',
  },
  {
    id: 'CAP-WEB', name: 'Web 搜索与网页抓取', shortName: 'Web 搜索', icon: 'globe', module: 'dsh-tool-web',
    sourceIds: ['web-search-deepseek', 'web-fetch-http', 'tool-web'], version: '1.0.0', protocol: 'DSH 标准工具协议',
    permissions: ['网页搜索', '网页读取', '来源引用'],
    limits: { cpu: 1, memory: 256, timeout: 60, concurrency: 2 },
    deps: ['@deepseek-ai/dsh-web', '@deepseek-ai/dsh-web-search-deepseek', '@deepseek-ai/dsh-web-fetch-http'],
    desc: '官方 Web 搜索与网页抓取能力，按网络域和白名单提供搜索结果与页面正文。',
    accessibleTo: '全部授权用户', role: '基础能力', risk: '只读，受网络域限制',
  },
  {
    id: 'CAP-JOBS', name: '后台作业', shortName: '后台作业', icon: 'tool', module: 'dsh-tool-jobs',
    sourceIds: ['jobs', 'tool-jobs'], version: '1.0.0', protocol: 'DSH 标准工具协议',
    permissions: ['后台任务', '任务查询', '任务取消'],
    limits: { cpu: 2, memory: 512, timeout: 600, concurrency: 2 },
    deps: ['@deepseek-ai/dsh-jobs-local', '@deepseek-ai/dsh-tool-jobs'],
    desc: '运行长时间任务、查询进度和取消后台作业；与员工个人“定时任务”不同，属于平台运行时能力。',
    accessibleTo: '全部授权用户', role: '高级能力', risk: '后台执行，需保留审计',
  },
  {
    id: 'CAP-AGENT', name: 'Agent 编排与工作流', shortName: 'Agent 编排', icon: 'spark', module: 'dsh-workflow-ptc',
    sourceIds: ['subagent', 'agent-team', 'tool-agent-team', 'ptc-runtime', 'workflow-ptc', 'tool-workflow'], version: '1.0.0', protocol: 'DSH 标准工具协议',
    permissions: ['子 Agent 调用', 'Agent 团队编排', '工作流编排', '沙箱脚本'],
    limits: { cpu: 2, memory: 1024, timeout: 300, concurrency: 2 },
    deps: ['@deepseek-ai/dsh-subagent', '@deepseek-ai/dsh-workflow-ptc'],
    desc: '官方子 Agent、PTC 运行时与工作流编排能力；属于高级能力，先按角色开放并限制并发。',
    accessibleTo: '按角色授权', role: '高级能力', risk: '多 Agent 与沙箱执行',
  },
]
const liveCapabilityPolicies = new Map()
function capabilityPolicyOf(cap) {
  const saved = liveCapabilityPolicies.get(cap.id) || {}
  const permissions = Array.isArray(saved.permissions) && saved.permissions.length ? saved.permissions : cap.permissions
  const limits = { ...cap.limits, ...(saved.limits || {}) }
  return { permissions, limits, disabled: Boolean(saved.disabled), disabledAt: saved.disabledAt || 0, disabledBy: saved.disabledBy || '', updatedAt: saved.updatedAt || 0, updatedBy: saved.updatedBy || '' }
}
function platformCapabilities(home) {
  const inventory = runtimePluginInventory(home)
  const rowEnabled = (id) => Boolean(inventory.find((x) => x.id === id)?.enabled)
  return PLATFORM_CAPABILITIES.map((cap) => {
    const policy = capabilityPolicyOf(cap)
    const runtimeEnabled = cap.runtime === 'product' ? true : cap.sourceIds.every(rowEnabled)
    return {
      ...cap,
      kind: 'capability',
      layer: cap.layer || 'platform',
      source: 'platform-module',
      managedBy: '平台开发运维',
      accessibleTo: cap.accessibleTo || '全部授权用户',
      stoppable: cap.stoppable !== false && cap.layer !== 'kernel',
      defaultEnabled: true,
      runtimeEnabled,
      enabled: runtimeEnabled && !policy.disabled,
      disabled: policy.disabled,
      disabledAt: policy.disabledAt,
      disabledBy: policy.disabledBy,
      status: policy.disabled ? 'disabled' : runtimeEnabled ? 'enabled' : 'missing',
      nets: ['inet', 'gov', 'secret'],
      installScope: '系统级模块 · 默认安装，不可卸载',
      upgradedBy: '平台发布，独立升级',
      permissions: policy.permissions,
      limits: policy.limits,
      policyUpdatedAt: policy.updatedAt,
      policyUpdatedBy: policy.updatedBy,
      role: '基础能力',
      risk: cap.id === 'CAP-MCP-JG' ? '写操作需确认' : '只读或白名单写入',
    }
  })
}

function maskGatewayEndpoint(value = '') {
  const text = String(value || '').trim()
  if (!text) return '—'
  try {
    const url = new URL(text)
    return `${url.protocol}//${url.host}${url.pathname && url.pathname !== '/' ? '/…' : ''}`
  } catch {
    return text
      .replace(/([?&](?:key|token|api_key|apikey)=)[^&]+/gi, '$1••••')
      .replace(/\/\/[^/@]+@/, '//••••@')
  }
}

function accountRuntimeHome(user) {
  if (!user || !user.id || user.id === 'guest' || user.role === 'guest') return undefined
  return ensureUserDshHome(user.id)
}

const liveToolLedger = toolLedger.map((t) => ({ ...t }))
const liveVersions = Object.fromEntries(Object.entries(resourceVersionSeed).map(([k, v]) => [k, v.map((x) => ({ ...x }))]))
const liveGrants = Object.fromEntries(Object.entries(resourceGrantSeed).map(([k, v]) => [k, v.map((x) => ({ ...x }))]))
const liveEditRequests = new Map()
const liveDownloadRequests = new Map()
const resourceReads = new Map([
  ['R-TDT-2026', 12840],
  ['R-3D-2026-XY', 6421],
  ['R-DOC-GH-2021', 3802],
  ['R-PROJ-PUB', 2145],
  ['R-VIDEO-SITE', 1580],
  ['R-IMG-DRONE', 1290],
  ['R-BIZ-TIJIAN', 980],
])
const resourceDownloads = new Map([
  ['R-TDT-2026', 36],
  ['R-3D-2026-XY', 18],
  ['R-DOC-GH-2021', 12],
  ['R-PROJ-PUB', 9],
  ['R-VIDEO-SITE', 7],
  ['R-IMG-DRONE', 5],
  ['R-BIZ-TIJIAN', 4],
])
const liveDuties = new Map(Object.entries(duties).map(([k, v]) => [k, [...v]]))
const liveMembers = orgMembers.map((m) => ({ ...m, posts: m.posts.map((p2) => ({ ...p2 })), accounts: [...m.accounts] }))
function dutiesOf(user) { return liveDuties.get(user.id) || [] }

/* 共享文档的协同状态：段落、评论、段落权限、版本号与在线编辑者（轮询式伪实时） */
const liveComments = new Map(Object.entries(collabCommentSeed).map(([k, v]) => [k, v.map((c) => ({ ...c, mentions: [...(c.mentions || [])] }))]))
const liveBlockPerms = new Map()
const liveRev = new Map()
const livePresence = new Map()

const LIVE_NOTEBOOKS = notebookSeed.map((n) => ({
  ...n,
  sources: n.sources.map((x) => ({ ...x })),
  notes: n.notes.map((x) => ({ ...x, citations: (x.citations || []).map((c) => ({ ...c })) })),
  chat: n.chat.map((x) => ({ ...x, citations: (x.citations || []).map((c) => ({ ...c })) })),
  collections: [...(n.collections || [])],
  pinned: !!n.pinned,
  shared: !!n.shared,
  votes: Number(n.votes || 0),
  votedBy: [...(n.votedBy || [])],
}))

const NOTEBOOK_COLLECTIONS = ['国土空间规划', '城市体检', '项目复盘', '政策研究', '汇报材料']
const NOTEBOOK_MAX_SOURCES = 20
const NOTEBOOK_QUOTA_BYTES = 15 * 1024 * 1024 * 1024
function notebookUsageBytes(userName) {
  return LIVE_NOTEBOOKS
    .filter((n) => n.owner === userName)
    .reduce((sum, n) => sum + n.sources.reduce((a, x) => a + ((x.kind === 'file') ? Number(x.sizeBytes || 0) : 0), 0), 0)
}
function quotaSizeText(bytes) {
  const n = Number(bytes) || 0
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2).replace(/\.00$/, '')} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(n / 1024)} KB`
}
function sharedNotebooksByVotes() {
  return LIVE_NOTEBOOKS
    .filter((n) => !!n.shared)
    .slice()
    .sort((a, b) => (Number(b.votes || 0) - Number(a.votes || 0))
      || String(b.updated || '').localeCompare(String(a.updated || ''))
      || String(a.id).localeCompare(String(b.id)))
}
function notebookFeaturedIds() {
  return new Set(sharedNotebooksByVotes().slice(0, 5).map((n) => n.id))
}

function latestVersionOf(resourceId) {
  const list = liveVersions[resourceId] || []
  const cur = list.find((v) => v.state === '当前') || list[0]
  return cur ? cur.v : 'V1.0'
}

function blocksOfDoc(id, doc) {
  if (doc.kind !== 'doc') return []
  const perms = liveBlockPerms.get(id) || {}
  return String(doc.body || '')
    .split(/\n\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `b${i + 1}`, no: i + 1, text, perm: perms[`b${i + 1}`] || 'edit' }))
}

function revOfDoc(id, doc) {
  if (!liveRev.has(id)) liveRev.set(id, Math.max(...doc.history.map((h) => h.v), 1))
  return liveRev.get(id)
}

function diffLines(a, b) {
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const rows = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { rows.push({ type: 'same', text: a[i] }); i += 1; j += 1 }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ type: 'del', text: a[i] }); i += 1 }
    else { rows.push({ type: 'add', text: b[j] }); j += 1 }
  }
  while (i < n) { rows.push({ type: 'del', text: a[i] }); i += 1 }
  while (j < m) { rows.push({ type: 'add', text: b[j] }); j += 1 }
  return rows
}

function presenceOfDoc(id) {
  if (!livePresence.has(id)) {
    livePresence.set(id, [
      { name: '钱工', at: '11:06', para: 'b3', state: '正在查看第 3 段' },
      { name: '李四', at: '11:07', para: 'b2', state: '正在编辑第 2 段' },
    ])
  }
  return livePresence.get(id)
}

function linesOfContent(doc) {
  if (doc.kind === 'sheet') return (doc.table || []).map((row) => row.map((c) => String(c)).join(' | '))
  if (doc.kind === 'slide') return (doc.slides || []).flatMap((s, i) => [`第 ${i + 1} 页：`, ...(s.lines || [])])
  return String(doc.body || '').split(/\n/)
}




/* 在线协作文档内容与编辑历史：文档 / 表格 / 演示共享后创建者与共享者均可编辑 */
const DOC_LABELS = {
  pdf: 'PDF', docx: '文档', xlsx: '表格', pptx: '演示',
  atlas: '图集', gdb: '数据库', shp: '数据库', dwg: '图纸',
}
const ASSET_FAMILY = { atlas: '图集', gdb: '数据库', shp: '数据库', dwg: '数据库' }
const collabDocs = new Map()

function seedCollab(item) {
  const name = item.name
  if (item.type === 'xlsx') {
    return {
      kind: 'sheet',
      table: [
        ['项目', '单位', '数值', '口径'],
        [name, '项', '86', '按建设单位归并'],
        ['归并后分组', '组', '12', '同建设单位合并'],
        ['已过公示期', '项', '3', '截至 2026-10'],
      ],
      history: [
        { v: 3, by: '李四', time: '2026-11-07 09:12', summary: '校正成本列口径，补充归并后分组' },
        { v: 2, by: item.owner, time: '2026-11-06 17:30', summary: '补充公示期限与状态两列' },
        { v: 1, by: item.owner, time: '2026-11-05 10:05', summary: '创建表格' },
      ],
    }
  }
  if (item.type === 'pptx') {
    return {
      kind: 'slide',
      slides: [
        { title: name, lines: ['项目背景与范围', '关键数据与口径', '下一步工作安排'] },
        { title: '下一步工作', lines: ['补齐台账口径', '完成部门复核', '归档到企业云项目空间'] },
      ],
      history: [
        { v: 2, by: item.owner, time: '2026-11-06 15:20', summary: '调整第二页要点，统一字号' },
        { v: 1, by: item.owner, time: '2026-11-04 11:30', summary: '创建演示' },
      ],
    }
  }
  const body = `${name}\n\n一、总体情况\n本文件由规划一所整理，数据截至 2026 年 10 月，口径与集团台账一致。\n\n二、数据与口径\n公示单位 86 家，按建设单位归并为 12 组；已过公示期 3 项，其余在公示期内跟踪。\n\n三、下一步工作\n补齐缺项口径，完成部门复核后归档到企业云项目空间。`
  const v1Body = `${name}\n\n一、总体情况\n本文件由规划一所整理。\n\n二、数据与口径\n公示单位 86 家。\n\n三、下一步工作\n补齐缺项口径。`
  return {
    kind: 'doc',
    body,
    rev: 2,
    history: [
      { v: 2, by: item.owner, time: '2026-11-06 17:40', summary: '补充数据截止时间与口径说明', snapshot: { body } },
      { v: 1, by: item.owner, time: '2026-11-05 14:05', summary: '创建文档', snapshot: { body: v1Body } },
    ],
  }
}

function collabOf(item) {
  if (!collabDocs.has(item.id)) collabDocs.set(item.id, seedCollab(item))
  return collabDocs.get(item.id)
}

const isSharedItem = (it) => (it.shared || []).some((x) => x !== '仅本人')
const canEditItem = (user, it) => it.owner === user.name || (it.shared || []).includes(user.name) || user.scopes.includes('all-org')
const typeLabelOf = (it) => `${isSharedItem(it) ? '共享' : ''}${DOC_LABELS[it.type] || it.type}`

// 身份或网络切换时，终止所有仍在运行的云会话，避免会话被下一个身份继承
function closeAllCloudSessions(reason) {
  cloudLog.filter((s) => s.state === 'active').forEach((s) => {
    s.state = 'closed'
    s.ttl = '已结束'
    s.note = reason
  })
}
const conversations = sampleConversations.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) }))
// 仅记录本进程内真正在跑的对话，避免历史遗留的 status=running 阻塞停止操作。
const activeRuns = new Set()

// 模型在工具调用前发起的审批/提问，等前端卡片回填。只保留本轮，进程重启即丢弃。
const pendingInteractions = new Map()

function createPendingInteraction(kind, conversationId, payload) {
  return new Promise((resolve) => {
    const id = `${kind === 'approval' ? 'AP' : 'AQ'}-${randomBytes(6).toString('hex')}`
    const timer = setTimeout(() => {
      settlePendingInteraction(id, kind === 'approval' ? { outcome: 'cancelled' } : { cancelled: true }, {
        approver: 'system-timeout',
        decision: 'expired',
      })
    }, 8 * 60 * 1000)
    pendingInteractions.set(id, { id, kind, conversationId, payload, resolve, timer, createdAt: Date.now() })
  })
}

function settlePendingInteraction(id, result, meta = {}) {
  const item = pendingInteractions.get(id)
  if (!item) return null
  pendingInteractions.delete(id)
  clearTimeout(item.timer)
  if (item.kind === 'approval' && item.payload?.decisionId) {
    const decision = meta.decision || (result.outcome === 'allowed-once' ? 'allowed' : result.outcome === 'rejected' ? 'rejected' : 'cancelled')
    try {
      updateApprovalDecision(item.payload.decisionId, {
        decision,
        approver: String(meta.approver || 'system'),
        decidedAt: Date.now(),
      })
    } catch (err) {
      console.error('[jg-server] approval decision update failed:', err && err.message ? err.message : err)
    }
  }
  item.resolve(result)
  return item
}

function cancelPendingInteractions(conversationId) {
  for (const [id, item] of pendingInteractions) {
    if (item.conversationId !== conversationId) continue
    settlePendingInteraction(id, item.kind === 'approval' ? { outcome: 'cancelled' } : { cancelled: true }, {
      approver: 'system-cancel',
      decision: 'cancelled',
    })
  }
}

function defaultPasswordForName(name, accountId = '') {
  const key = String(name || '').trim()
  let phonetic = ''
  try {
    phonetic = pinyin(key, { toneType: 'none', type: 'array' }).join('')
  } catch {}
  phonetic = String(phonetic || '').replace(/[^A-Za-z0-9]/g, '')
  if (!phonetic) phonetic = String(accountId || '').replace(/[^A-Za-z0-9]/g, '') || 'User'
  const full = `${phonetic.charAt(0).toUpperCase()}${phonetic.slice(1)}`
  return `${full}@123`
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const digest = scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt$${salt}$${digest}`
}

function verifyPassword(password, stored = '') {
  const parts = String(stored || '').split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !parts[1] || !parts[2]) return false
  const expected = Buffer.from(parts[2], 'hex')
  const actual = scryptSync(String(password), parts[1], expected.length || 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function ensureAccountPasswords() {
  for (const account of listAccounts()) {
    if (account.passwordHash) continue
    setAccountPassword(account.id, hashPassword(defaultPasswordForName(account.name, account.id)), true)
  }
}

function usernameForName(name, accountId = '') {
  const key = String(name || '').trim()
  let phonetic = ''
  try {
    phonetic = pinyin(key, { toneType: 'none', type: 'array' }).join('')
  } catch {}
  phonetic = String(phonetic || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  if (!phonetic) phonetic = String(accountId || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase() || 'user'
  return phonetic
}

function ensureAccountUsernames() {
  const used = new Set(listAccounts().map((account) => String(account.username || '').toLowerCase()).filter(Boolean))
  for (const account of listAccounts()) {
    if (account.username) continue
    const base = usernameForName(account.name, account.id)
    let candidate = base
    let suffix = 2
    while (used.has(candidate)) candidate = `${base}${suffix++}`
    setAccountUsername(account.id, candidate)
    used.add(candidate)
  }
}

const CAPTCHA_TTL_MS = 5 * 60 * 1000
const captchaChallenges = new Map()

function createCaptchaChallenge() {
  for (const [id, item] of captchaChallenges) {
    if (item.expiresAt <= Date.now()) captchaChallenges.delete(id)
  }
  const a = 2 + Math.floor(Math.random() * 18)
  const b = 2 + Math.floor(Math.random() * 18)
  let question = ''
  let answer = 0
  const op = Math.floor(Math.random() * 4)
  if (op === 0) {
    answer = a + b
    question = `${a} + ${b} = ?`
  } else if (op === 1) {
    const left = Math.max(a, b)
    const right = Math.min(a, b)
    answer = left - right
    question = `${left} - ${right} = ?`
  } else if (op === 2) {
    const left = 2 + Math.floor(Math.random() * 8)
    const right = 2 + Math.floor(Math.random() * 8)
    answer = left * right
    question = `${left} × ${right} = ?`
  } else {
    const divisor = 2 + Math.floor(Math.random() * 8)
    const quotient = 2 + Math.floor(Math.random() * 8)
    answer = quotient
    question = `${divisor * quotient} ÷ ${divisor} = ?`
  }
  const captchaId = randomBytes(9).toString('hex')
  captchaChallenges.set(captchaId, { answer: String(answer), expiresAt: Date.now() + CAPTCHA_TTL_MS })
  return { captchaId, question, expiresIn: CAPTCHA_TTL_MS }
}

function consumeCaptcha(captchaId, captchaAnswer) {
  const id = String(captchaId || '')
  const item = captchaChallenges.get(id)
  if (!item) return false
  captchaChallenges.delete(id)
  if (item.expiresAt <= Date.now()) return false
  return String(captchaAnswer == null ? '' : captchaAnswer).trim() === item.answer
}

// 启动时恢复上次进程落盘的状态；首次运行则保留原型演示数据。
hydratePersistentState()
seedLocalAccounts()
ensureAccountPasswords()
ensureAccountUsernames()
// 已有账号只在首次建号时复制全局 profile；启动时按账号幂等补齐平台级模型能力。
for (const account of listAccounts()) {
  try { ensureUserDshHome(account.id) } catch {}
}
clearDemoData()
// 重启会丢弃内存里的待审批交互；将上一进程遗留的 pending 记录收口为 expired，
// 避免审计列表长期显示“待审批”。
expirePendingApprovalDecisions('system-restart')
recoverChatRunTasks()
recoverPersistedConversations()
for (const a of liveAutomations) if (a && a.status === 'active' && !a.nextRunAt) scheduleAutomationNext(a, Date.now())
setInterval(automationTick, 30_000).unref()

// 2026-11-11：按用户要求清空所有演示业务数据，仅保留真实账号与模型配置。
// 演示数组已在 data.mjs 模块加载时置空；这里只做一次旧快照清理，避免重启后又回来。
function clearDemoData() {
  const marker = join(dataDirPath(), '.demo-cleared')
  if (existsSync(marker)) return

  const liveArrays = [
    liveResources, liveDataServices, liveApps, liveTickets, liveFeedback, liveTasks, liveAutomations,
    liveCloud, liveProjects, liveMarket, pluginSubs, cloudLog, liveDrive, liveClouds,
    liveIm, liveNotices, liveAcademy, liveMessages, liveToolLedger, liveMembers,
    LIVE_NOTEBOOKS, NOTEBOOK_COLLECTIONS, conversations, audit,
  ]
  for (const arr of liveArrays) {
    if (Array.isArray(arr)) arr.length = 0
  }
  for (const map of [
    livePluginInstalls, livePluginToggles, readNotifications, liveEditRequests,
    liveDownloadRequests, resourceReads, resourceDownloads, liveDuties, liveComments,
    liveBlockPerms, liveRev, livePresence, collabDocs, generatedDocs,
  ]) {
    if (map && typeof map.clear === 'function') map.clear()
  }
  for (const map of [liveVersions, liveGrants]) {
    if (map && typeof map === 'object') for (const k of Object.keys(map)) delete map[k]
  }
  for (const obj of [duties, resourceVersionSeed, resourceGrantSeed, collabCommentSeed]) {
    if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) delete obj[k]
  }
  clearAudit()
  clearSessions()
  writeFileSync(marker, new Date().toISOString(), 'utf8')
}

function userOfAccount(account) {
  const role = roles[account.role] || roles.employee
  return {
    ...role,
    id: account.id,
    accountId: account.id,
    username: account.username || '',
    name: account.name || role.name,
    unit: account.unit || role.unit,
    duty: account.duty || role.duty,
  }
}

function seedLocalAccounts() {
  if (!roles.admin) roles.admin = { ...roles.ops, id: 'admin', label: '管理员', name: '米乐', duty: '系统管理员' }
  const existing = getAccountByRole('admin')
  if (!existing) {
    upsertAccount({
      id: 'A-7788-01',
      name: '米乐',
      role: 'admin',
      unit: '集团总部',
      duty: '系统管理员',
      apiProvider: 'DeepSeek',
      apiEndpoint: 'https://api.deepseek.com',
      apiModel: 'deepseek-flash',
    })
  }
  // 账号表里的个人密钥是账号级来源；进程内配置优先，启动时把账号表补齐到进程内。
  for (const account of listAccounts()) {
    if (account.apiKey && !liveModelConfig.has(account.id)) {
      const raw = String(account.apiKey)
      liveModelConfig.set(account.id, {
        provider: account.apiProvider || 'DeepSeek',
        endpoint: account.apiEndpoint || 'https://api.deepseek.com',
        apiKey: raw,
        key: `${raw.slice(0, 3)}••••••••${raw.slice(-4)}`,
        defaultModel: account.apiModel || 'deepseek-flash',
      })
    }
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...v] = part.trim().split('=')
      return [k, decodeURIComponent(v.join('=') || '')]
    }).filter(([k]) => k)
  )
}

function sessionOf(req) {
  const sid = parseCookies(req.headers.cookie).jg_sid
  return sid ? getSession(sid) : null
}

const RUNTIME_PROFILE = process.env.JG_DSH_PROFILE || 'sdk'
const DSH_BIN = join(root, 'dsh-runtime', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')

/**
 * 用 dsh CLI 重新生成启动配置快照。
 * 旧实现只在 data/dsh-dump-config.txt 存在时读取，文件可能停在第一次生成时的旧配置；
 * 这里在服务启动和管理页打开时重新 dump，保证插件清单、profile patch 覆盖与当前一致。
 */
function refreshRuntimeConfigDump(home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  const dumpPath = runtimeDumpPath(home)
  const result = spawnSync(process.execPath, [DSH_BIN, '--profile', RUNTIME_PROFILE, '--dump-config'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    env: {
      ...process.env,
      DSH_HOME: home,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'dump-only',
      JG_DSH_NODE: process.env.JG_DSH_NODE || process.execPath,
      JG_MCP_SCRIPT: process.env.JG_MCP_SCRIPT || join(root, 'mcp-jg.mjs'),
      JG_MCP_URL: process.env.JG_MCP_URL || `http://127.0.0.1:${process.env.PORT || port}`,
      JG_MCP_TOKEN: process.env.JG_MCP_TOKEN || '',
      JG_MCP_ACCOUNT: process.env.JG_MCP_ACCOUNT || 'A-7788-01',
    },
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    console.error('[jg-server] 刷新 DSH 配置快照失败:', (result.stderr || '').trim().slice(0, 300))
    return false
  }
  writeFileSync(dumpPath, result.stdout, 'utf8')
  return true
}

const PNPM_RUNTIME_DIR = join(root, 'runtime', 'pnpm')
const PNPM_SHIM = join(PNPM_RUNTIME_DIR, 'pnpm.cmd')
const PNPM_CJS = join(PNPM_RUNTIME_DIR, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
let pnpmProbe = null
function pnpmCommand() {
  return existsSync(PNPM_SHIM) ? PNPM_SHIM : 'pnpm'
}
function pnpmAvailable() {
  if (pnpmProbe === null) {
    const result = spawnSync(process.execPath, [PNPM_CJS, '--version'], { encoding: 'utf8', timeout: 30000 })
    pnpmProbe = result.status === 0
  }
  return pnpmProbe
}
function dshPluginEnv(home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  const path = process.env.PATH || process.env.Path || ''
  const extra = [PNPM_RUNTIME_DIR, dirname(process.execPath)].filter(Boolean).join(';')
  return {
    ...process.env,
    DSH_HOME: home,
    PATH: `${extra};${path}`,
    Path: `${extra};${path}`,
  }
}
function runDshPlugin(args, timeout = 180000, home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  return spawnSync(process.execPath, [dshBin, 'plugin', '--profile', RUNTIME_PROFILE, ...args], {
    cwd: runtimeProfileDir(home),
    timeout,
    encoding: 'utf8',
    env: dshPluginEnv(home),
  })
}
const PROTECTED_PLUGIN_IDS = new Set([
  'plugin-manager', 'tool-plugin-manager', 'llm', 'session', 'agent', 'sandbox',
  'typert', 'typert-loader', 'typert-gateway', 'session-log-deepseek', 'mcp-jg',
])

function runtimeProfileDir(home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  return join(home, 'profiles', RUNTIME_PROFILE)
}

/**
 * 从 dsh 的配置快照读取当前 profile 的插件清单。
 * 快照是启动时的权威挂载组合；启停写入 profile patch，重启后生效。
 */
function runtimePluginInventory(home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  const dumpPath = runtimeDumpPath(home)
  if (!existsSync(dumpPath)) return []
  const lines = readFileSync(dumpPath, 'utf8').split(/\r?\n/)
  const rows = []
  let current = null
  for (const line of lines) {
    const id = /^\s*-\s+id:\s*(.+?)\s*$/.exec(line)
    if (id) {
      if (current) rows.push(current)
      current = { id: id[1].replace(/^['"]|['"]$/g, ''), name: '', enabled: true, condition: '' }
      continue
    }
    if (!current) continue
    const name = /^\s+name:\s*(.+?)\s*$/.exec(line)
    if (name) { current.name = name[1].replace(/^['"]|['"]$/g, ''); continue }
    const disabled = /^\s+disabled:\s*(.+?)\s*$/.exec(line)
    if (disabled) {
      const raw = disabled[1]
      if (raw === 'true') current.enabled = false
      else if (raw === 'false') current.enabled = true
      else current.condition = raw
    }
  }
  if (current) rows.push(current)
  const inventory = rows.filter((row) => row.id && row.name)
  // 把 profile patch 的最后一层覆盖合并进来，让界面反映“重启后将要生效”的配置，
  // 而不是永远停留在启动快照上。
  const patchPath = join(runtimeProfileDir(home), 'cordis.patch.yml')
  if (existsSync(patchPath)) {
    const patchLines = readFileSync(patchPath, 'utf8').split(/\r?\n/)
    let patchId = ''
    for (const line of patchLines) {
      const id = /^\s*-\s+id:\s*(.+?)\s*$/.exec(line)
      if (id) { patchId = id[1].replace(/^['"]|['"]$/g, ''); continue }
      if (!patchId || /^\s*-/.test(line)) { patchId = ''; continue }
      const disabled = /^\s+disabled:\s*(.+?)\s*$/.exec(line)
      if (!disabled) continue
      const row = inventory.find((x) => x.id === patchId)
      if (row) {
        const raw = disabled[1]
        if (raw === 'true') row.enabled = false
        else if (raw === 'false') row.enabled = true
        else row.condition = raw
      }
      patchId = ''
    }
  }
  return inventory
}

function setRuntimePluginEnabled(id, enabled, home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  const rows = runtimePluginInventory(home)
  const row = rows.find((x) => x.id === id)
  if (!row) throw new Error('插件条目不存在')
  if (PROTECTED_PLUGIN_IDS.has(id)) throw new Error('该条目是运行时核心组件，不允许从产品界面启停')
  const dir = runtimeProfileDir(home)
  mkdirSync(dir, { recursive: true })
  const patchPath = join(dir, 'cordis.patch.yml')
  const current = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '# profile patch\n'
  const separator = current.endsWith('\n') ? '' : '\n'
  writeFileSync(patchPath, `${current}${separator}- id: ${id}\n  disabled: ${enabled ? 'false' : 'true'}\n`, 'utf8')
  return { id, enabled, restartRequired: true }
}

function ensureNativeSessionSearch() {
  const dir = runtimeProfileDir()
  mkdirSync(dir, { recursive: true })
  const patchPath = join(dir, 'cordis.patch.yml')
  let current = existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '# profile patch\n'
  if (current.includes('optional-tool-session-query')) return false
  const block = [
    '',
    '- insert:',
    '    - id: optional-session-search',
    '      name: cordis:group',
    '      group: true',
    '      isolate:',
    '        sessionQuery: true',
    '      config:',
    '        - id: optional-session-query-sqlite',
    '          name: \'@deepseek-ai/dsh-session-query-sqlite\'',
    '          config:',
    '            path: \':memory:\'',
    '            openAt: first-search',
    '        - id: optional-tool-session-query',
    '          name: \'@deepseek-ai/dsh-tool-session-query\'',
    '',
  ].join('\n')
  const separator = current.endsWith('\n') ? '' : '\n'
  writeFileSync(patchPath, `${current}${separator}${block}`, 'utf8')
  return true
}

function roleOf(req) {
  const session = sessionOf(req)
  if (!session) return roles.employee
  if (session.accountId) {
    const account = getAccount(session.accountId)
    if (account) return userOfAccount(account)
  }
  return roles[session.role] || roles.employee
}

/** MCP stdio 桥使用进程内令牌；页面请求仍按登录会话识别。 */
function mcpRequestUser(req) {
  const token = process.env.JG_MCP_TOKEN || ''
  if (token && String(req.headers['x-jg-mcp-token'] || '') === token) {
    const account = getAccount(process.env.JG_MCP_ACCOUNT || 'A-7788-01') || getAccountByRole('admin')
    if (account) return userOfAccount(account)
    return { ...roles.admin, id: 'mcp', accountId: 'mcp' }
  }
  return roleOf(req)
}

function netOf(req) {
  const net = parseCookies(req.headers.cookie).jg_net
  return networks[net] ? net : 'inet'
}

function sessionCookie(sid) {
  return `jg_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

function clearSessionCookie() {
  return 'jg_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
}

// ---------------------------------------------------------------------------
// 本地持久化：把原型的内存态集合整体快照到 SQLite；接口与页面完全不改。
// 这是 1.0 单机底座，后续替换 PostgreSQL 时只需替换这一层的实现。
// ---------------------------------------------------------------------------
function replaceArray(target, next) {
  const items = Array.isArray(next) ? next : []
  target.splice(0, target.length, ...items)
}

function replaceMap(target, next) {
  target.clear()
  if (!next || typeof next !== 'object') return
  for (const [key, value] of Object.entries(next)) target.set(key, value)
}

function replaceObject(target, next) {
  for (const key of Object.keys(target)) delete target[key]
  if (!next || typeof next !== 'object') return
  Object.assign(target, next)
}

function snapshotPersistentState() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    readNotifications: [...readNotifications.entries()],
    resources: liveResources,
    dataServices: liveDataServices,
    apps: liveApps,
    tickets: liveTickets,
    feedback: liveFeedback,
    tasks: liveTasks,
    automations: liveAutomations,
    cloudSystems: liveCloud,
    projects: liveProjects,
    pluginMarket: liveMarket,
    pluginSubs,
    marketVersions: [...marketVersions.entries()],
    pluginInstalls: [...livePluginInstalls.entries()],
    pluginToggles: [...livePluginToggles.entries()],
    officialDisabledSkills: [...liveOfficialDisabledSkills],
    officialUninstalledSkills: [...liveOfficialUninstalledSkills],
    marketInstalls: [...liveMarketInstalls.entries()],
    capabilityPolicies: [...liveCapabilityPolicies.entries()],
    cloudLog,
    drive: liveDrive,
    clouds: liveClouds,
    im: liveIm,
    notices: liveNotices,
    academy: liveAcademy,
    messages: liveMessages,
    modelConfig: [...liveModelConfig.entries()],
    runtimeSettings: { ...runtimeSettings },
    agentPresets: agentPresets.map((p) => ({ ...p })),
    toolLedger: liveToolLedger,
    versions: liveVersions,
    grants: liveGrants,
    editRequests: [...liveEditRequests.entries()],
    downloadRequests: [...liveDownloadRequests.entries()],
    resourceReads: [...resourceReads.entries()],
    resourceDownloads: [...resourceDownloads.entries()],
    duties: [...liveDuties.entries()],
    members: liveMembers,
    comments: [...liveComments.entries()],
    blockPerms: [...liveBlockPerms.entries()],
    rev: [...liveRev.entries()],
    presence: [...livePresence.entries()],
    notebooks: LIVE_NOTEBOOKS,
    notebookCollections: NOTEBOOK_COLLECTIONS,
    collabDocs: [...collabDocs.entries()],
    conversations,
    generatedDocs: [...generatedDocs.entries()].map(([id, doc]) => ({
      id,
      filename: doc.filename,
      mime: doc.mime,
      size: doc.size,
      fileId: doc.fileId || id,
      base64: doc.buffer ? Buffer.from(doc.buffer).toString('base64') : undefined,
    })),
  }
}

function hydratePersistentState() {
  // 审计单独走 SQLite 表，保证即使进程崩溃也不依赖内存数组。
  if (auditCount() === 0 && !existsSync(join(dataDirPath(), '.demo-cleared'))) {
    // auditSeed 是“最新在前”；倒序写入，让自增 id 与时间顺序一致。
    for (const item of [...auditSeed].reverse()) {
      appendAudit({ ...item, createdAt: Date.now() })
    }
  }
  const restoredAudit = latestAudit(80)
  if (restoredAudit.length) replaceArray(audit, restoredAudit)

  const snap = loadState('runtime')
  if (!snap || snap.version !== 1) return
  Object.assign(runtimeSettings, sanitizeRuntimeSettings(snap.runtimeSettings || {}))
  replaceArray(agentPresets, Array.isArray(snap.agentPresets) ? snap.agentPresets.map(sanitizeAgentPreset).filter((p) => p.name) : [])

  replaceArray(liveResources, snap.resources)
  replaceArray(liveDataServices, snap.dataServices)
  replaceArray(liveApps, snap.apps)
  replaceArray(liveTickets, snap.tickets)
  replaceArray(liveFeedback, snap.feedback)
  replaceArray(liveTasks, Array.isArray(snap.tasks) ? snap.tasks.filter((t) => t && (t.kind === 'chat-run' || t.kind === 'automation-run')) : [])
  replaceArray(liveAutomations, Array.isArray(snap.automations) ? snap.automations.filter((a) => a && a.id && a.prompt) : [])
  replaceArray(liveCloud, snap.cloudSystems)
  replaceArray(liveProjects, snap.projects)
  const persistedSubs = Array.isArray(snap.pluginSubs)
    ? snap.pluginSubs.filter((s) => s && s.id && !['SUB-01', 'SUB-02', 'SUB-03', 'SUB-04'].includes(s.id))
    : []
  replaceArray(pluginSubs, persistedSubs)
  const persistedMarket = Array.isArray(snap.pluginMarket) ? snap.pluginMarket : []
  const builtinIds = new Set(MARKET_BUILTIN.map((m) => m.id))
  const subIds = new Set(persistedSubs.map((s) => s.id))
  replaceArray(liveMarket, [
    ...MARKET_BUILTIN.map((m) => ({ ...m })),
    ...persistedMarket.filter((m) => m && m.id && m.subId && subIds.has(m.subId) && !builtinIds.has(m.id)),
  ])
  liveMarket.forEach((m, i) => { m.order = Number.isFinite(Number(m.order)) ? Number(m.order) : i })
  replaceMap(livePluginInstalls, Object.fromEntries(snap.pluginInstalls || []))
  replaceMap(livePluginToggles, Object.fromEntries(snap.pluginToggles || []))
  liveOfficialDisabledSkills.clear()
  for (const dir of snap.officialDisabledSkills || []) liveOfficialDisabledSkills.add(dir)
  liveOfficialUninstalledSkills.clear()
  for (const dir of snap.officialUninstalledSkills || []) liveOfficialUninstalledSkills.add(dir)
  replaceMap(liveMarketInstalls, Object.fromEntries(snap.marketInstalls || []))
  replaceMap(marketVersions, Object.fromEntries(snap.marketVersions || []))
  const marketIds = new Set(liveMarket.map((m) => m.id))
  for (const id of [...liveMarketInstalls.keys()]) {
    if (!marketIds.has(id)) liveMarketInstalls.delete(id)
  }
  replaceMap(liveCapabilityPolicies, Object.fromEntries(snap.capabilityPolicies || []))
  replaceArray(cloudLog, snap.cloudLog)
  replaceArray(liveDrive, snap.drive)
  replaceArray(liveClouds, snap.clouds)
  replaceArray(liveIm, snap.im)
  replaceArray(liveNotices, snap.notices)
  replaceArray(liveAcademy, snap.academy)
  replaceArray(liveMessages, snap.messages)
  replaceArray(liveToolLedger, snap.toolLedger)
  replaceArray(liveMembers, snap.members)
  replaceArray(LIVE_NOTEBOOKS, snap.notebooks)
  replaceArray(NOTEBOOK_COLLECTIONS, snap.notebookCollections)
  replaceArray(conversations, snap.conversations)

  replaceMap(readNotifications, Object.fromEntries(snap.readNotifications || []))
  replaceMap(liveModelConfig, Object.fromEntries(snap.modelConfig || []))
  replaceMap(liveEditRequests, Object.fromEntries(snap.editRequests || []))
  replaceMap(liveDownloadRequests, Object.fromEntries(snap.downloadRequests || []))
  replaceMap(resourceReads, Object.fromEntries(snap.resourceReads || []))
  replaceMap(resourceDownloads, Object.fromEntries(snap.resourceDownloads || []))
  replaceMap(liveDuties, Object.fromEntries(snap.duties || []))
  replaceMap(liveComments, Object.fromEntries(snap.comments || []))
  replaceMap(liveBlockPerms, Object.fromEntries(snap.blockPerms || []))
  replaceMap(liveRev, Object.fromEntries(snap.rev || []))
  replaceMap(livePresence, Object.fromEntries(snap.presence || []))
  replaceMap(collabDocs, Object.fromEntries(snap.collabDocs || []))

  replaceObject(liveVersions, snap.versions)
  replaceObject(liveGrants, snap.grants)

  generatedDocs.clear()
  for (const doc of snap.generatedDocs || []) {
    const fileId = doc.fileId || doc.id
    // 兼容旧快照：如果正文还在 base64 里，迁移到对象文件；新快照只存元数据。
    if (doc.base64 && !getFile(fileId)) {
      putFile({ id: fileId, name: doc.filename, mime: doc.mime, buffer: Buffer.from(doc.base64, 'base64'), net: 'inet', note: '从旧快照迁移' })
    }
    generatedDocs.set(doc.id, { filename: doc.filename, mime: doc.mime, size: doc.size, fileId })
  }
  // 文件库是文档正文的权威来源；重启后按元数据重建内存索引。
  for (const item of listFiles({ prefix: 'DOC-' })) {
    if (!generatedDocs.has(item.id)) {
      generatedDocs.set(item.id, { filename: item.name, mime: item.mime, size: item.size, fileId: item.id })
    }
  }
}

function persistPersistentState() {
  try {
    saveState('runtime', snapshotPersistentState())
  } catch (err) {
    console.error('[jg-server] persist failed:', err && err.message ? err.message : err)
  }
}

/** 资源可见性 = 网络目录匹配 + 角色范围匹配；secret 级别需显式授权 */
function canSee(user, resource, net) {
  if (resource.nets && !resource.nets.includes(net)) return false
  if (resource.security === 'secret' && !(net === 'secret' && user.scopes.includes('secret'))) return false
  if (user.scopes.includes('all-org')) return true
  return resource.scope.some((scope) => user.scopes.includes(scope))
}

function canManage(user) {
  return user.visibleModules.includes('admin')
}

function userDepartments(user) {
  return orgUnits.flatMap((u) => u.departments || []).filter((d) => d.head === user.name)
}

function canEditResource(user, resource) {
  if (user.id === 'guest') return false
  if (canManage(user)) return true
  const owner = resource?.dataStandard?.dataOwner || resource?.contact || ''
  if (owner && owner === user.name) return true
  const dept = userDepartments(user).find((d) => d.name === resource.owner)
  return !!dept
}

function canApproveEdit(user) {
  return canManage(user) || dutiesOf(user).includes('dataAdmin')
}

const CATEGORY_MERGE = {
  综合部: '企业经营管理',
  市场部: '企业经营管理',
  财务部: '企业经营管理',
  监察部: '企业经营管理',
  董事会: '企业经营管理',
}

const OWNER_CATEGORY = {
  '规划一所': '规划',
  '国土空间规划所': '规划',
  '测绘地理信息中心': '测绘',
  '经营管理部': '企业经营管理',
  '综合办公室': '企业经营管理',
  '智数中心': '企业经营管理',
  '财务部': '企业经营管理',
  '监察部': '企业经营管理',
  '董事会办公室': '企业经营管理',
  '图文中心': '其他',
}

function categoryKey(value) {
  return String(value || '').replace(/（法人单位）/g, '').replace(/（控股子公司）/g, '').trim()
}

function normalizeBusinessCategory(value) {
  const key = categoryKey(value)
  return CATEGORY_MERGE[key] || key || '其他'
}

function businessCategoryOf(resource) {
  return normalizeBusinessCategory(resource?.dataStandard?.businessCategory || resource?.aiMeta?.domain || OWNER_CATEGORY[resource?.owner] || '其他')
}

/** 外部访客默认不读企业数据：以下接口按模块判定，管理员按模块授权后才放行 */
const GUEST_GUARD = {
  'GET /api/datacenter/overview': 'datacenter',
  'GET /api/resources': 'datacenter',
  'POST /api/resources/register': 'datacenter',
  'POST /api/resources/approval': 'datacenter',
  'POST /api/resources/edit': 'datacenter',
  'POST /api/resources/edit-approval': 'datacenter',
  'POST /api/resources/download': 'datacenter',
  'POST /api/spatial/recognize': 'datacenter',
  'GET /api/resource': 'datacenter',
  'GET /api/spatial': 'datacenter',
  'GET /api/imagery': 'datacenter',
  'GET /api/satellite': 'datacenter',
  'GET /api/knowledge': 'knowledge',
  'GET /api/notebooks': 'knowledge',
  'POST /api/notebooks': 'knowledge',
  'POST /api/notebook/manage': 'knowledge',
  'GET /api/notebook': 'knowledge',
  'POST /api/notebook/source': 'knowledge',
  'POST /api/notebook/note': 'knowledge',
  'POST /api/notebook/ask': 'knowledge',
  'POST /api/notebook/sync': 'knowledge',
  'POST /api/notebook/vote': 'knowledge',
  'POST /api/drive/comment': 'drive',
  'POST /api/drive/comment-resolve': 'drive',
  'POST /api/drive/block-perm': 'drive',
  'GET /api/drive/presence': 'drive',
  'GET /api/drive/diff': 'drive',
  'GET /api/drive': 'drive',
  'GET /api/drive/item': 'drive',
  'POST /api/drive/share': 'drive',
  'POST /api/drive/apply': 'drive',
  'POST /api/drive/delete': 'drive',
  'POST /api/drive/update': 'drive',
  'GET /api/contacts': 'contacts',
  'GET /api/im': 'im',
  'GET /api/im/files': 'im',
  'GET /api/im/search': 'im',
  'POST /api/im/attach': 'im',
  'POST /api/im/send': 'im',
  'POST /api/im/ai': 'im',
  'POST /api/im/online': 'im',
  'POST /api/im/member': 'im',
  'GET /api/messages': 'notice',
  'POST /api/messages/read': 'notice',
  'GET /api/resource/versions': 'datacenter',
  'POST /api/resource/version': 'datacenter',
  'POST /api/resource/grant': 'datacenter',
  'GET /api/dataservices': 'datacenter',
  'GET /api/org': 'admin',
  'POST /api/org/duty': 'admin',
  'GET /api/tool-ledger': 'admin',
  'POST /api/tool-ledger': 'admin',
  'GET /api/security': 'admin',
  'GET /api/notices': 'notice',
  'POST /api/notices/read': 'notice',
  'POST /api/notices/publish': 'notice',
  'GET /api/academy': 'academy',
  'POST /api/academy/progress': 'academy',
  'GET /api/tasks': 'tasks',
  'POST /api/tasks/create': 'tasks',
  'POST /api/tasks/retry': 'tasks',
  'GET /api/projects': 'projects',
  'POST /api/settings': 'home',
  'POST /api/images/generate': 'home',
  'GET /api/images/file': 'home',
  'GET /api/agent-presets': 'home',
  'POST /api/agent-presets': 'home',
  'DELETE /api/agent-presets': 'home',
  'GET /api/runtime/plugins': 'home',
  'POST /api/runtime/plugins': 'home',
  'GET /api/runtime/bundles': 'home',
  'POST /api/runtime/bundles': 'home',
  'POST /api/runtime/bundles/install': 'home',
  'POST /api/runtime/restart': 'home',
  'GET /api/mcp/resources': 'home',
  'GET /api/mcp/resource': 'home',
  'POST /api/projects/create': 'projects',
  'POST /api/projects/verify': 'projects',
  'GET /api/conversations': 'home',
  'GET /api/conversation': 'home',
  'GET /api/conversation/export': 'home',
  'GET /api/conversation/trace': 'home',
  'GET /api/conversation/session-log': 'home',
  'POST /api/conversation/fork': 'home',
  'GET /api/visuals': 'home',
  'GET /api/visuals/versions': 'home',
  'POST /api/visuals/save': 'home',
  'POST /api/visuals/restore': 'home',
  'POST /api/terminal/exec': 'admin',
  'GET /api/terminal': 'admin',
  'POST /api/terminal/reset': 'admin',
  'GET /api/files/tree': 'home',
  'GET /api/files/content': 'home',
  'GET /api/files/raw': 'home',
  'GET /api/speech/catalog': 'home',
  'POST /api/speech/prepare': 'admin',
  'POST /api/speech/transcribe': 'home',
  'POST /api/tts': 'home',
  'GET /api/tts/audio': 'home',
  'POST /api/conversation/job/kill': 'home',
  'POST /api/conversation/policy': 'home',
  'POST /api/conversation/feedback': 'home',
  'GET /api/plugins': 'skills',
  'POST /api/plugin-toggle': 'skills',
  'GET /api/plugin-review': 'admin',
  'POST /api/plugins/review': 'admin',
  'GET /api/audit': 'admin',
  'GET /api/approval-decisions': 'admin',
  'GET /api/monitor': 'admin',
  'GET /api/tickets': 'admin',
  'POST /api/tickets/create': 'admin',
  'POST /api/tickets/action': 'admin',
  'GET /api/feedback': 'admin',
  'POST /api/feedback/create': 'admin',
  'POST /api/ai/invoke': 'ai',
  'POST /api/mcp/approval': 'ai',
  'GET /api/apps': 'apps',
}

function guestBlock(user, key) {
  if (user.id !== 'guest') return null
  const module = GUEST_GUARD[key]
  if (!module) return null
  const granted = Array.isArray(user.grants) ? user.grants : []
  if (granted.includes(module)) return null
  return module
}

function logAudit(user, action, object, result, net = 'inet') {
  const entry = {
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    actor: user.name,
    action,
    object,
    result,
    net: networks[net] ? networks[net].label : net,
  }
  audit.unshift(entry)
  if (audit.length > 80) audit.pop()
  try {
    appendAudit({ ...entry, createdAt: Date.now() })
  } catch (err) {
    console.error('[jg-server] audit persist failed:', err && err.message ? err.message : err)
  }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 设备标识用于“项目 → 本地设备 → 授权目录”的绑定关系。
// 当前产品为单机桌面部署，服务端与客户端同机；远程部署时该标识应改由本地 Host 上报。
function deviceId() {
  const file = join(dataDirPath(), 'device.json')
  try {
    if (existsSync(file)) {
      const saved = JSON.parse(readFileSync(file, 'utf8'))
      if (saved && saved.id) return String(saved.id)
    }
  } catch {}
  const id = `DEV-${randomBytes(6).toString('hex')}`
  try { writeFileSync(file, JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2)) } catch {}
  return id
}

function projectDirInfo(input) {
  const raw = String(input || '').trim()
  if (!raw) return { error: '请选择项目本地文件夹' }
  if (!isAbsolute(raw)) return { error: '项目文件夹必须是绝对路径' }
  try {
    const cwd = realpathSync(raw)
    const stat = statSync(cwd)
    if (!stat.isDirectory()) return { error: '项目路径不是文件夹' }
    return { cwd, folderName: basename(cwd) }
  } catch (error) {
    return { error: `项目文件夹不可用：${error?.code || error?.message || error}` }
  }
}

function projectStatus(item) {
  if (!item?.cwd) return 'unbound'
  if (item.deviceId && item.deviceId !== deviceId()) return 'other-device'
  try {
    return statSync(item.cwd).isDirectory() ? 'online' : 'missing'
  } catch {
    return 'missing'
  }
}

function decorateProject(item) {
  const status = projectStatus(item)
  let rootFiles = 0
  if (item.cwd) {
    try {
      rootFiles = readdirSync(item.cwd, { withFileTypes: true }).filter((entry) => entry.isFile()).length
    } catch {}
  }
  return {
    ...item,
    status,
    folderName: item.folderName || (item.cwd ? basename(item.cwd) : ''),
    convs: conversations.filter((conv) => conv.projectId === item.id).length,
    files: rootFiles,
  }
}

function findProjectByDir(user, dir, excludeId = '') {
  const dev = deviceId()
  return liveProjects.find((p) => p.id !== excludeId && !p.removed && p.owner === user.name && p.deviceId === dev && p.cwd === dir)
}

function chatWorkspaceDir(user, convId) {
  const dir = join(dataDirPath(), 'dsh-workspaces', 'chat', String(user.id || 'user'), String(convId))
  mkdirSync(dir, { recursive: true })
  ensureWorkspaceAcl(dir)
  return dir
}

/**
 * DSH 的 Windows workspace-write 沙箱会在会话开始时给工作区目录追加 capability ACE，
 * 这要求目标目录对当前用户开放 WRITE_DAC。默认继承的 Modify 权限不含 WRITE_DAC，
 * 会让 run_code / pwsh 以 Win32 5 启动失败并被迫申请 danger-full-access。
 * 这里只给当前登录用户本人补显式完全控制，目录仍只对本人开放。
 */
function ensureWorkspaceAcl(dir) {
  if (process.platform !== 'win32') return
  const account = process.env.USERNAME || ''
  if (!account) return
  try {
    spawnSync('icacls', [dir, '/grant', `${account}:(OI)(CI)F`], {
      windowsHide: true,
      timeout: 15000,
      stdio: 'ignore',
    })
  } catch {}
}


// 项目可见/可执行：沿用列表的归属口径，但执行前必须再校验一次。
function projectVisibleTo(user, item) {
  return Boolean(item) && !item.removed && (
    canManage(user) || item.scope === 'all-org' || (item.scope || '').endsWith(user.unit || '\u0000') || item.owner === user.name
  )
}

function projectRunnableBy(user, item) {
  if (!projectVisibleTo(user, item)) return { ok: false, code: 'PROJECT_FORBIDDEN', error: '无权使用该项目' }
  if (!item.cwd) return { ok: false, code: 'PROJECT_DIR_REQUIRED', error: '该项目还没有绑定本地文件夹' }
  if (item.deviceId && item.deviceId !== deviceId()) {
    return { ok: false, code: 'PROJECT_DEVICE_MISMATCH', error: '该项目绑定在另一台设备上，请在该设备连接后再执行' }
  }
  return { ok: true }
}

const FILE_TREE_SKIP = new Set(['.git', 'node_modules', '.jg', '.dsh', 'dist', 'out', '.next', 'coverage', '.turbo'])
const FILE_TEXT_EXT = new Set(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.htm', '.yml', '.yaml', '.xml', '.csv', '.log', '.ini', '.toml', '.ps1', '.bat', '.cmd', '.py', '.java', '.go', '.rs', '.c', '.h', '.cpp', '.sql', '.sh'])
const FILE_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'])
const FILE_RAW_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.pdf': 'application/pdf' }

function isInsidePath(root, target) {
  const r = root.toLowerCase().replace(/[\\/]+$/, '')
  const t = target.toLowerCase()
  return t === r || t.startsWith(r + sep) || t.startsWith(r + '/')
}

/**
 * 解析文件浏览请求的工作根目录。项目必须仍对当前账号可见；会话必须属于当前账号。
 * 所有相对路径随后都经过真实路径校验，防止 ../ 与符号链接越界。
 */
function resolveFileRoot(user, url) {
  const projectId = String(url.searchParams.get('projectId') || '').trim()
  const conversationId = String(url.searchParams.get('conversationId') || '').trim()
  if (projectId) {
    const project = liveProjects.find((p) => p.id === projectId && !p.removed)
    if (!project || !projectVisibleTo(user, project)) return { error: '无权浏览该项目文件', status: 403 }
    if (!project.cwd) return { error: '该项目还没有绑定本地文件夹', status: 409 }
    if (project.deviceId && project.deviceId !== deviceId()) return { error: '该项目绑定在另一台设备上', status: 409 }
    if (!existsSync(project.cwd)) return { error: '项目目录当前不可访问', status: 404 }
    return { root: realpathSync(project.cwd), label: project.name, kind: 'project' }
  }
  if (conversationId) {
    const conv = (conversations || []).find((c) => c.id === conversationId && !c.removed)
    if (!conv) return { error: '会话不存在', status: 404 }
    if (conversationOwnerId(conv) !== String(user.id || 'admin') && !canManage(user)) return { error: '无权浏览该会话文件', status: 403 }
    const root = conv.agentCwd || chatWorkspaceDir(user, conv.id)
    if (!existsSync(root)) return { error: '会话目录当前不可访问', status: 404 }
    return { root: realpathSync(root), label: conv.title || conv.id, kind: 'conversation' }
  }
  return { error: '缺少 projectId 或 conversationId', status: 400 }
}

function safeFilePath(root, rel) {
  const raw = String(rel || '').replace(/\\/g, '/')
  const target = normalize(join(root, raw || '.'))
  if (!isInsidePath(root, target)) return { error: '路径越界' }
  if (!existsSync(target)) return { error: '文件或目录不存在', status: 404 }
  let real
  try { real = realpathSync(target) } catch { return { error: '文件或目录不可访问', status: 404 } }
  if (!isInsidePath(root, real)) return { error: '路径越界', status: 403 }
  return { path: real, rel: relative(root, real).split(sep).join('/') }
}

function gitAt(cwd, args, timeout = 15000) {
  try {
    const result = spawnSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
    })
    return {
      ok: result.status === 0 && !result.error,
      status: result.status,
      stdout: String(result.stdout || '').trim(),
      stderr: String(result.stderr || '').trim(),
      error: result.error ? String(result.error.message || result.error) : '',
    }
  } catch (error) {
    return { ok: false, status: -1, stdout: '', stderr: '', error: String(error?.message || error) }
  }
}

function parseWorktreePorcelain(text) {
  const blocks = String(text || '').split(/\r?\n\r?\n/).map((x) => x.trim()).filter(Boolean)
  return blocks.map((block) => {
    const item = { path: '', head: '', branch: '', detached: false, bare: false, locked: '', prunable: false }
    for (const line of block.split(/\r?\n/)) {
      const [key, ...rest] = line.split(' ')
      const value = rest.join(' ')
      if (key === 'worktree') item.path = value
      else if (key === 'HEAD') item.head = value
      else if (key === 'branch') item.branch = value.replace(/^refs\/heads\//, '')
      else if (key === 'detached') item.detached = true
      else if (key === 'bare') item.bare = true
      else if (key === 'locked') item.locked = value || 'locked'
      else if (key === 'prunable') item.prunable = true
    }
    return item
  }).filter((item) => item.path)
}

function worktreeStatus(path) {
  const status = gitAt(path, ['status', '--porcelain=v1', '--branch'], 8000)
  if (!status.ok) return { dirty: 0, ahead: 0, behind: 0, statusError: status.error || status.stderr || `git status 退出 ${status.status}` }
  const lines = status.stdout.split(/\r?\n/).filter(Boolean)
  const head = lines.find((line) => line.startsWith('## ')) || ''
  const dirty = lines.filter((line) => !line.startsWith('## ')).length
  const ahead = Number((/ahead (\d+)/.exec(head) || [])[1] || 0)
  const behind = Number((/behind (\d+)/.exec(head) || [])[1] || 0)
  return { dirty, ahead, behind, branchLine: head }
}

function projectWorktreeInfo(user, projectId) {
  const project = liveProjects.find((p) => p.id === projectId && !p.removed)
  if (!project || !projectVisibleTo(user, project)) return { error: '无权查看该项目工作树', status: 403 }
  if (!project.cwd) return { error: '该项目还没有绑定本地文件夹', status: 409 }
  if (project.deviceId && project.deviceId !== deviceId()) return { error: '该项目绑定在另一台设备上', status: 409 }
  if (!existsSync(project.cwd)) return { error: '项目目录当前不可访问', status: 404 }
  const cwd = realpathSync(project.cwd)
  const inside = gitAt(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok) {
    return { project, cwd, repo: false, note: '当前项目不是 Git 仓库，无法创建工作树；请先在项目目录初始化 Git。' }
  }
  const list = gitAt(cwd, ['worktree', 'list', '--porcelain'])
  if (!list.ok) return { error: list.error || list.stderr || '读取 Git 工作树失败', status: 502 }
  const parsed = parseWorktreePorcelain(list.stdout)
  const items = parsed.map((item, index) => {
    const status = worktreeStatus(item.path)
    return {
      ...item,
      path: item.path,
      exists: existsSync(item.path),
      main: index === 0,
      dirty: status.dirty,
      ahead: status.ahead,
      behind: status.behind,
      statusError: status.statusError || '',
    }
  })
  const current = gitAt(cwd, ['branch', '--show-current'])
  const branchList = gitAt(cwd, ['for-each-ref', 'refs/heads', '--format=%(refname:short)'])
  const attached = new Set(items.map((item) => item.branch).filter(Boolean))
  const branches = branchList.ok
    ? branchList.stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean).map((name) => ({
      name,
      current: name === current.stdout,
      orphan: !attached.has(name),
    }))
    : []
  return {
    project, cwd, repo: true, items, branches,
    note: items.length > 1 ? `共 ${items.length} 个工作树，主工作树为 ${items[0]?.path || cwd}` : '当前只有主工作树，尚无隔离工作树。',
  }
}

function projectFileTree(root, rel, depth = 1) {
  const safe = safeFilePath(root, rel)
  if (safe.error) return safe
  if (!statSync(safe.path).isDirectory()) return { error: '不是目录', status: 400 }
  const entries = []
  let truncated = false
  const list = readdirSync(safe.path, { withFileTypes: true })
    .filter((entry) => !FILE_TREE_SKIP.has(entry.name))
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name, 'zh-CN') : a.isDirectory() ? -1 : 1))
  for (const entry of list) {
    if (entries.length >= 500) { truncated = true; break }
    const full = join(safe.path, entry.name)
    let stat
    try { stat = statSync(full) } catch { continue }
    const item = {
      name: entry.name,
      path: relative(root, full).split(sep).join('/'),
      type: stat.isDirectory() ? 'dir' : 'file',
      size: stat.isDirectory() ? 0 : stat.size,
      ext: stat.isDirectory() ? '' : extname(entry.name).toLowerCase(),
      mtime: stat.mtimeMs,
    }
    if (stat.isDirectory() && depth > 1) {
      const child = projectFileTree(root, item.path, depth - 1)
      if (!child.error) item.children = child.entries
    }
    entries.push(item)
  }
  return { path: safe.rel, entries, truncated }
}


// 会话归属：历史会话没有 userId 时归管理员，避免普通账号读取旧会话。
function conversationOwnerId(item) {
  return String(item?.userId || 'admin')
}

function conversationAllowed(user, item) {
  return Boolean(item) && (canManage(user) || conversationOwnerId(item) === String(user.id))
}

function clipText(value, max = 800) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** 审批卡需要的“操作 + 资源 + 参数”摘要；approval/request 本身只带 tool/reason/callId。 */
function approvalDetails(params, extra = {}) {
  const toolName = String(params?.toolNameResolved || params?.toolName || '工具调用')
  let args = {}
  try { args = JSON.parse(String(params?.toolArgs || '{}')) || {} } catch {}
  const resource = String(args.path || args.file_path || args.filePath || args.cwd || args.directory || args.dir || extra.target || '')
  const summary = extra.summary || summarizeToolCall(toolName, args)
  return {
    toolName,
    callId: String(params?.callId || ''),
    reason: String(params?.reason || ''),
    resource,
    summary: summary || '未提供可展示的参数',
    externalSideEffect: isExternalSideEffectTool(toolName),
    arguments: clipText(params?.toolArgs || '', 900),
    operation: String(extra.operation || ''),
    risk: String(extra.risk || ''),
    rule: String(extra.rule || ''),
    decisionId: String(extra.decisionId || ''),
  }
}

/** 结构化审批决策：工具、参数摘要、命中规则、风险级别、放行人、时间。 */
function recordApprovalDecision(entry = {}) {
  const decisionId = String(entry.decisionId || `APD-${randomBytes(6).toString('hex')}`)
  try {
    appendApprovalDecision({
      decisionId,
      conversationId: entry.conversationId || '',
      callId: entry.callId || '',
      tool: entry.tool || '',
      operation: entry.operation || '',
      argsSummary: clipText(entry.summary || '', 500),
      decision: entry.decision || '',
      rule: entry.rule || '',
      risk: entry.risk || '',
      actor: entry.actor || '',
      approver: entry.approver || '',
      net: entry.net || 'inet',
      time: new Date().toISOString(),
      createdAt: Date.now(),
      decidedAt: entry.decision && entry.decision !== 'pending' ? Date.now() : 0,
    })
  } catch (err) {
    console.error('[jg-server] approval decision persist failed:', err && err.message ? err.message : err)
  }
  return decisionId
}

const HIGH_RISK_REQUEST_PATTERNS = [
  /remove-item[\s\S]*-recurse/i,
  /\brm\s+-[a-z]*r[a-z]*f/i,
  /\brmdir\s+\/s/i,
  /\brd\s+\/s/i,
  /\bdel\s+\/[fsq]/i,
  /\bformat\s+[a-z]:/i,
  /\bdiskpart\b/i,
  /\bshutdown\b/i,
  /\breg\s+delete\b/i,
  /\btaskkill\b[\s\S]*\/f/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+push\b/i,
  /\b(?:npm|pnpm|yarn)\s+publish\b/i,
  /\b(?:npm|pnpm|yarn)\s+(?:install|add)\b/i,
  /\b(?:pip|pip3)\s+install\b/i,
  /\b(?:curl|wget|invoke-webrequest|iwr)\b/i,
  /\b(?:docker\s+(?:rm|rmi|push)|kubectl\s+delete|sc\s+delete|reg\s+(?:add|delete)|takeown|icacls)\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\s+table\b/i,
]

/** Auto 模式不接受用户直接下达的高风险删除/覆盖命令；这类操作必须切到 Manual 逐次审批。 */
function explicitHighRiskRequest(text) {
  const source = String(text || '')
  return HIGH_RISK_REQUEST_PATTERNS.some((pattern) => pattern.test(source))
}

/** Auto Task Router：规则优先，只有出现明确的文件、命令、数据处理或多步骤意图才升级到 Work。 */
const WORK_INTENT_PATTERNS = [
  /(创建|新建|生成|写入|保存|修改|编辑|删除|移动|复制|重命名|导出|转换)[^。\n]{0,24}(文件|文档|表格|目录|文件夹|代码|脚本|图片|报告|PPT|Word|Excel|CSV|Markdown|md)/i,
  /(运行|执行|跑一下|编译|构建|安装|部署|测试)[^。\n]{0,24}(命令|脚本|代码|程序|项目|服务|测试|构建)/i,
  /(分析|处理|整理|统计|汇总|清洗|合并|拆分)[^。\n]{0,24}(数据|表格|文件|日志|CSV|Excel)/i,
  /(批量|遍历|扫描|自动化|多步骤|工作流)/i,
  /(打包|压缩|构建|编译|部署|安装|发布|上传|下载|迁移|备份|恢复|做成[^。\n]{0,12}插件|插件[^。\n]{0,12}上传)/i,
  /\b(?:npm|pnpm|node|python|pip|git|pwsh|powershell|bash|apply_patch)\b/i,
  /```/,
]

function resolveTaskMode(text, requested, projectId) {
  const mode = ['auto', 'chat', 'work'].includes(String(requested || '')) ? String(requested) : 'auto'
  if (mode === 'chat') return { requested: 'chat', mode: 'chat', reason: '用户手动指定对话模式' }
  if (mode === 'work') return { requested: 'work', mode: 'work', reason: '用户手动指定工作模式' }
  // 项目会话本身绑定了一个真实工作区；Auto 不应把它降格为只读问答，
  // 否则打包、构建、写文件会在执行中被只读沙箱静默拒绝。
  if (projectId) return { requested: 'auto', mode: 'work', reason: '已绑定项目工作区，按工作模式执行' }
  const hits = WORK_INTENT_PATTERNS.filter((pattern) => pattern.test(String(text || ''))).length
  if (hits > 0) {
    return {
      requested: 'auto',
      mode: 'work',
      reason: projectId ? '检测到文件、命令或数据处理意图，已绑定项目' : '检测到文件、命令或数据处理意图',
    }
  }
  return { requested: 'auto', mode: 'chat', reason: '未检测到文件、命令或多步骤执行意图' }
}

/** 外部副作用工具：即使没有命令或路径参数，也不能在 Auto 模式自动放行。 */
const AUTO_APPROVAL_EXTERNAL_TOOL = [
  /mcp__[a-z0-9_-]+__im_send/i,
  /mcp__[a-z0-9_-]+__task_create/i,
  /mcp__[a-z0-9_-]+__(?:send|publish|upload|create|update|delete|remove|invoke|write)[a-z0-9_-]*/i,
  /^im_send$/i,
  /^task_create$/i,
]
function isExternalSideEffectTool(tool) {
  const name = String(tool || '')
  return AUTO_APPROVAL_EXTERNAL_TOOL.some((pattern) => pattern.test(name))
}

/** 审批卡元数据：DSH 已决定是否升级审批，这里只生成操作类型、风险级别和参数摘要。 */
function describeToolApproval(params) {
  const tool = String(params?.toolNameResolved || params?.toolName || '')
  const rawArgs = String(params?.toolArgs || '')
  const reason = String(params?.reason || '').replace(/\s+/g, ' ').trim()
  const described = describeToolCall({
    tool,
    args: rawArgs || '{}',
    isExternalSideEffect: isExternalSideEffectTool(tool),
  })
  // PTC 的嵌套工具审批只带 toolName/reason，不带嵌套参数；把原因落进参数摘要，
  // 至少让审批卡和 approval_decisions 能看出这次调用的目的与目标。
  if (!rawArgs && reason) {
    described.summary = `审批原因：${reason.length > 300 ? `${reason.slice(0, 300)}…` : reason}`
    // PTC 嵌套工具不带参数时，只能从 DSH 的升级原因判断风险；凡是申请放宽沙箱的，
    // 展示为 high，避免“工作区外写入”被按普通 write 记成 medium。
    if (/danger-full-access|workspace-write|工作区外|escalat/i.test(reason)) described.risk = 'high'
  }
  return described
}

/** 把可能尚不存在的路径解析到最近的已存在父目录真实路径，防止符号链接越界。 */
function canonicalPath(input) {
  let current = normalize(String(input || ''))
  const tail = []
  while (true) {
    try {
      const real = realpathSync(current)
      return normalize(join(real, ...tail.reverse()))
    } catch {
      const parent = dirname(current)
      if (parent === current || !parent) return normalize(String(input || ''))
      tail.push(basename(current))
      current = parent
    }
  }
}

/** 判断文件是否在某个根目录内（先按字符串，再按真实路径防符号链接越权）。 */
function pathInside(child, rootDir) {
  const c = normalize(String(child || ''))
  const r = normalize(String(rootDir || ''))
  if (!r) return false
  const textInside = c === r || c.toLowerCase().startsWith(`${r.toLowerCase()}${sep}`)
  if (!textInside) return false
  const realChild = canonicalPath(c)
  const realRoot = canonicalPath(r)
  const lowerChild = realChild.toLowerCase()
  const lowerRoot = realRoot.toLowerCase()
  return lowerChild === lowerRoot || lowerChild.startsWith(`${lowerRoot}${sep}`)
}

const MCP_MAX_RESOURCES = 80
const MCP_FILE_EXTS = new Set(['.md', '.txt', '.json', '.csv', '.log', '.yml', '.yaml', '.mjs', '.js', '.ps1', '.sql', '.html', '.css'])
/** MCP 资源目录：数据中心资源、通知公告与当前身份可见的项目文件。 */
function mcpCatalog(user, net, q = '') {
  const term = String(q || '').trim().toLowerCase()
  const items = []
  for (const r of liveResources) {
    if (!canSee(user, r, net)) continue
    if (term && !`${r.name}${r.desc}${(r.tags || []).join('')}`.toLowerCase().includes(term)) continue
    items.push({
      uri: `jg://resource/${r.id}`,
      name: r.name,
      description: r.desc || '数据中心资源',
      mimeType: 'application/json',
      source: 'jg',
      type: '数据资源',
      security: r.security,
      updated: r.updated,
    })
  }
  for (const n of liveNotices) {
    if (term && !`${n.title}${n.summary}${n.category}`.toLowerCase().includes(term)) continue
    items.push({
      uri: `jg://notice/${n.id}`,
      name: n.title,
      description: n.summary || '通知公告',
      mimeType: 'application/json',
      source: 'jg',
      type: '通知公告',
      security: 'internal',
      updated: n.time,
    })
  }
  for (const project of liveProjects) {
    if (items.length >= MCP_MAX_RESOURCES) break
    if (project.removed || !project.cwd || !projectVisibleTo(user, project)) continue
    const tree = snapshotTree(project.cwd)
    for (const [rel, meta] of tree) {
      if (items.length >= MCP_MAX_RESOURCES) break
      const ext = extname(rel).toLowerCase()
      if (!MCP_FILE_EXTS.has(ext)) continue
      if (term && !`${project.name}${rel}`.toLowerCase().includes(term)) continue
      items.push({
        uri: `jg://project/${project.id}/${rel.split('/').map(encodeURIComponent).join('/')}`,
        name: `${project.name} · ${basename(rel)}`,
        description: rel,
        mimeType: ext === '.md' ? 'text/markdown' : ext === '.json' ? 'application/json' : ext === '.html' ? 'text/html' : 'text/plain',
        source: 'jg',
        type: '项目文件',
        security: 'project',
        updated: meta?.mtimeMs ? new Date(meta.mtimeMs).toISOString() : '',
      })
    }
  }
  return {
    server: { name: 'jg', transport: 'stdio', status: 'connected', tools: 10, resources: items.length },
    items: items.slice(0, MCP_MAX_RESOURCES),
  }
}

function readMcpResource(user, net, uri) {
  const raw = String(uri || '')
  const resource = /^jg:\/\/resource\/(.+)$/.exec(raw)
  if (resource) {
    const item = liveResources.find((r) => r.id === resource[1])
    if (!item || !canSee(user, item, net)) return null
    return {
      uri: raw,
      mimeType: 'application/json',
      text: JSON.stringify({
        id: item.id, name: item.name, description: item.desc, type: item.type,
        security: item.security, scope: item.scope, owner: item.owner,
        updated: item.updated, tags: item.tags || [], extent: item.extent || '',
      }, null, 2),
    }
  }
  const notice = /^jg:\/\/notice\/(.+)$/.exec(raw)
  if (notice) {
    const item = liveNotices.find((n) => n.id === notice[1])
    if (!item) return null
    return {
      uri: raw,
      mimeType: 'application/json',
      text: JSON.stringify({
        id: item.id, title: item.title, category: item.category, dept: item.dept,
        author: item.author, time: item.time, body: item.body,
      }, null, 2),
    }
  }
  const projectFile = /^jg:\/\/project\/([^/]+)\/(.+)$/.exec(raw)
  if (projectFile) {
    const project = liveProjects.find((p) => p.id === projectFile[1] && !p.removed)
    if (!project || !project.cwd || !projectVisibleTo(user, project)) return null
    let rel = ''
    try { rel = decodeURIComponent(projectFile[2]) } catch { return null }
    const full = join(project.cwd, rel.split('/').join(sep))
    if (!pathInside(full, project.cwd) || !existsSync(full)) return null
    let stat
    try { stat = statSync(full) } catch { return null }
    if (!stat.isFile()) return null
    const ext = extname(full).toLowerCase()
    if (!MCP_FILE_EXTS.has(ext)) return null
    let text = ''
    try { text = readFileSync(full, 'utf8') } catch { return null }
    if (text.length > 200000) text = `${text.slice(0, 200000)}\n…（已截断，原文件 ${stat.size} 字节）`
    return {
      uri: raw,
      mimeType: ext === '.md' ? 'text/markdown' : ext === '.json' ? 'application/json' : 'text/plain',
      text,
    }
  }
  return null
}

const TREE_SKIP_DIRS = new Set(['.git', 'node_modules', '.jg', '.dsh', 'dist', 'out', '.next', 'coverage'])
const TREE_MAX_FILES = 4000
const TREE_MAX_DEPTH = 6

/** 只读扫描工作目录的 size + mtime，作为“本轮文件变更”前后对照；不读取文件内容。 */
function snapshotTree(rootDir) {
  const snap = new Map()
  if (!rootDir || !existsSync(rootDir)) return snap
  const stack = [[rootDir, 0]]
  let count = 0
  while (stack.length && count < TREE_MAX_FILES) {
    const [dir, depth] = stack.pop()
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (count >= TREE_MAX_FILES) break
      if (entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth >= TREE_MAX_DEPTH || TREE_SKIP_DIRS.has(entry.name.toLowerCase())) continue
        stack.push([full, depth + 1])
        continue
      }
      if (!entry.isFile()) continue
      let st
      try { st = statSync(full) } catch { continue }
      const rel = full.slice(rootDir.length + 1).split(sep).join('/')
      snap.set(rel, { size: st.size, mtimeMs: st.mtimeMs, abs: full })
      count += 1
    }
  }
  return snap
}

function formatBytes(n) {
  const size = Math.max(0, Number(n) || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** 对比前后快照，返回最多 30 条新增/修改/删除，供每轮回复展示。 */
function diffTree(before, after, rootDir) {
  const changes = []
  for (const [rel, cur] of after) {
    const old = before.get(rel)
    if (!old) {
      changes.push({ path: cur.abs, rel, change: 'added', size: cur.size })
    } else if (old.size !== cur.size || old.mtimeMs !== cur.mtimeMs) {
      changes.push({ path: cur.abs, rel, change: 'modified', size: cur.size, delta: cur.size - old.size })
    }
  }
  for (const [rel, old] of before) {
    if (after.has(rel)) continue
    changes.push({ path: join(rootDir, rel), rel, change: 'removed', size: old.size })
  }
  return changes.slice(0, 30)
}

/** 把一条会话导出为可读 Markdown，保留执行步骤、文件变更和交付物。 */
function conversationMarkdown(c) {
  const lines = [
    `# ${c.title || '未命名会话'}`,
    '',
    `- 会话 ID：${c.id}`,
    `- 时间：${c.time || '—'}`,
    `- 模型：${c.model || '—'}`,
    `- 轮次：${c.turns || 0}`,
    `- 执行策略：${c.executionPolicy === 'manual' ? '请求批准' : '帮我批准'}`,
    `- 项目：${c.projectId || '无（普通对话）'}`,
    '',
  ]
  let turn = 0
  for (const m of (c.messages || [])) {
    if (m.role === 'user') {
      turn += 1
      lines.push(`## 第 ${turn} 轮 · 用户`, '', String(m.text || ''), '')
      continue
    }
    lines.push('### 助手', '', String(m.text || ''), '')
    if (Array.isArray(m.subagents) && m.subagents.length) {
      lines.push('#### 子代理', '')
      for (const s of m.subagents) {
        lines.push(`- ${s.provider || '子代理'} · ${s.status || 'ok'}${s.stopReason ? ` · ${s.stopReason}` : ''} · \`${s.childSessionId || ''}\``)
        if (s.output) {
          for (const line of String(s.output).split(/\r?\n/)) lines.push(`  ${line}`)
        }
      }
      lines.push('')
    }
    if (Array.isArray(m.workflows) && m.workflows.length) {
      lines.push('#### 工作流', '')
      for (const w of m.workflows) {
        lines.push(`- **${w.name || '工作流'}** · ${w.status || 'running'}${w.stopReason ? ` · ${w.stopReason}` : ''}`)
        for (const node of (w.members || [])) {
          lines.push(`  - [${node.phase || '未分阶段'}] ${node.label || `节点 ${node.seq}`} · ${node.status || 'running'}`)
        }
      }
      lines.push('')
    }
    if (Array.isArray(m.steps) && m.steps.length) {
      lines.push('#### 执行过程', '')
      for (const s of m.steps) {
        lines.push(`- ${s.tool || '步骤'}${s.status ? `（${s.status}）` : ''}${s.detail ? `：${s.detail}` : ''}`)
      }
      lines.push('')
    }
    if (Array.isArray(m.workspaceChanges) && m.workspaceChanges.length) {
      lines.push('#### 文件变更', '')
      for (const ch of m.workspaceChanges) {
        lines.push(`- ${ch.change === 'added' ? '新增' : ch.change === 'modified' ? '修改' : '删除'}：\`${ch.rel}\``)
      }
      lines.push('')
    }
    if (Array.isArray(m.deliverables) && m.deliverables.length) {
      lines.push('#### 交付物', '')
      for (const d of m.deliverables) lines.push(`- ${d.path || d.name || '文件'}`)
      lines.push('')
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`
}



function mutateHarnessSchedule(id, action) {
  const file = join(dataDirPath(), 'dsh-home', 'storages', 'schedule.json')
  if (!existsSync(file)) return null
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const tasks = data?.tables?.tasks || {}
  const entry = tasks[id]
  if (!entry) return null
  if (action === 'pause') {
    entry.status = entry.status === 'active' ? 'paused' : 'active'
    entry.updatedAt = new Date().toISOString()
  } else if (action === 'delete') {
    delete tasks[id]
  } else {
    return null
  }
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return entry
}

/** 把 Harness 真实调度表合并到产品「定时任务」页；只读，不修改 dsh 的存储。 */
function harnessSchedules() {
  try {
    const file = join(dataDirPath(), 'dsh-home', 'storages', 'schedule.json')
    if (!existsSync(file)) return []
    const data = JSON.parse(readFileSync(file, 'utf8'))
    const tasks = data?.tables?.tasks || {}
    return Object.values(tasks).map((entry) => {
      const r = entry.record || {}
      const next = r.scheduledAt ? new Date(r.scheduledAt).toLocaleString('zh-CN', { hour12: false }) : '待首次执行'
      return {
        id: r.id || entry.id,
        name: r.title || 'Harness 定时任务',
        schedule: r.rrule ? r.rrule.replace(/^DTSTART[^\n]*\n?/i, '').replace(/RRULE:/i, '').replace(/FREQ=/i, '').slice(0, 60) : '按规则执行',
        status: entry.status === 'active' ? 'active' : 'paused',
        last: '—',
        next,
        owner: '米乐',
        prompt: r.prompt || '',
        deliver: entry.target?.kind === 'session' ? '当前会话' : '新会话',
        model: 'DeepSeek Harness',
        source: 'harness',
      }
    }).sort((a, b) => String(b.id).localeCompare(String(a.id)))
  } catch (error) {
    console.error('[jg-server] read schedule.json failed:', error?.message || error)
    return []
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function newFileId(prefix = 'F') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`
}

function issueDownloadToken({ fileId, resourceId, userName, ttlMs = 15 * 60 * 1000 }) {
  const payload = Buffer.from(JSON.stringify({ fileId, resourceId, userName, exp: Date.now() + ttlMs })).toString('base64url')
  const sig = createHmac('sha256', downloadSecret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyDownloadToken(token) {
  const raw = String(token || '')
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', downloadSecret).update(payload).digest('base64url')
  if (sig.length !== expected.length || !Buffer.from(sig).equals(Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data || !data.exp || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

function contentDisposition(name) {
  const fallback = String(name || 'download.bin').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(String(name || 'download.bin'))
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

const REG_KIND_LABEL = { pure: '普通数据', deliverable: '成果数据', service: '数据服务' }
const ZONE_LABEL = { intranet: '内网', gov: '政务外网', inet: '互联网' }
const MAP_CATALOG_LABEL = {
  satellite: '01 卫星影像',
  current: '02 现状数据',
  planning: '03 规划数据',
  construction: '04 建设工程数据',
  management: '05 管理数据',
  socioeconomic: '06 社会经济数据',
  threeD: '07 三维数据',
}
const zoneLabel = (z) => ZONE_LABEL[z] || z

/* 演示用行政区划边界（EPSG:4490 近似外包框）。正式环境替换为 GeoJSON 面要素 + PostGIS/GDAL 叠加。 */
const ADMIN_UNITS = [
  { code: '360000', name: '江西省', level: '省级', parent: '', bbox: [113.50, 24.40, 118.50, 30.50] },
  { code: '360400', name: '九江市', level: '市级', parent: '360000', bbox: [113.90, 28.60, 116.90, 30.10] },
  { code: '360403', name: '浔阳区', level: '区县级', parent: '360400', bbox: [115.94, 29.70, 116.07, 29.81] },
  { code: '360402', name: '濂溪区', level: '区县级', parent: '360400', bbox: [115.86, 29.48, 116.16, 29.70] },
  { code: '360404', name: '柴桑区', level: '区县级', parent: '360400', bbox: [115.58, 29.45, 115.90, 29.70] },
  { code: '360481', name: '瑞昌市', level: '区县级', parent: '360400', bbox: [115.38, 29.55, 115.62, 29.82] },
  { code: '360483', name: '庐山市', level: '区县级', parent: '360400', bbox: [115.88, 29.35, 116.10, 29.55] },
  { code: '360403001', name: '甘棠街道', level: '乡镇街道级', parent: '360403', bbox: [115.972, 29.728, 116.000, 29.756] },
  { code: '360403002', name: '湓浦街道', level: '乡镇街道级', parent: '360403', bbox: [115.948, 29.706, 115.971, 29.730] },
  { code: '360403003', name: '人民路街道', level: '乡镇街道级', parent: '360403', bbox: [116.001, 29.704, 116.022, 29.730] },
  { code: '360403004', name: '白水湖街道', level: '乡镇街道级', parent: '360403', bbox: [116.001, 29.757, 116.042, 29.792] },
  { code: '360403005', name: '金鸡坡街道', level: '乡镇街道级', parent: '360403', bbox: [116.030, 29.708, 116.056, 29.746] },
  { code: '360402001', name: '十里街道', level: '乡镇街道级', parent: '360402', bbox: [115.950, 29.640, 116.000, 29.690] },
  { code: '360402002', name: '五里街道', level: '乡镇街道级', parent: '360402', bbox: [116.000, 29.640, 116.050, 29.690] },
  { code: '360402101', name: '莲花镇', level: '乡镇街道级', parent: '360402', bbox: [115.880, 29.600, 115.950, 29.680] },
  { code: '360402102', name: '姑塘镇', level: '乡镇街道级', parent: '360402', bbox: [116.040, 29.500, 116.120, 29.580] },
  { code: '360402103', name: '威家镇', level: '乡镇街道级', parent: '360402', bbox: [116.000, 29.550, 116.060, 29.620] },
  { code: '360402104', name: '新港镇', level: '乡镇街道级', parent: '360402', bbox: [116.060, 29.580, 116.140, 29.660] },
  { code: '360404001', name: '沙河街道', level: '乡镇街道级', parent: '360404', bbox: [115.800, 29.600, 115.860, 29.660] },
  { code: '360404002', name: '狮子街道', level: '乡镇街道级', parent: '360404', bbox: [115.750, 29.560, 115.820, 29.620] },
  { code: '360404003', name: '城门街道', level: '乡镇街道级', parent: '360404', bbox: [115.700, 29.500, 115.780, 29.570] },
  { code: '360404101', name: '港口街镇', level: '乡镇街道级', parent: '360404', bbox: [115.620, 29.550, 115.700, 29.630] },
  { code: '360404102', name: '马回岭镇', level: '乡镇街道级', parent: '360404', bbox: [115.600, 29.600, 115.700, 29.680] },
  { code: '360481001', name: '湓城街道', level: '乡镇街道级', parent: '360481', bbox: [115.480, 29.660, 115.540, 29.720] },
  { code: '360481002', name: '桂林街道', level: '乡镇街道级', parent: '360481', bbox: [115.520, 29.640, 115.580, 29.700] },
  { code: '360481101', name: '码头镇', level: '乡镇街道级', parent: '360481', bbox: [115.420, 29.720, 115.500, 29.800] },
  { code: '360481102', name: '高丰镇', level: '乡镇街道级', parent: '360481', bbox: [115.450, 29.600, 115.520, 29.670] },
  { code: '360483001', name: '南康镇', level: '乡镇街道级', parent: '360483', bbox: [115.980, 29.440, 116.030, 29.490] },
  { code: '360483101', name: '白鹿镇', level: '乡镇街道级', parent: '360483', bbox: [116.000, 29.480, 116.060, 29.530] },
  { code: '360483102', name: '温泉镇', level: '乡镇街道级', parent: '360483', bbox: [115.920, 29.400, 115.980, 29.460] },
  { code: '360483103', name: '海会镇', level: '乡镇街道级', parent: '360483', bbox: [116.020, 29.380, 116.080, 29.440] },
]

function parseExtent(value) {
  const nums = String(value || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []
  if (nums.length < 4) return null
  const [a, b, c, d] = nums
  const minX = Math.min(a, c)
  const maxX = Math.max(a, c)
  const minY = Math.min(b, d)
  const maxY = Math.max(b, d)
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null
  return { minX, maxX, minY, maxY }
}

function intersects(box, unit) {
  const [ux1, uy1, ux2, uy2] = unit.bbox
  return box.minX <= ux2 && box.maxX >= ux1 && box.minY <= uy2 && box.maxY >= uy1
}

function adminChain(code) {
  const chain = []
  let unit = ADMIN_UNITS.find((u) => u.code === code)
  while (unit) {
    chain.unshift(unit)
    unit = unit.parent ? ADMIN_UNITS.find((u) => u.code === unit.parent) : null
  }
  return chain
}

function recognizeAdmin(extent) {
  const box = parseExtent(extent)
  if (!box) return null
  const towns = ADMIN_UNITS.filter((u) => u.level === '乡镇街道级' && intersects(box, u))
  const districts = ADMIN_UNITS.filter((u) => u.level === '区县级' && intersects(box, u))
  const cities = ADMIN_UNITS.filter((u) => u.level === '市级' && intersects(box, u))
  const roots = towns.length ? towns : districts.length ? districts : cities.length ? cities : ADMIN_UNITS.filter((u) => u.level === '省级' && intersects(box, u))
  if (!roots.length) return null
  const chains = roots.map((u) => adminChain(u.code))
  const common = chains.reduce((acc, chain) => {
    let i = 0
    while (i < acc.length && i < chain.length && acc[i].code === chain[i].code) i += 1
    return acc.slice(0, i)
  })
  const path = common.map((u) => u.name).join(' / ')
  const deepest = common[common.length - 1] || roots[0]
  return {
    path,
    level: deepest.level,
    code: deepest.code,
    matched: roots.map((u) => u.name),
    matchedCount: roots.length,
    merged: roots.length > 1,
    note: roots.length > 1
      ? `空间叠加命中 ${roots.length} 个${roots[0].level}，已向上归并至共同上级「${deepest.name}」`
      : `空间叠加命中「${roots[0].name}」，按最具体行政单元归集`,
  }
}

function regAutoApproved(kind, body) {
  const level = /^L[1-5]$/.test(String(body.internalLevel || '')) ? Number(String(body.internalLevel).slice(1)) : 2
  const secrecy = body.secrecy || (body.security === 'secret' ? '待认定' : '非涉密')
  const accessScope = body.accessScope || 'dept'
  if (body.qcRequired === true) return false
  if (secrecy !== '非涉密' || level >= 4) return false
  if (['group', 'orgs'].includes(accessScope)) return false
  if (kind === 'deliverable' && body.formalResult === true) return false
  return true
}

function regWorkflow(kind, user, body) {
  if (regAutoApproved(kind, body)) {
    return {
      stage: 'done',
      steps: [{ key: 'done', label: '登记入库', state: 'done' }],
      deptLead: '',
      note: '元数据完整且未申请超出默认范围，登记后直接进入统一资源目录；发布状态另行管理。',
    }
  }
  const qcRequired = body.qcRequired === true
  const steps = [
    { key: 'dept', label: '部门负责人同意登记', state: 'pending' },
    ...(qcRequired ? [{ key: 'qc', label: '质检软件质检（可选）', state: 'pending' }] : []),
    { key: 'data', label: '数据管理员质量评估', state: 'pending' },
    { key: 'done', label: '登记入库', state: 'pending' },
  ]
  steps[0].state = 'active'
  steps[0].by = ''
  steps[0].at = ''
  return {
    stage: 'dept',
    steps,
    deptLead: body.deptLead || '部门负责人',
    note: qcRequired
      ? '部门负责人同意后，先由质检软件执行完整性、坐标系、拓扑、属性与格式检查，再由数据管理员做质量评估。'
      : '部门负责人同意后，由数据管理员做质量评估；本次未选择质检软件质检。',
  }
}

function regStatusOf(stage, kind) {
  if (stage === 'dept') return 'pending-dept'
  if (stage === 'qc') return 'pending-qc'
  if (stage === 'data') return 'pending-data'
  return 'authorized'
}

function parseUpdated(value) {
  const d = new Date(String(value || '').replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function isNewUpdate(value, days = 30) {
  const d = parseUpdated(value)
  if (!d) return false
  return Date.now() - d.getTime() <= days * 24 * 60 * 60 * 1000
}

function formatsOf(resource) {
  const raw = Array.isArray(resource.formats) && resource.formats.length
    ? resource.formats
    : String(resource.format || '').split(/[\/、,]+/)
  return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))]
}

function sizeBytesOf(value) {
  const m = String(value || '').match(/([\d.]+)\s*(TB|GB|MB|KB|B)/i)
  if (!m) return 0
  const n = Number(m[1])
  const unit = m[2].toUpperCase()
  const mul = { TB: 1024 ** 4, GB: 1024 ** 3, MB: 1024 ** 2, KB: 1024, B: 1 }[unit] || 0
  return Number.isFinite(n) ? n * mul : 0
}

function sizeLabel(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${Math.round(bytes)} B`
}

function pickResource(r) {
  return {
    id: r.id, name: r.name, type: r.type, format: r.format, source: r.source,
    updated: r.updated, owner: r.owner, security: r.security, status: r.status,
    size: r.size, nets: r.nets, extent: r.extent, regKind: r.regKind,
    businessCategory: businessCategoryOf(r),
    businessCategoryKey: categoryKey(businessCategoryOf(r)),
    dataOwner: r.dataStandard?.dataOwner || r.contact || '',
    formats: formatsOf(r),
    filesCount: (r.files || []).length,
    isNew: isNewUpdate(r.updated),
    views: resourceReads.get(r.id) || 0,
    downloads: resourceDownloads.get(r.id) || 0,
  }
}

function categoryOrderOf(name) {
  const order = ['规划', '建筑', '市政', '风景园林', '测绘', '企业经营管理', '总工办']
  const i = order.indexOf(name)
  return i === -1 ? 100 : i
}

function buildOverview(user, net) {
  const list = liveResources.filter((r) => canSee(user, r, net))
  const categoryMap = new Map()
  const formatMap = new Map()
  const quarterMap = new Map()
  let totalSize = 0
  let newCount = 0
  for (const r of list) {
    const category = businessCategoryOf(r)
    const c = categoryMap.get(category) || { name: category, count: 0, newCount: 0 }
    c.count += 1
    const isNew = isNewUpdate(r.updated)
    if (isNew) { c.newCount += 1; newCount += 1 }
    categoryMap.set(category, c)
    totalSize += sizeBytesOf(r.size)
    for (const f of formatsOf(r)) formatMap.set(f, (formatMap.get(f) || 0) + 1)
    const d = parseUpdated(r.updated)
    if (d) {
      const qid = `${d.getFullYear()}Q${Math.floor(d.getMonth() / 3) + 1}`
      const q = quarterMap.get(qid) || { id: qid, label: `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`, total: 0, byCategory: {} }
      q.total += 1
      q.byCategory[category] = (q.byCategory[category] || 0) + 1
      quarterMap.set(qid, q)
    }
  }
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const quarters = []
  for (let i = 3; i >= 0; i -= 1) {
    const q = currentQ - i
    const year = q < 1 ? now.getFullYear() - 1 : now.getFullYear()
    const qn = q < 1 ? q + 4 : q
    const qid = `${year}Q${qn}`
    quarters.push(quarterMap.get(qid) || { id: qid, label: `${year} Q${qn}`, total: 0, byCategory: {} })
  }
  const categoryList = [...categoryMap.values()].sort((a, b) => categoryOrderOf(a.name) - categoryOrderOf(b.name) || b.count - a.count)
  const formats = [...formatMap.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count || a.format.localeCompare(b.format))
  const hot = list
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: businessCategoryOf(r),
      owner: r.dataStandard?.dataOwner || r.contact || r.owner,
      views: resourceReads.get(r.id) || 0,
      downloads: resourceDownloads.get(r.id) || 0,
    }))
    .sort((a, b) => b.views - a.views || b.downloads - a.downloads)
    .slice(0, 3)
  const quarterDownloads = list
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: businessCategoryOf(r),
      owner: r.dataStandard?.dataOwner || r.contact || r.owner,
      downloads: resourceDownloads.get(r.id) || 0,
    }))
    .filter((x) => x.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))
    .slice(0, 5)
  const quarterCalls = list
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: businessCategoryOf(r),
      owner: r.dataStandard?.dataOwner || r.contact || r.owner,
      calls: resourceReads.get(r.id) || 0,
    }))
    .filter((x) => x.calls > 0)
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, 5)
  const deptMap = new Map()
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime()
  for (const r of list) {
    const d = parseUpdated(r.updated)
    if (!d || d.getTime() < yearStart) continue
    const dept = r.owner || '其他'
    const item = deptMap.get(dept) || { name: dept, count: 0, last: '' }
    item.count += 1
    if (String(r.updated || '') > item.last) item.last = r.updated
    deptMap.set(dept, item)
  }
  const diligentDepartments = [...deptMap.values()]
    .sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)))
    .slice(0, 5)
  return {
    total: list.length,
    totalSize,
    totalSizeLabel: sizeLabel(totalSize),
    formatTypes: formats.length,
    newCount,
    categories: categoryList,
    formats,
    quarters,
    hot,
    quarterDownloads,
    quarterCalls,
    diligentDepartments,
  }
}
function fieldGroupsOf(r) {
  const kind = r.regKind || 'pure'
  const data = r.dataStandard || {}
  const spatial = r.spatial || {}
  const sec = r.securityMeta || {}
  const mapPath = spatial.mapPath || (spatial.mapCatalog ? MAP_CATALOG_LABEL[spatial.mapCatalog] || spatial.mapCatalog : '—')
  const groups = [
    { title: '身份与分类', rows: [
      ['数据大类', REG_KIND_LABEL[kind] || '普通数据'],
      ['数据 ID', r.id],
      ['数据名称', r.name],
      ['业务分类', businessCategoryOf(r)],
      ['数据格式', r.format],
      ['数据大小', r.size],
      ['登记状态', r.status === 'authorized' ? '已登记可服务' : '审批中'],
    ] },
    { title: '来源与权属', rows: [
      ['上传人 / 组织', `${data.uploader || r.contact || '—'} · ${data.sourceOrg || r.owner || '—'}`],
      ['数据负责人', data.dataOwner || r.contact || '—'],
      ['原始来源', data.originalSource || '集团自产'],
      ['来源方式', r.sourceType === 'cloud' ? '企业云空间引用' : '本地上传'],
      ['来源系统', r.source],
      ['数据上传时间', data.dataDate || r.aiMeta?.period || '—'],
      ['登记时间', data.registeredAt || r.updated],
      ['责任部门', r.owner],
      ['生产部门', r.producer || r.owner],
    ] },
    { title: '业务与说明', rows: [
      ['空间范围', r.aiMeta?.coverage || '—'],
      ['数据简介', r.aiMeta?.summary || r.desc || '—'],
    ] },
  ]
  if (spatial.enabled) {
    groups.push({ title: 'GIS / 三维空间元数据', rows: [
      ['空间数据类型', spatial.typeLabel || spatial.type || '—'],
      ['一张图一级分类', MAP_CATALOG_LABEL[spatial.mapCatalog] || spatial.mapCatalog || '—'],
      ['一张图目录路径', mapPath],
      ['行政区域', spatial.regions || '—'],
      ['行政区划识别', spatial.adminNote || '按空间范围与行政区划边界做叠加分析'],
      ['空间坐标系统', spatial.crs || '—'],
      ['空间覆盖范围', spatial.extent || r.aiMeta?.coverage || '—'],
      ['测绘比例尺', spatial.scale || '—'],
      ['空间数据集 ID', spatial.datasetId || '待登记入库后生成'],
    ] })
  }
  groups.push({ title: '安全与授权', rows: [
    ['内部安全等级', sec.internalLevel || '—'],
    ['涉密属性', sec.secrecy || '非涉密'],
    ['申请访问环境', (sec.requestedZones || r.nets || []).map(zoneLabel).join(' / ') || '—'],
    ['批准访问环境', (sec.approvedZones || []).length ? sec.approvedZones.map(zoneLabel).join(' / ') : '待审批'],
    ['授权类型', sec.authorizationType === 'orgs' ? '指定组织' : '集团内部公开'],
    ['授权组织', (sec.authorizedOrgs || []).join(' / ') || '—'],
    ['数据权属及使用依据', sec.rightsBasis || '—'],
  ] })
  groups.push({ title: '记录与派生', rows: [['更新时间', r.updated], ['派生关系', '无派生资源']] })
  groups.push({ title: '解析与索引', rows: [['解析状态', r.status !== 'authorized' ? '待登记入库后建立索引' : r.type === 'document' ? '已解析 · 全文索引' : '按类型建立空间 / 元数据索引'], ['坐标参考', r.meta?.crs || '—'], ['覆盖范围', r.meta?.coverage || '—']] })
  groups.push({ title: '服务能力', rows: [['可用操作', r.action], ['服务端点', r.type === 'service' ? (r.service?.url || '—') : r.source.includes('QGIS') ? 'QGIS Server OGC API（受控）' : '本地适配器'], ['缓存策略', '短期受控令牌，15 分钟']] })
  if (kind === 'deliverable') {
    groups.splice(3, 0, { title: '成果数据与质检', rows: [
      ['成果资源 ID', r.result?.resourceId || r.id],
      ['内部数据 ID', r.result?.internalDataId || '—'],
      ['专业质检状态', r.quality?.status === 'passed' ? '已通过' : r.quality?.status === 'failed' ? '未通过' : r.quality?.status === 'pending' ? '待质检' : '未选择质检'],
      ['质检报告关联', r.quality?.reportNo || (r.quality?.status === 'pending' ? '待质检后回写' : '未选择质检')],
      ['成果包文件数', String(r.files?.length || 0)],
      ['包含格式', (r.formats || []).join(' / ') || '—'],
      ['成果清单', r.quality?.manifest ? '已包含' : '未包含'],
    ] })
  }
  if (kind === 'service') {
    groups.splice(3, 0, { title: '数据服务', rows: [['服务地址', r.service?.url || '—'], ['服务类型', r.service?.type || '—'], ['图层数量', String(r.service?.layers || '—')], ['鉴权方式', r.service?.auth || '—'], ['SLA', r.service?.sla || '—']] })
  }
  return groups
}

function bboxHit(a, b) {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
}

/** 会话执行记录：把每次真实 AI 运行作为一条持久化任务，服务重启后可定位原会话继续。 */
const MAX_CHAT_RUNS = Math.max(1, Number(process.env.JG_MAX_CHAT_RUNS || 2))
let chatRunSlots = 0
const chatRunWaiters = []

function acquireChatRunSlot() {
  if (chatRunSlots < MAX_CHAT_RUNS) {
    chatRunSlots += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => chatRunWaiters.push(resolve))
}

function releaseChatRunSlot() {
  const next = chatRunWaiters.shift()
  if (next) next()
  else chatRunSlots = Math.max(0, chatRunSlots - 1)
}

function startChatRunTask({ conv, user, text, mode, taskMode, target, idempotencyKey = '' }) {
  const task = {
    id: `TR-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    kind: 'chat-run',
    title: text.length > 40 ? `${text.slice(0, 40)}…` : text,
    state: 'queued',
    progress: 0,
    progressText: '正在建立任务上下文',
    activityDetail: '准备读取项目与工具状态',
    target: `${mode === 'work' ? '工作' : mode === 'chat' ? '对话' : '自动'} · ${target || '对话工作区'}`,
    started: '',
    createdAt: Date.now(),
    finishedAt: null,
    conversationId: conv.id,
    userId: String(user.id || ''),
    prompt: text,
    mode,
    taskMode,
    steps: 0,
    artifacts: 0,
    reason: '',
    queuePosition: chatRunWaiters.length + 1,
    idempotencyKey: idempotencyKey || '',
    checkpoint: {
      conversationId: conv.id,
      prompt: text,
      mode,
      taskMode,
      phase: 'queued',
      dshSessionId: conv.dshSessionId || '',
      updatedAt: Date.now(),
    },
  }
  liveTasks.unshift(task)
  conv.taskRunId = task.id
  persistPersistentState()
  return task
}

function markChatRunStarted(task, sessionId = '') {
  if (!task) return
  task.state = 'running'
  task.progress = 20
  task.progressText = '正在分析请求与工作区'
  task.activityDetail = 'DSH 会话已启动，正在读取上下文'
  task.started = new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
  task.dshSessionId = sessionId || task.dshSessionId || ''
  task.queuePosition = 0
  task.checkpoint = { ...(task.checkpoint || {}), phase: 'running', dshSessionId: task.dshSessionId, updatedAt: Date.now() }
  persistPersistentState()
}

/** 工具名转成用户能看懂的动作标签，不把内部名称直接抛到前台。 */
function chatToolLabel(name) {
  const key = String(name || '').replace(/^mcp__[^_]+__/, '')
  return {
    run_code: '运行代码',
    bash: '执行命令',
    shell: '执行命令',
    exec: '执行命令',
    read: '读取文件',
    read_file: '读取文件',
    write: '写入文件',
    write_file: '写入文件',
    edit: '修改文件',
    apply_patch: '应用修改',
    glob: '查找文件',
    grep: '检索内容',
    web_search: '搜索网页',
    web_fetch: '读取网页',
    present_files: '整理交付物',
    task: '处理任务',
  }[key] || key || '工具调用'
}

/** 把 DSH 的真实 session.event 映射成聊天中的“最近动态”，仅供前端展示。 */
function recordChatRunActivity(task, event) {
  if (!task || task.state !== 'running' || !event?.type) return
  const now = Date.now()
  let activity = ''
  let detail = ''
  if (event.type === 'tool/call') {
    const tool = String(event.data?.name || '')
    const args = String(event.data?.arguments || '')
    const described = describeToolCall({ tool, args, isExternalSideEffect: isExternalSideEffectTool(tool) })
    const action = chatToolLabel(tool)
    const rawSummary = String(described.summary || '')
    const target = rawSummary.replace(/^目标：/, '').split('；')[0].slice(0, 70)
    activity = `正在${action}${target && !/未提供可展示参数/.test(target) ? ` · ${target}` : ''}`
    detail = '工具调用已开始，等待返回结果'
    task.toolCallsSeen = (task.toolCallsSeen || 0) + 1
    task.progress = Math.min(90, Math.max(task.progress || 20, 30 + task.toolCallsSeen * 8))
  } else if (event.type === 'tool/result') {
    activity = '正在整理工具结果'
    detail = event.data?.error ? '工具返回异常，正在处理并准备下一步' : '已收到工具返回，继续下一步'
  } else if (event.type === 'turn/end') {
    activity = '正在整理最终答复'
    detail = '本轮执行结束，正在生成可读结果'
    task.progress = Math.max(task.progress || 20, 85)
  } else if (event.type === 'compaction/start') {
    activity = '正在压缩上下文'
    detail = '历史上下文较长，先压缩再继续'
  } else if (event.type === 'plan/mode') {
    activity = event.data?.active ? '正在进入计划模式' : '正在退出计划模式'
    detail = '计划模式状态已更新'
  }
  if (!activity) return
  task.progressText = activity.slice(0, 160)
  task.activityDetail = detail.slice(0, 200)
  task.activityAt = now
  task.recentActivities = [...(task.recentActivities || []), { text: task.progressText, at: now }].slice(-6)
}

function cancelChatRunTask(task, reason = '用户停止执行') {
  if (!task) return
  task.state = 'cancelled'
  task.finishedAt = Date.now()
  task.reason = String(reason).slice(0, 160)
  task.progress = Math.min(100, Math.max(0, task.progress || 0))
  task.checkpoint = { ...(task.checkpoint || {}), phase: 'cancelled', updatedAt: Date.now() }
  persistPersistentState()
}

function finishChatRunTask(task, { steps = 0, artifacts = 0, reply = '' } = {}) {
  if (!task) return
  task.state = 'done'
  task.progress = 100
  task.steps = steps
  task.artifacts = artifacts
  task.replyText = String(reply || '').slice(0, 20000)
  task.finishedAt = Date.now()
  task.reason = ''
  task.checkpoint = { ...(task.checkpoint || {}), phase: 'done', updatedAt: Date.now() }
  persistPersistentState()
}

function failChatRunTask(task, reason) {
  if (!task) return
  task.state = 'failed'
  task.progress = Math.max(task.progress || 0, 10)
  task.finishedAt = Date.now()
  task.reason = String(reason || '执行失败').slice(0, 160)
  task.checkpoint = { ...(task.checkpoint || {}), phase: 'failed', updatedAt: Date.now() }
  persistPersistentState()
}

/** 启动时把上次进程未收尾的任务标记为中断，保留原会话与指令供用户恢复，不自动重放副作用。 */
function recoverChatRunTasks() {
  let changed = false
  for (const t of liveTasks) {
    if (t?.kind !== 'chat-run') continue
    if (t.state === 'running' || t.state === 'queued') {
      t.state = 'interrupted'
      t.progress = Math.min(95, Math.max(10, Number(t.progress) || 10))
      t.reason = '服务重启导致任务中断，可在原会话继续'
      t.interruptedAt = Date.now()
      t.checkpoint = { ...(t.checkpoint || {}), phase: 'interrupted', updatedAt: Date.now() }
      const conv = conversations.find((c) => c.id === t.conversationId)
      if (conv && conv.status === 'running') conv.status = 'failed'
      changed = true
    }
  }
  if (changed) persistPersistentState()
}

/* ---- 定时任务：真实调度与执行 ---- */
const automationRunning = new Set()

function parseAutomationSchedule(label = '') {
  const text = String(label || '').trim()
  let m
  if ((m = text.match(/每季度首月\s*(\d{1,2})\s*日\s*(\d{1,2}):(\d{2})/))) {
    return { kind: 'quarterly', day: Math.min(28, Math.max(1, Number(m[1]))), hour: Number(m[2]), minute: Number(m[3]) }
  }
  if ((m = text.match(/每月\s*(\d{1,2})\s*日\s*(\d{1,2}):(\d{2})/))) {
    return { kind: 'monthly', day: Math.min(28, Math.max(1, Number(m[1]))), hour: Number(m[2]), minute: Number(m[3]) }
  }
  if ((m = text.match(/每周([一二三四五六日天])\s*(\d{1,2}):(\d{2})/))) {
    const map = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
    return { kind: 'weekly', weekday: map[m[1]] ?? 1, hour: Number(m[2]), minute: Number(m[3]) }
  }
  if ((m = text.match(/每天\s*(\d{1,2}):(\d{2})/))) {
    return { kind: 'daily', hour: Number(m[1]), minute: Number(m[2]) }
  }
  return { kind: 'daily', hour: 8, minute: 30 }
}

function nextAutomationTime(schedule, from = Date.now()) {
  const base = new Date(from)
  base.setSeconds(0, 0)
  const hour = Math.min(23, Math.max(0, Number(schedule.hour) || 0))
  const minute = Math.min(59, Math.max(0, Number(schedule.minute) || 0))
  if (schedule.kind === 'weekly') {
    const target = Math.min(6, Math.max(0, Number(schedule.weekday) || 0))
    const candidate = new Date(base)
    candidate.setHours(hour, minute, 0, 0)
    let diff = (target - candidate.getDay() + 7) % 7
    if (diff === 0 && candidate.getTime() <= base.getTime()) diff = 7
    candidate.setDate(candidate.getDate() + diff)
    return candidate.getTime()
  }
  if (schedule.kind === 'monthly' || schedule.kind === 'quarterly') {
    const day = Math.min(28, Math.max(1, Number(schedule.day) || 1))
    const months = schedule.kind === 'quarterly' ? [0, 3, 6, 9] : null
    for (let offset = 0; offset < 18; offset += 1) {
      const candidate = new Date(base.getFullYear(), base.getMonth() + offset, 1)
      if (months && !months.includes(candidate.getMonth())) continue
      candidate.setDate(day)
      candidate.setHours(hour, minute, 0, 0)
      if (candidate.getTime() > base.getTime()) return candidate.getTime()
    }
    return base.getTime() + 24 * 3600 * 1000
  }
  const candidate = new Date(base)
  candidate.setHours(hour, minute, 0, 0)
  if (candidate.getTime() <= base.getTime()) candidate.setDate(candidate.getDate() + 1)
  return candidate.getTime()
}

function automationNextLabel(ts) {
  if (!ts) return '待首次执行'
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')
}

function scheduleAutomationNext(a, from = Date.now()) {
  a.schedule = a.schedule || '每天 08:30'
  a.scheduleRule = parseAutomationSchedule(a.schedule)
  a.nextRunAt = nextAutomationTime(a.scheduleRule, from)
  a.next = automationNextLabel(a.nextRunAt)
}

function setAutomationRunFields(a, task, state, reason = '') {
  a.lastTaskId = task.id
  a.lastRunAt = state === 'done' ? Date.now() : a.lastRunAt
  a.last = `${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')} ${state === 'done' ? '成功' : state === 'failed' ? '失败' : '执行中'}`
  if (state === 'failed' && reason) a.last = `${a.last}：${String(reason).slice(0, 60)}`
  if (a.status === 'active') scheduleAutomationNext(a, Date.now() + 60 * 1000)
}

async function runAutomation(a, trigger = 'manual') {
  if (!a) return { ok: false, error: '不存在该定时任务' }
  if (a.status !== 'active' && trigger === 'schedule') return { ok: false, error: '任务已暂停' }
  if (automationRunning.has(a.id)) return { ok: false, error: '该定时任务正在执行', code: 'RUNNING' }
  const account = getAccount(a.userId) || getAccountByRole('admin')
  if (!account) return { ok: false, error: '任务归属账号不存在' }
  const user = userOfAccount(account)
  const permission = a.permission === 'read-only' ? 'read-only' : 'workspace-write'
  const task = {
    id: `T-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    kind: 'automation-run',
    title: `${trigger === 'schedule' ? '定时执行' : '手动执行'} · ${a.name}`,
    state: 'queued',
    progress: 0,
    target: `定时任务 · ${a.deliver || '工作台'}`,
    started: '—',
    createdAt: Date.now(),
    finishedAt: null,
    automationId: a.id,
    userId: user.id,
    prompt: a.prompt || '',
    permission,
    steps: 0,
    artifacts: 0,
    reason: '',
  }
  liveTasks.unshift(task)
  a.lastTaskId = task.id
  a.last = '排队中'
  persistPersistentState()

  if (!String(a.prompt || '').trim()) {
    task.state = 'failed'
    task.reason = '定时任务没有执行指令'
    task.finishedAt = Date.now()
    setAutomationRunFields(a, task, 'failed', task.reason)
    persistPersistentState()
    return { ok: false, error: task.reason, task }
  }
  if (explicitHighRiskRequest(a.prompt)) {
    task.state = 'failed'
    task.reason = '指令包含高风险删除/覆盖动作，定时任务不自动执行'
    task.finishedAt = Date.now()
    setAutomationRunFields(a, task, 'failed', task.reason)
    persistPersistentState()
    return { ok: false, error: task.reason, task }
  }

  const modelCfg = resolveModelConfig({ userConfig: liveModelConfig.get(user.id) || {}, request: {} })
  if (modelCfg.source === 'none') {
    task.state = 'failed'
    task.reason = '当前账号没有配置模型密钥，定时任务无法执行'
    task.finishedAt = Date.now()
    setAutomationRunFields(a, task, 'failed', task.reason)
    persistPersistentState()
    return { ok: false, error: task.reason, task }
  }

  automationRunning.add(a.id)
  const convId = `C-AU-${Date.now()}`
  const conv = {
    id: convId,
    title: `定时任务 · ${a.name}`,
    time: '刚刚',
    messages: [],
    status: 'running',
    projectId: a.projectId || null,
    executionPolicy: permission === 'read-only' ? 'manual' : 'auto',
    userId: user.id,
    owner: user.name,
    createdAt: Date.now(),
    agentCwd: chatWorkspaceDir(user, convId),
  }
  conversations.unshift(conv)
  a.lastConversationId = convId
  task.conversationId = convId
  task.state = 'running'
  task.started = new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
  task.progress = 10
  setAutomationRunFields(a, task, 'running')
  persistPersistentState()

  const context = [
    `当前用户：${user.name}（${user.label}，${user.unit || '—'}）`,
    `当前任务模式：定时任务（无人值守，创建时已声明权限：${permission === 'read-only' ? '只读' : '工作区可写'}）`,
    `任务权限：${permission === 'read-only' ? '只读，只允许查询/读取，不写文件、不执行命令' : '仅任务工作目录内可读写/构建/测试，禁止外部副作用'}；超出范围立即停止，不自动扩权。`,
    `定时任务名称：${a.name}`,
    `投递目标：${a.deliver || '工作台'}（当前仅记录结果，不自动发送到外部系统）`,
    '执行要求：按指令完成可验证的工作；先检查已有文件与结果，不重复已完成步骤；结果写入当前工作目录并返回摘要。',
  ].filter(Boolean).join('\n')

  ;(async () => {
    try {
      const result = await runAgent({
        apiKey: modelCfg.apiKey,
        baseUrl: modelCfg.baseUrl,
        model: modelCfg.model,
        text: a.prompt,
        sessionId: '',
        context,
        cwd: conv.agentCwd,
        agentsHome: userAgentHome(user.id),
        dshHome: ensureUserDshHome(user.id),
        executionPolicy: permission === 'read-only' ? 'manual' : 'auto',
        maxToolCalls: forcedMaxToolCalls || 60,
        runKey: conv.id,
        runtimeScope: conv.id,
        shouldCancel: () => false,
        handlers: {
          onApproval: (params) => {
            const evaluation = describeToolApproval(params)
            // 无人值守任务没有审批人；任何升级都说明超出创建任务时声明的权限范围。
            // 这里不是 AI 自行决定，而是执行用户预先设定的边界，并明确记录停止原因。
            const rule = permission === 'read-only' ? 'scheduled-read-only-scope' : 'scheduled-scope-exceeded'
            recordApprovalDecision({
              conversationId: conv.id,
              callId: params?.callId || '',
              tool: params?.toolNameResolved || params?.toolName || '',
              operation: evaluation.operation,
              summary: evaluation.summary,
              decision: 'deny',
              rule,
              risk: evaluation.risk,
              actor: user.name,
              approver: 'policy:task-scope',
              net: 'inet',
            })
            return { outcome: 'rejected' }
          },
        },
      })
      conv.dshSessionId = result.sessionId || ''
      conv.status = 'done'
      conv.messages.push({ role: 'assistant', text: result.reply || '', time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5), steps: result.steps || [], model: result.model })
      task.state = 'done'
      task.progress = 100
      task.finishedAt = Date.now()
      task.steps = Array.isArray(result.steps) ? result.steps.length : 0
      task.artifacts = Array.isArray(result.deliverables) ? result.deliverables.length : 0
      task.replyText = String(result.reply || '').slice(0, 20000)
      a.last = `${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')} 成功`
      a.lastResult = String(result.reply || '').slice(0, 4000)
      a.model = result.model || a.model
      if (a.status === 'active') scheduleAutomationNext(a, Date.now())
      persistPersistentState()
    } catch (err) {
      conv.status = 'failed'
      task.state = 'failed'
      task.finishedAt = Date.now()
      task.reason = String(err && err.message ? err.message : err || '执行失败').slice(0, 160)
      a.last = `${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')} 失败：${task.reason}`
      if (a.status === 'active') scheduleAutomationNext(a, Date.now())
      persistPersistentState()
    } finally {
      automationRunning.delete(a.id)
    }
  })()
  return { ok: true, task, conversation: conv }
}

function automationTick() {
  const now = Date.now()
  for (const a of liveAutomations) {
    if (!a || a.status !== 'active' || automationRunning.has(a.id)) continue
    if (!a.nextRunAt) scheduleAutomationNext(a, now)
    if (a.nextRunAt && now >= a.nextRunAt) {
      runAutomation(a, 'schedule').catch((err) => {
        console.error('[jg-server] automation run failed:', err && err.message ? err.message : err)
      })
    }
  }
}

function taskTick() {
  // 任务状态全部由真实运行启动、完成和失败收尾，不再用时间推进假进度。
}

/** 演示用回复生成：按关键词命中不同工具链，保持"步骤 → 结果"的可见性 */
function buildReply(text, user, net) {
  if (user.id === 'guest') {
    return {
      steps: [{ tool: '个人模型（自带 Key）', detail: '不经集团网关 · 仅本人额度', status: 'ok', ms: 900 }],
      reply: '外部访客模式：已使用你本人的模型 API 完成本轮回答。集团统一模型与集团数据不对访客开放；如需引用某个业务模块，请由管理员在运维管理平台按模块授权后重试。',
      citations: [],
    }
  }
  const visible = liveResources.filter((r) => canSee(user, r, net))
  const lower = text || ''
  const cite = (id) => visible.find((r) => r.id === id)
  const citations = []
  const steps = []
  let reply = ''

  if (/周报|日报|生成报告|写一份报告/.test(lower)) {
    steps.push({ tool: '会话与任务收集', detail: '本周 6 个会话 · 3 个任务', status: 'ok', ms: 1100 })
    return {
      requiresConfirm: true,
      confirmText: '将写入工作区文件「规划一所周报_2026-11-07.md」，并登记到任务中心。是否继续？',
      steps,
      draft: '生成本周规划一所工作进展周报：汇总 3 个已完成任务、2 个进行中任务与 6 个会话要点，输出 Markdown 到工作区。',
      citations,
    }
  }

  if (/周报|日报|生成报告|写一份报告|总结成文/.test(lower)) {
    steps.push({ tool: '会话与任务收集', detail: '本周 6 个会话 · 3 个任务', status: 'ok', ms: 1100 })
    return {
      requiresConfirm: true,
      confirmText: '将写入工作区文件「规划一所周报_2026-11-07.md」，并登记到任务中心。是否继续？',
      steps,
      draft: '生成本周规划一所工作进展周报：汇总 3 个已完成任务、2 个进行中任务与 6 个会话要点，输出 Markdown 到工作区。',
      citations,
    }
  }

  if (/影像|对比|图斑|季度/.test(lower)) {
    const gis = visible.filter((r) => r.type === 'gis').slice(0, 2)
    gis.forEach((r) => citations.push(r.id))
    steps.push({ tool: '空间范围检索', detail: 'bbox=115.96,29.70,116.02,29.75 · 命中 2 项', status: 'ok', ms: 2200 })
    steps.push({ tool: '影像服务', detail: net === 'inet' ? '天地图 WMTS 在线引用（外部服务）' : 'QGIS Server 动态读取 GeoTIFF（GDAL 金字塔）', status: 'warn', ms: 3600 })
    reply = `已完成同视口影像比对：两期共识别变化图斑 3 处（新增工地 2.4 ha、道路贯通 3.1 ha、场地平整 5.6 ha）。\n\n${net === 'inet' ? '本网影像来自天地图在线引用，受服务方配额约束；定量面积需以内部影像复核。' : '影像来自内网季度入库版本，可直接用于成果引用。'}\n\n引用：${gis.map((r) => `${r.id}（${r.name}）`).join('、') || '无可见影像资源'}`
  } else if (/公示|项目|建设单位/.test(lower)) {
    const biz = cite('R-PROJ-PUB') || visible.find((r) => r.type === 'bizdata')
    if (biz) citations.push(biz.id)
    steps.push({ tool: '数据中心检索', detail: 'type=bizdata · keyword=公示', status: 'ok', ms: 820 })
    steps.push({ tool: '文档解析', detail: '表格抽取 86 行 · 脱敏字段校验', status: 'ok', ms: 1600 })
    reply = '已汇总 86 条公示记录，按建设单位归并为 12 组，公示期集中在 9—10 月，其中 3 个项目已过公示期。\n\n' + (biz ? `引用：${biz.id}（${biz.name}）` : '当前网络与授权范围内无公示数据。')
  } else if (/规划|口径|原文|容积率|开发强度/.test(lower)) {
    const doc = cite('R-DOC-GH-2021') || visible.find((r) => r.type === 'document')
    if (doc) citations.push(doc.id)
    steps.push({ tool: '全文检索', detail: 'keyword=开发强度 · 命中 6 段', status: 'ok', ms: 1300 })
    steps.push({ tool: '引用校对', detail: '定位原文第 112—115 页 · 权限复核', status: 'ok', ms: 900 })
    reply = '中心城区新建住宅容积率上限 2.5、建筑密度不超过 30%；历史街区另有专项规定。原文位于第 112—115 页，已标注段落。\n\n' + (doc ? `引用：${doc.id}（${doc.name}）` : '当前目录内无规划文本。')
  } else {
    steps.push({ tool: '数据中心检索', detail: `keyword=${lower.slice(0, 12) || '—'} · 命中 ${Math.min(visible.length, 3)} 项`, status: 'ok', ms: 760 })
    reply = `已按当前网络（${networks[net].label}）与授权范围检索到 ${visible.length} 项可用资源，可按类型筛选后在对话中引用；需要我进一步打开某一项吗？`
  }

  return { reply, steps, citations }
}

function fileVisibleToUser(user, net, fileId) {
  if (!fileId) return false
  const meta = getFile(fileId)
  if (!meta) return false
  if (meta.owner === user.name) return true
  const resource = liveResources.find((r) => (r.fileIds || []).includes(fileId))
  if (resource) return canSee(user, resource, net)
  const sub = pluginSubs.find((s) => s.fileId === fileId)
  if (sub) return canManage(user) || sub.author === user.name
  return false
}

function resourceFileId(resource) {
  if (!resource) return ''
  const ids = Array.isArray(resource.fileIds) ? resource.fileIds : []
  for (const id of ids) {
    if (getFile(id)) return id
  }
  return ''
}

async function refContextForModel(user, net, refs) {
  const out = []
  for (const ref of (Array.isArray(refs) ? refs : []).slice(0, 8)) {
    if (!ref || !ref.id) continue
    if (ref.kind === 'library') {
      const r = liveResources.find((x) => x.id === ref.id)
      if (r && canSee(user, r, net)) {
        out.push(`资料库资源：${r.id} · ${r.name}（${r.type}，${r.source || '—'}）\n简介：${String(r.desc || '').slice(0, 400)}`)
      }
    } else if (ref.kind === 'project') {
      const p = liveProjects.find((x) => x.id === ref.id)
      if (p) out.push(`项目上下文：${p.name} · ${p.desc || p.status || ''}`)
    } else if (ref.kind === 'file') {
      const meta = getFile(ref.id)
      if (meta && fileVisibleToUser(user, net, ref.id)) {
        let excerpt = ''
        if (/\.(txt|md|csv|json|geojson|xml|html|log|yml|yaml)$/i.test(meta.name || '') && meta.size <= 1024 * 1024) {
          try {
            const buffer = readFileBuffer(ref.id)
            excerpt = Buffer.from(buffer).toString('utf8').slice(0, 1200)
          } catch { excerpt = '' }
        }
        out.push(`会话附件：${meta.name}（${meta.size} 字节，${meta.mime || '未知类型'}）\n${excerpt ? `正文摘录：\n${excerpt}` : '（二进制文件，正文未展开）'}`)
      }
    } else if (ref.kind === 'tool') {
      out.push(`已选工具：${ref.label || ref.id}`)
    }
  }
  const rendered = out.join('\n\n')
  return rendered.length > 8000 ? `${rendered.slice(0, 8000)}\n…（会话附件上下文已截断，需要更多内容请读取对应附件）` : rendered
}

let sharpLib
function getSharp() {
  if (sharpLib !== undefined) return sharpLib
  try { sharpLib = createRequire(import.meta.url)('./dsh-runtime/node_modules/sharp') } catch { sharpLib = null }
  return sharpLib
}

/**
 * 图片进入模型前先做尺寸/体积治理：长边不超过 1568，截图统一转 JPEG。
 * 只压缩不上采样；sharp 不可用时保留原图，避免把主链路拖死。
 */
async function prepareImageForModel(buffer, mime, name) {
  const original = {
    data: Buffer.from(buffer).toString('base64'),
    mimeType: mime,
    name: name || 'image',
  }
  const sharp = getSharp()
  if (!sharp) return original
  try {
    const meta = await sharp(buffer).metadata()
    const longEdge = Math.max(Number(meta.width || 0), Number(meta.height || 0))
    if (longEdge <= 1568 && buffer.length <= 2 * 1024 * 1024) return original
    const resized = await sharp(buffer)
      .rotate()
      .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()
    if (!resized.length) return original
    return {
      data: resized.toString('base64'),
      mimeType: 'image/jpeg',
      name: `${String(name || 'image').replace(/\.[^.]+$/, '')}.jpg`,
    }
  } catch {
    return original
  }
}

async function imageBlocksForAgent(user, net, refs) {
  const blocks = []
  for (const ref of (Array.isArray(refs) ? refs : [])) {
    if (blocks.length >= 4) break
    if (!ref || ref.kind !== 'file' || !ref.id) continue
    const meta = getFile(ref.id)
    if (!meta || !fileVisibleToUser(user, net, ref.id)) continue
    const mime = String(meta.mime || '').toLowerCase()
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) continue
    if (Number(meta.size || 0) > 8 * 1024 * 1024) continue
    try {
      const buffer = readFileBuffer(ref.id)
      const prepared = await prepareImageForModel(buffer, mime, meta.name || ref.label || 'image')
      blocks.push({ type: 'image', ...prepared })
    } catch {}
  }
  return blocks
}

const RESOURCE_CONTEXT_LIMIT = 12

function resourcePromptContext(user, net, query = '', limit = RESOURCE_CONTEXT_LIMIT) {
  const visible = liveResources.filter((r) => canSee(user, r, net))
  const terms = String(query || '').toLowerCase().split(/[\s,，。；;、/]+/).filter((t) => t.length >= 2)
  const ranked = visible.map((r, index) => {
    const haystack = `${r.id} ${r.name} ${r.type} ${r.source || ''} ${r.desc || ''}`.toLowerCase()
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0)
    return { r, index, score }
  })
  const chosen = (terms.length ? ranked.sort((a, b) => b.score - a.score || a.index - b.index) : ranked)
    .slice(0, Math.max(1, limit))
    .map((item) => item.r)
  return chosen.map((r) => `- ${r.id}｜${r.name}｜${r.type}｜${r.source || '—'}｜${String(r.desc || '').slice(0, 60)}`).join('\n')
}

async function buildModelMessages({ user, net, text, conv, refs }) {
  const roleLabel = `${user.name}（${user.label}，${user.unit || ''}）`
  const networkLabel = networks[net]?.label || net
  const contextResources = resourcePromptContext(user, net)
  const refContext = await refContextForModel(user, net, refs)
  const system = [
    '你是「九规智能中枢」的企业 AI 助手，服务规划设计院内部员工。',
    `当前用户：${roleLabel}；当前网络：${networkLabel}。`,
    '回答要求：',
    '1. 只依据下方授权资源目录、会话上下文与用户提供的内容作答；不确定时明确说明缺少哪些依据。',
    '2. 不要声称你已经执行了写文件、下载、审批、安装插件等操作；这些操作必须由系统接口完成并在审计中留痕。',
    '3. 引用资源时保留资源 ID（如 R-2026-Q3-IMG），便于系统生成引用。',
    '4. 用简体中文回答，先给结论，再给依据和下一步；不要输出 JSON 或代码块套话。',
    '',
    `当前网络与角色可见资源目录（摘要，最多 ${RESOURCE_CONTEXT_LIMIT} 项；需要更多请调用 drive_search）：`,
    contextResources || '（当前无可见资源）',
    refContext ? `\n会话上下文：\n${refContext}` : '',
  ].filter(Boolean).join('\n')
  const history = (conv?.messages || []).slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.text || '').slice(0, 4000),
  }))
  if (!history.some((m) => m.role === 'user' && m.content === text)) {
    history.push({ role: 'user', content: text })
  }
  return [{ role: 'system', content: system }, ...history]
}

const MARKET_SKILL_SOURCE = join(root, 'marketplace', 'skills')
const DSH_DEFAULT_SKILL_SOURCE = join(root, 'dsh-runtime', 'node_modules', '@deepseek-ai', 'dsh-agent-preset', 'skills')
const SKILL_SOURCE_DIR = {
  'D-01': join(DSH_DEFAULT_SKILL_SOURCE, 'agent-experience'),
  'D-02': join(DSH_DEFAULT_SKILL_SOURCE, 'cordis-composition-reference'),
  'D-03': join(DSH_DEFAULT_SKILL_SOURCE, 'cordis-plugin-development'),
  'D-04': join(DSH_DEFAULT_SKILL_SOURCE, 'editing-cordis-compositions'),
}
const SKILL_INSTALL_DIR = {
  'D-01': 'agent-experience',
  'D-02': 'cordis-composition-reference',
  'D-03': 'cordis-plugin-development',
  'D-04': 'editing-cordis-compositions',
}
const MARKET_PACKAGE_ROOT = join(dataDirPath(), 'market-packages')
const MARKET_MANIFEST = '.jg-market.json'
const USER_AGENT_ROOT = join(dataDirPath(), 'agents')
function userAgentHome(userId) {
  return join(USER_AGENT_ROOT, String(userId || 'guest'))
}
/**
 * Bundle 与 DSH profile 按账号隔离：每个账号一个 DSH_HOME，
 * 只复制平台官方 profile 的基线 bundles 与配置，不继承其他账号安装的 Bundle 或技能。
 */
const OFFICIAL_SKILL_DIRS = ['agent-experience', 'cordis-composition-reference', 'cordis-plugin-development', 'editing-cordis-compositions']
function userDshHome(userId) {
  return join(userAgentHome(userId), 'dsh-home')
}
function ensureUserDshHome(userId) {
  const home = userDshHome(userId)
  const profileDir = join(home, 'profiles', RUNTIME_PROFILE)
  mkdirSync(profileDir, { recursive: true })
  const profileFile = join(profileDir, 'package.json')
  if (!existsSync(profileFile)) {
    let base = null
    try {
      base = JSON.parse(readFileSync(join(dataDirPath(), 'dsh-home', 'profiles', RUNTIME_PROFILE, 'package.json'), 'utf8'))
    } catch {}
    const pkg = base || { name: `dsh-profile-${RUNTIME_PROFILE}`, private: true, dsh: { profile: { bundles: [] } } }
    pkg.dsh = pkg.dsh || {}
    pkg.dsh.profile = pkg.dsh.profile || {}
    pkg.dsh.profile.bundles = Array.isArray(pkg.dsh.profile.bundles) ? [...new Set(pkg.dsh.profile.bundles)] : []
    writeFileSync(profileFile, `${JSON.stringify(pkg, null, 2)}\n`)
  }
  // 官方技能不再作为账号基线自动复制：它们以市场条目发布，由用户自行安装。
  mkdirSync(join(home, 'skills'), { recursive: true })
  // profile 的 patch 层决定 MCP、Office、会话检索等平台模块是否挂载；
  // 初建账号必须复制官方 patch 与 pnpm 配置，否则新 DSH_HOME 会退回空 profile。
  const globalProfile = join(dataDirPath(), 'dsh-home', 'profiles', RUNTIME_PROFILE)
  for (const name of ['cordis.patch.yml', 'cordis.yml', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
    const source = join(globalProfile, name)
    const target = join(profileDir, name)
    if (existsSync(source) && !existsSync(target)) {
      try { cpSync(source, target) } catch {}
    }
  }
  ensureManagedModelPlugins(home)
  return home
}

/**
 * 已有账号的 profile 只在首次创建时复制全局模板，后续平台级模型能力不会自动出现。
 * 这里按“缺什么补什么”的方式幂等补齐，不覆盖账号已有的自定义配置：
 * 1) 先读后写守卫；2) PTC 执行器。账号已经显式停用对应条目时，保留其现有配置。
 */
function ensureManagedModelPlugins(home) {
  const profileDir = join(home, 'profiles', RUNTIME_PROFILE)
  const patchPath = join(profileDir, 'cordis.patch.yml')
  if (!existsSync(patchPath)) return false
  let current = readFileSync(patchPath, 'utf8')
  let changed = false
  if (!current.includes('fs-observation-policy-guard')) {
    const block = [
      '',
      '- id: fs-observation-policy',
      '  disabled: true',
      '- insert:',
      '    - id: fs-observation-policy-guard',
      "      name: '@deepseek-ai/dsh-fs-observation-policy'",
      '',
    ].join('\n')
    current = `${current}${current.endsWith('\n') ? '' : '\n'}${block}`
    changed = true
  }
  if (!current.includes('tool-executor-ptc-enabled')) {
    const block = [
      '',
      '- id: tool-executor-native',
      '  disabled: true',
      '- insert:',
      '    - id: tool-executor-ptc-enabled',
      "      name: '@deepseek-ai/dsh-tool-executor-ptc'",
      '      config:',
      '        maxParallelSubCalls: 10',
      '',
    ].join('\n')
    current = `${current}${current.endsWith('\n') ? '' : '\n'}${block}`
    changed = true
  }
  if (changed) writeFileSync(patchPath, current, 'utf8')
  return changed
}
function projectCwdOf(projectId) {
  const p = liveProjects.find((x) => x.id === projectId)
  return p && p.cwd ? String(p.cwd) : ''
}
function marketSkillDirName(id) {
  return SKILL_INSTALL_DIR[id] || `market-${id}`
}
function marketSkillTarget(id, ctx = {}) {
  const dir = marketSkillDirName(id)
  if (ctx.scope === 'project' && ctx.projectCwd) return join(ctx.projectCwd, '.dsh', 'skills', dir)
  if (ctx.scope === 'user' && ctx.userId) return join(userDshHome(ctx.userId), 'skills', dir)
  return join(dataDirPath(), 'dsh-home', 'skills', dir)
}
function marketSkillSource(id) {
  const mapped = SKILL_SOURCE_DIR[id]
  if (mapped && existsSync(join(mapped, 'SKILL.md'))) return mapped
  const candidates = [join(MARKET_SKILL_SOURCE, id), join(MARKET_PACKAGE_ROOT, id)]
  return candidates.find((dir) => existsSync(join(dir, 'SKILL.md'))) || ''
}
function marketSkillAvailable(id) {
  return Boolean(marketSkillSource(id))
}
function marketSkillManifestAt(target) {
  try {
    return JSON.parse(readFileSync(join(target, MARKET_MANIFEST), 'utf8'))
  } catch {
    return null
  }
}
function marketSkillManifest(id, ctx = {}) {
  return marketSkillManifestAt(marketSkillTarget(id, ctx))
}
function marketSkillGlobalBaseline(id) {
  const physical = marketSkillTarget(id)
  return Boolean((marketSkillManifestAt(physical)?.marketId === id) || (SKILL_INSTALL_DIR[id] && existsSync(join(physical, 'SKILL.md'))))
}
function marketSkillInstalled(id, ctx = {}) {
  const manifest = marketSkillManifest(id, ctx)
  if (manifest && manifest.marketId === id) return true
  if (existsSync(join(marketSkillTarget(id, ctx), 'SKILL.md'))) return true
  return marketSkillGlobalBaseline(id)
}
async function installMarketSkill(item, user, ctx = {}) {
  const source = marketSkillSource(item.id)
  if (!source) {
    throw new Error('该插件尚未提供可安装的技能包')
  }
  if (marketSkillGlobalBaseline(item.id)) {
    throw new Error('该技能已作为全客户端基线安装，不能再按账号或项目重复安装')
  }
  const target = marketSkillTarget(item.id, ctx)
  if (existsSync(target)) {
    const manifest = marketSkillManifestAt(target)
    if (!manifest || manifest.marketId !== item.id) {
      throw new Error('目标技能目录已存在且不是本市场安装的，拒绝覆盖')
    }
    rmSync(target, { recursive: true, force: true })
  }
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
  writeFileSync(join(target, MARKET_MANIFEST), `${JSON.stringify({
    marketId: item.id,
    name: item.name,
    version: '1.0.0',
    installedAt: Date.now(),
    installedBy: String(user.id || ''),
    scope: ctx.scope || 'user',
    projectId: ctx.projectId || '',
  }, null, 2)}\n`, 'utf8')
  // 关闭空闲运行时，下一轮对话重新加载技能目录；有会话执行时由调用方先拒绝。
  await closeHarness()
}
async function uninstallMarketSkill(item, user, ctx = {}) {
  if (marketSkillGlobalBaseline(item.id)) {
    throw new Error('该技能是全客户端基线，不能按单个账号卸载')
  }
  const target = marketSkillTarget(item.id, ctx)
  const manifest = marketSkillManifestAt(target)
  if (!manifest || manifest.marketId !== item.id) {
    throw new Error('该技能不是由当前安装范围的市场记录安装的，拒绝删除')
  }
  rmSync(target, { recursive: true, force: true })
  await closeHarness()
}
const BUNDLE_PACKAGE_ROOT = join(dataDirPath(), 'bundle-packages')
function bundlePackageDir(id) {
  return join(BUNDLE_PACKAGE_ROOT, id)
}
function bundlePackageManifest(id) {
  try {
    return JSON.parse(readFileSync(join(bundlePackageDir(id), 'package.json'), 'utf8'))
  } catch {
    return null
  }
}
function marketBundleAvailable(id) {
  return Boolean(bundlePackageManifest(id)?.name)
}
const MARKET_BACKUP_ROOT = join(dataDirPath(), 'market-backups')
function marketPackageDir(item) {
  if (!item || !item.id) return ''
  return item.kind === 'skill' ? join(MARKET_PACKAGE_ROOT, item.id) : bundlePackageDir(item.id)
}
function marketVersionsOf(id) {
  const list = marketVersions.get(String(id))
  return Array.isArray(list) ? list : []
}
function backupMarketPackage(item, note = '') {
  const target = marketPackageDir(item)
  if (!target || !existsSync(target)) return null
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  const dir = join(MARKET_BACKUP_ROOT, item.id, stamp)
  mkdirSync(dir, { recursive: true })
  cpSync(target, dir, { recursive: true })
  const pkg = item.kind === 'bundle' ? bundlePackageManifest(item.id) : null
  const entry = {
    id: `${item.id}-${stamp}`,
    version: String(pkg?.version || item.version || ''),
    packageName: String(pkg?.name || ''),
    at: new Date().toISOString(),
    rel: relative(dataDirPath(), dir).replace(/\\/g, '/'),
    note,
  }
  const list = marketVersionsOf(item.id).filter((x) => x.rel !== entry.rel)
  list.unshift(entry)
  marketVersions.set(String(item.id), list.slice(0, 5))
  return entry
}
function restoreMarketPackage(item) {
  const list = marketVersionsOf(item.id)
  const entry = list[0]
  if (!entry) throw new Error('该市场条目没有可回滚的版本备份')
  const source = join(dataDirPath(), entry.rel)
  if (!existsSync(source)) throw new Error('版本备份目录已丢失，无法回滚')
  const target = marketPackageDir(item)
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
  const pkg = item.kind === 'bundle' ? bundlePackageManifest(item.id) : null
  const restoredVersion = String(pkg?.version || entry.version || item.version || '')
  if (restoredVersion) item.version = restoredVersion
  item.rolledBackAt = new Date().toISOString()
  list.shift()
  if (list.length) marketVersions.set(String(item.id), list)
  else marketVersions.delete(String(item.id))
  return { item, restoredVersion, remaining: list.length }
}
function profileManifest(home = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')) {
  try {
    return JSON.parse(readFileSync(join(runtimeProfileDir(home), 'package.json'), 'utf8'))
  } catch {
    return null
  }
}
function setProfileBundle(home, name, enabled) {
  const file = join(runtimeProfileDir(home), 'package.json')
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  pkg.dsh = pkg.dsh || {}
  pkg.dsh.profile = pkg.dsh.profile || {}
  const current = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : []
  const next = enabled
    ? (current.includes(name) ? current : [...current, name])
    : current.filter((x) => x !== name)
  pkg.dsh.profile.bundles = next
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  return next
}
function marketBundleInstalled(id, home) {
  const pkg = bundlePackageManifest(id)
  if (!pkg || !pkg.name) return false
  const profile = home ? profileManifest(home) : null
  const bundles = profile?.dsh?.profile?.bundles || []
  return bundles.includes(pkg.name)
}
function bundleInstallUsers(id) {
  const pkg = bundlePackageManifest(id)
  if (!pkg || !pkg.name) return []
  let dirs = []
  try {
    dirs = readdirSync(USER_AGENT_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {}
  return dirs
    .filter((userId) => !userId.startsWith('_'))
    .filter((userId) => marketBundleInstalled(id, userDshHome(userId)))
    .map((userId) => ({
      userId,
      userName: roles[userId]?.name || userId,
      scope: 'account',
      projectId: '',
      installedAt: 0,
    }))
}
function anyUserBundleInstalled(id) {
  return bundleInstallUsers(id).length > 0
}
async function installMarketBundle(item, home) {
  if (!pnpmAvailable()) throw new Error('客户端未内置 pnpm，无法安装 DSH Bundle')
  const pkg = bundlePackageManifest(item.id)
  if (!pkg || !pkg.name) throw new Error('该插件尚未提供可安装的 Bundle 包')
  const dir = bundlePackageDir(item.id)
  const result = runDshPlugin(['add', `file:${dir.replace(/\\/g, '/')}`], 180000, home)
  if (result.status !== 0) {
    throw new Error(`Bundle 安装失败：${(result.stderr || result.stdout || 'pnpm 未返回诊断').slice(-1800)}`)
  }
  const bundles = profileManifest(home)?.dsh?.profile?.bundles || []
  if (!bundles.includes(pkg.name)) setProfileBundle(home, pkg.name, true)
  const installed = marketBundleInstalled(item.id, home)
  if (!installed) {
    runDshPlugin(['remove', pkg.name], 180000, home)
    setProfileBundle(home, pkg.name, false)
    throw new Error('Bundle 已下载但未进入当前账号的 profile bundles，已回滚；请检查包内 dsh.bundle 与 cordis.patch.yml')
  }
  await closeHarnessForHome(home)
}
async function uninstallMarketBundle(item, home) {
  const pkg = bundlePackageManifest(item.id)
  if (!pkg || !pkg.name) throw new Error('插件包信息已失效')
  const result = runDshPlugin(['remove', pkg.name], 180000, home)
  if (result.status !== 0) {
    throw new Error(`Bundle 卸载失败：${(result.stderr || result.stdout || 'pnpm 未返回诊断').slice(-1800)}`)
  }
  setProfileBundle(home, pkg.name, false)
  await closeHarnessForHome(home)
}
function marketItemState(item, ctx = {}) {
  const sub = item.subId ? pluginSubs.find((s) => s.id === item.subId) : null
  const isBundle = item.kind === 'bundle'
  const globalBaseline = !isBundle && marketSkillGlobalBaseline(item.id)
  const records = marketInstallRecords(item.id)
  const userRecord = records.find((r) => r.userId === ctx.userId)
  const home = ctx.userId ? userDshHome(ctx.userId) : ''
  const bundleUsers = isBundle ? bundleInstallUsers(item.id) : []
  const installed = isBundle
    ? (ctx.any ? anyUserBundleInstalled(item.id) : Boolean(home && marketBundleInstalled(item.id, home)))
    : ctx.any
      ? (globalBaseline || records.length > 0)
      : (globalBaseline || Boolean(userRecord))
  return {
    ...item,
    type: isBundle || item.kind === 'plugin' ? 'plugin' : 'skill',
    listed: item.listed !== false,
    origin: sub ? 'community' : 'builtin',
    submittedBy: sub ? sub.author : '',
    submittedUnit: sub ? sub.unit : '',
    available: isBundle ? marketBundleAvailable(item.id) : marketSkillAvailable(item.id),
    installed,
    locked: globalBaseline,
    installedScope: isBundle ? (installed ? 'account' : '') : (userRecord ? userRecord.scope : ''),
    installedProjectId: isBundle ? '' : (userRecord ? userRecord.projectId || '' : ''),
    installScope: isBundle ? '当前账号的 DSH 运行时（其他账号不可见）' : '当前账号或项目技能目录（互不可见）',
    installUsers: isBundle
      ? bundleUsers
      : globalBaseline
        ? [{ userId: '*', userName: '全客户端基线', scope: 'baseline', projectId: '', installedAt: 0 }]
        : records,
    downloadUrl: sub && sub.fileId ? `/api/plugin-market/download?id=${encodeURIComponent(item.id)}` : '',
    versions: marketVersionsOf(item.id).map((v) => ({ version: v.version, at: v.at, note: v.note || '' })),
    canRollback: Boolean(sub && marketVersionsOf(item.id).length),
  }
}

async function runProjectCodeReview(user, body, net) {
  const projectId = String(body.projectId || '')
  if (!projectId) return { error: jsonError(400, '请选择要审查的项目') }
  const project = liveProjects.find((p) => p.id === projectId && !p.removed)
  if (!project || !projectVisibleTo(user, project)) return { error: jsonError(403, '当前身份无权审查该项目') }
  if (!project.cwd) return { error: jsonError(400, '该项目尚未绑定本地文件夹；请先在项目设置中绑定代码目录。') }
  if (projectStatus(project) !== 'online') return { error: jsonError(400, `项目目录当前不可用：${projectStatus(project)}`) }
  try {
    const result = await runHarnessService('code-review', { cwd: project.cwd, scope: body.scope, maxFiles: body.maxFiles })
    const report = result.report
    logAudit(user, 'harness.code-review', `${projectId}:${report.scanned}`, `findings=${report.summary.total}`, net)
    return { project: { id: project.id, name: project.name, cwd: project.cwd }, report, service: result.service }
  } catch (error) {
    return { error: { status: Number(error?.status) || 500, body: { error: '代码审查执行失败', detail: String(error?.message || error) } } }
  }
}

function jsonError(status, error, extra = {}) {
  return { status, body: { error, ...extra } }
}

// 本地开源语音合成：Piper（MIT）中文神经语音模型，离线生成 WAV，不把回复文本外发给第三方。
const PIPER_DIR = join(root, 'data', 'tts', 'piper', 'piper')
const PIPER_EXE = join(PIPER_DIR, process.platform === 'win32' ? 'piper.exe' : 'piper')
const PIPER_MODEL = join(PIPER_DIR, 'zh_CN-huayan-medium.onnx')
const PIPER_MODEL_JSON = join(PIPER_DIR, 'zh_CN-huayan-medium.onnx.json')
const PIPER_CACHE_DIR = join(dataDirPath(), 'tts-cache')

function piperReady() {
  return existsSync(PIPER_EXE) && existsSync(PIPER_MODEL) && existsSync(PIPER_MODEL_JSON)
}

function synthesizeWithPiper(text, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(PIPER_EXE, [
      '--model', PIPER_MODEL,
      '--output_file', outputPath,
      '--length_scale', '1.0',
    ], { cwd: PIPER_DIR, windowsHide: true })
    let stderr = ''
    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      reject(new Error('语音合成超时'))
    }, 60000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-800) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && existsSync(outputPath) && statSync(outputPath).size > 0) return resolve(outputPath)
      reject(new Error(`本地语音合成失败（${code}）：${stderr.trim()}`))
    })
    child.stdin.end(String(text || ''), 'utf8')
  })
}

async function localTtsFile(text) {
  if (!piperReady()) {
    const error = new Error('本地语音模型未安装')
    error.code = 'TTS_NOT_READY'
    throw error
  }
  mkdirSync(PIPER_CACHE_DIR, { recursive: true })
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 24)
  const finalPath = join(PIPER_CACHE_DIR, `${hash}.wav`)
  if (existsSync(finalPath) && statSync(finalPath).size > 0) return { file: finalPath, name: `${hash}.wav`, cached: true }
  const tmpPath = join(PIPER_CACHE_DIR, `${hash}.${process.pid}.${randomBytes(4).toString('hex')}.tmp.wav`)
  try {
    await synthesizeWithPiper(text, tmpPath)
    try {
      renameSync(tmpPath, finalPath)
    } catch {
      if (!(existsSync(finalPath) && statSync(finalPath).size > 0)) throw new Error('语音文件写入失败')
      try { rmSync(tmpPath, { force: true }) } catch {}
    }
    return { file: finalPath, name: `${hash}.wav`, cached: false }
  } catch (error) {
    try { rmSync(tmpPath, { force: true }) } catch {}
    throw error
  }
}

const api = {
  'GET /api/harness/services': (req, res) => {
    json(res, 200, { items: HARNESS_BASE_SERVICES })
  },
  'POST /api/harness/services/code-review': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const result = await runProjectCodeReview(user, body, netOf(req))
    if (result.error) return json(res, result.error.status, result.error.body)
    json(res, 200, { ok: true, ...result })
  },
  // 兼容旧路径；内部已统一交给 Harness 基础服务，不再保留第二套实现。
  'POST /api/code-review/run': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const result = await runProjectCodeReview(user, body, netOf(req))
    if (result.error) return json(res, result.error.status, result.error.body)
    json(res, 200, { ok: true, ...result })
  },
  'GET /api/usage/summary': (req, res) => {
    const user = roleOf(req)
    const mine = conversations.filter((conv) => conv.userId === user.id)
    const totals = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 }
    const models = new Map()
    const records = []
    let assistantMessages = 0
    let usageMessages = 0
    for (const conv of mine) {
      for (const message of (conv.messages || [])) {
        if (message.role !== 'assistant') continue
        assistantMessages += 1
        const usage = message.usage
        if (!usage || typeof usage !== 'object') continue
        const input = Number(usage.inputTokens ?? usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0
        const output = Number(usage.outputTokens ?? usage.completion_tokens ?? usage.output_tokens ?? 0) || 0
        const total = Number(usage.totalTokens ?? usage.total_tokens ?? (input + output)) || 0
        const calls = Number(usage.calls ?? 1) || 1
        if (!input && !output && !total && !usage.calls) continue
        usageMessages += 1
        totals.requests += calls
        totals.inputTokens += input
        totals.outputTokens += output
        totals.totalTokens += total || input + output
        totals.cacheReadTokens += Number(usage.cacheReadTokens ?? usage.cache_read_tokens ?? 0) || 0
        totals.cacheWriteTokens += Number(usage.cacheWriteTokens ?? usage.cache_write_tokens ?? 0) || 0
        totals.reasoningTokens += Number(usage.reasoningTokens ?? usage.reasoning_tokens ?? 0) || 0
        const modelName = String(message.model || conv.model || '未记录模型')
        const entry = models.get(modelName) || { model: modelName, requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        entry.requests += calls
        entry.inputTokens += input
        entry.outputTokens += output
        entry.totalTokens += total || input + output
        models.set(modelName, entry)
        records.push({
          conversationId: conv.id,
          conversationTitle: conv.title || '未命名会话',
          at: message.usageAt ? new Date(message.usageAt).toISOString() : '',
          time: message.time || '',
          model: modelName,
          calls,
          inputTokens: input,
          outputTokens: output,
          totalTokens: total || input + output,
        })
      }
    }
    records.sort((a, b) => String(b.at || b.time).localeCompare(String(a.at || a.time)))
    logAudit(user, 'usage.summary', user.id, `requests=${totals.requests}`, netOf(req))
    json(res, 200, {
      ok: true,
      user: user.name,
      totals,
      models: [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens),
      records: records.slice(0, 50),
      coverage: {
        conversations: mine.length,
        assistantMessages,
        usageMessages,
        note: usageMessages ? '仅统计 DSH 实际返回 usage 的轮次，未返回 usage 的历史轮次不估算、不补齐。' : '当前账号尚无带真实 usage 的模型轮次；发起一次模型对话后才会产生计量数据。',
      },
    })
  },
  'GET /api/bootstrap': (req, res) => {
    const session = sessionOf(req)
    const account = session?.accountId ? getAccount(session.accountId) : null
    const user = roleOf(req)
    const net = netOf(req)
    const conf = networks[net]
    const visible = liveResources.filter((r) => canSee(user, r, net))
    json(res, 200, {
      user: { ...user, role: user.id },
      network: { id: net, ...conf },
      allNetworks: networkOrder.map((n) => ({ id: n, label: networks[n].label })),
      allRoles: listAccounts().map((account) => {
        const role = userOfAccount(account)
        return {
          id: account.id,
          accountId: account.id,
          username: account.username || '',
          role: account.role,
          label: role.label,
          name: role.name,
          unit: role.unit,
          duty: role.duty,
        }
      }),
      modules,
      quickPrompts,
      counts: {
        resources: visible.length,
        resourcesTotal: liveResources.length,
        plugins: installedSkillPlugins().filter((p) => (p.nets || ['inet']).includes(net)).length,
        capabilities: platformCapabilities(accountRuntimeHome(user)).filter((p) => p.layer !== 'kernel' && p.enabled && (p.nets || ['inet']).includes(net)).length,
        apps: liveApps.filter((a) => (a.nets || []).includes(net)).length,
        tasks: liveTasks.length,
      },
      conversations: user.id === 'guest' ? [] : conversations.map((c) => ({ id: c.id, title: c.title, kind: c.kind, time: c.time, model: c.model, turns: c.turns, status: c.status, workspace: c.workspace, projectId: c.projectId || '', dshSessionId: c.dshSessionId || '', agentPresetId: c.agentPresetId || '' })),
      tasks: user.id === 'guest' ? [] : liveTasks,
      tools: conf.tools,
      models: user.id === 'guest' ? [] : conf.models,
      imageGeneration: imageGenerationStatus(user, net),
      groupModels: conf.models,
      ownApiRequired: user.id === 'guest',
      agentPresets: agentPresets.map((p) => ({ ...p })),
      duties: dutiesOf(user),
      dutyCatalog,
      authed: !!session,
      mustChangePassword: !!account?.mustChangePassword,
      messagesUnread: liveMessages.filter((m) => m.unread).length,
      orgSummary: { units: orgUnits.length, members: liveMembers.length, multiPost: liveMembers.filter((m) => m.posts.length > 1).length },
      orgUnits,
      settings: { ...runtimeSettings },
      runtime: runtimeOverview(user.id === 'guest' ? undefined : ensureUserDshHome(user.id)),
    })
  },
  'GET /api/captcha': (req, res) => {
    res.setHeader('cache-control', 'no-store')
    json(res, 200, { ok: true, ...createCaptchaChallenge() })
  },
  'POST /api/login': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const captchaId = String(body.captchaId || '')
    const captchaAnswer = body.captchaAnswer == null ? '' : String(body.captchaAnswer)
    if (!captchaId || !captchaAnswer.trim()) {
      return json(res, 400, { error: '请先填写验证码', code: 'CAPTCHA_REQUIRED' })
    }
    if (!consumeCaptcha(captchaId, captchaAnswer)) {
      return json(res, 400, { error: '验证码不正确或已过期，请换一个', code: 'BAD_CAPTCHA' })
    }
    const username = String(body.username || '').trim()
    const loginRole = String(body.role || '')
    const accountId = String(body.accountId || loginRole || '')
    let account = username ? getAccountByUsername(username) : null
    if (!account && accountId) account = getAccount(accountId)
    if (!account && loginRole) account = getAccountByRole(loginRole)
    if (!account) return json(res, 400, { error: '用户名或密码不正确', code: 'BAD_CREDENTIALS' })
    const password = String(body.password || '')
    if (!password) return json(res, 400, { error: '请输入登录密码', code: 'PASSWORD_REQUIRED' })
    if (!account.passwordHash) {
      setAccountPassword(account.id, hashPassword(defaultPasswordForName(account.name, account.id)), true)
      account = getAccount(account.id)
    }
    if (!verifyPassword(password, account.passwordHash)) {
      logAudit(userOfAccount(account), 'auth.login', account.id, 'deny', netOf(req))
      return json(res, 401, { error: '用户名或密码不正确', code: 'BAD_CREDENTIALS' })
    }
    const role = userOfAccount(account)
    closeAllCloudSessions('身份切换，云会话由服务端强制结束')
    const sid = createSession(account.role, netOf(req), undefined, account.id)
    res.setHeader('set-cookie', [
      sessionCookie(sid),
      'jg_role=; Path=/; Max-Age=0; SameSite=Lax',
    ])
    logAudit(role, 'auth.login', role.id, 'allow', netOf(req))
    json(res, 200, {
      ok: true,
      user: role,
      accountId: account.id,
      username: account.username || username,
      mustChangePassword: !!account.mustChangePassword,
    })
  },
  'POST /api/account/password': (req, res) => {
    const session = sessionOf(req)
    const account = session?.accountId ? getAccount(session.accountId) : null
    if (!session || !account) return json(res, 401, { error: '未登录或账号会话已失效', code: 'AUTH_REQUIRED' })
    const body = JSON.parse(req.__body || '{}')
    const currentPassword = String(body.currentPassword || '')
    const nextPassword = String(body.nextPassword || body.newPassword || '')
    if (!verifyPassword(currentPassword, account.passwordHash)) {
      logAudit(userOfAccount(account), 'auth.password.change', account.id, 'deny', netOf(req))
      return json(res, 401, { error: '当前密码不正确', code: 'BAD_CURRENT_PASSWORD' })
    }
    if (nextPassword.length < 8 || nextPassword.length > 64 || !/[A-Za-z]/.test(nextPassword) || !/\d/.test(nextPassword)) {
      return json(res, 400, { error: '新密码需 8–64 位，且至少包含字母和数字', code: 'WEAK_PASSWORD' })
    }
    if (nextPassword === currentPassword) return json(res, 400, { error: '新密码不能与当前密码相同', code: 'PASSWORD_UNCHANGED' })
    setAccountPassword(account.id, hashPassword(nextPassword), false)
    logAudit(userOfAccount(account), 'auth.password.change', account.id, 'allow', netOf(req))
    json(res, 200, { ok: true, mustChangePassword: false })
  },
  'POST /api/network': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    if (!networks[body.id]) return json(res, 400, { error: 'unknown network' })
    closeAllCloudSessions('网络切换，云会话由服务端强制结束')
    const session = sessionOf(req)
    if (session) updateSessionNet(session.id, body.id)
    res.setHeader('set-cookie', `jg_net=${body.id}; Path=/; SameSite=Lax`)
    json(res, 200, { ok: true, network: { id: body.id, ...networks[body.id] } })
  },
  'POST /api/settings': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可修改运行时设置' })
    const body = JSON.parse(req.__body || '{}')
    Object.assign(runtimeSettings, sanitizeRuntimeSettings({ ...runtimeSettings, ...body }))
    persistPersistentState()
    logAudit(user, 'settings.runtime.update', 'runtime', JSON.stringify(runtimeSettings), netOf(req))
    json(res, 200, { ok: true, settings: { ...runtimeSettings }, runtime: runtimeOverview(user.id === 'guest' ? undefined : ensureUserDshHome(user.id)) })
  },
  'GET /api/agent-presets': (req, res) => {
    json(res, 200, { ok: true, items: agentPresets.map((p) => ({ ...p })) })
  },
  'POST /api/agent-presets': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可维护 Agent 预设' })
    const body = JSON.parse(req.__body || '{}')
    const preset = sanitizeAgentPreset(body)
    if (!preset.name) return json(res, 400, { error: '预设名称不能为空' })
    const existing = agentPresets.find((p) => p.id === preset.id)
    if (existing) Object.assign(existing, preset)
    else {
      preset.id = preset.id || `APRESET-${Date.now()}`
      preset.createdAt = new Date().toISOString()
      agentPresets.push(preset)
    }
    persistPersistentState()
    logAudit(user, existing ? 'agent-preset.update' : 'agent-preset.create', preset.id, preset.name, netOf(req))
    json(res, 200, { ok: true, item: preset, items: agentPresets.map((p) => ({ ...p })) })
  },
  'DELETE /api/agent-presets': (req, res, url) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可维护 Agent 预设' })
    let body = {}
    try { body = JSON.parse(req.__body || '{}') } catch {}
    const id = String(url?.searchParams?.get('id') || body.id || '')
    const idx = agentPresets.findIndex((p) => p.id === id)
    if (idx < 0) return json(res, 404, { error: '预设不存在' })
    const [removed] = agentPresets.splice(idx, 1)
    persistPersistentState()
    logAudit(user, 'agent-preset.delete', removed.id, removed.name, netOf(req))
    json(res, 200, { ok: true, items: agentPresets.map((p) => ({ ...p })) })
  },
  'GET /api/runtime/plugins': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可管理运行时插件' })
    const home = ensureUserDshHome(user.id)
    refreshRuntimeConfigDump(home)
    const plugins = runtimePluginInventory(home)
    json(res, 200, {
      ok: true,
      profile: RUNTIME_PROFILE,
      source: 'dsh-dump-config.txt（按当前账号 DSH_HOME 生成）',
      protectedIds: [...PROTECTED_PLUGIN_IDS],
      plugins,
    })
  },
  'POST /api/runtime/plugins': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可管理运行时插件' })
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.id || '').trim()
    if (!id) return json(res, 400, { error: '缺少插件条目 id' })
    try {
      const home = ensureUserDshHome(user.id)
      const result = setRuntimePluginEnabled(id, Boolean(body.enabled), home)
      refreshRuntimeConfigDump(home)
      logAudit(user, 'runtime-plugin.toggle', id, Boolean(body.enabled) ? 'enable' : 'disable', netOf(req))
      json(res, 200, { ok: true, result, plugins: runtimePluginInventory(home) })
    } catch (err) {
      json(res, 400, { error: err.message, code: 'RUNTIME_PLUGIN_TOGGLE_FAILED' })
    }
  },
  'POST /api/runtime/restart': async (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可重启运行时' })
    try {
      await closeHarness()
      logAudit(user, 'runtime.restart', 'profile', RUNTIME_PROFILE, netOf(req))
      json(res, 200, { ok: true, message: '运行时进程已关闭；下一个会话将按新配置启动' })
    } catch (err) {
      json(res, 502, { error: `运行时重启失败：${err.message}` })
    }
  },
  'GET /api/runtime/bundles': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可管理运行时组合包' })
    const home = ensureUserDshHome(user.id)
    const manifest = join(runtimeProfileDir(home), 'package.json')
    let bundles = []
    let dependencies = []
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
      bundles = pkg?.dsh?.profile?.bundles || []
      dependencies = Object.keys(pkg?.dependencies || {})
    }
    json(res, 200, { ok: true, profile: RUNTIME_PROFILE, bundles, dependencies, installAvailable: Boolean(pnpmAvailable()), scope: 'account' })
  },
  'POST /api/runtime/bundles': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可管理运行时组合包' })
    const body = JSON.parse(req.__body || '{}')
    const name = String(body.name || '').trim()
    if (!name) return json(res, 400, { error: '缺少组合包名称' })
    const home = ensureUserDshHome(user.id)
    const manifest = join(runtimeProfileDir(home), 'package.json')
    if (!existsSync(manifest)) return json(res, 404, { error: 'profile 清单不存在' })
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    const list = pkg?.dsh?.profile?.bundles || []
    const next = Boolean(body.enabled)
      ? (list.includes(name) ? list : [...list, name])
      : list.filter((x) => x !== name)
    pkg.dsh = pkg.dsh || {}
    pkg.dsh.profile = pkg.dsh.profile || {}
    pkg.dsh.profile.bundles = next
    writeFileSync(manifest, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
    closeHarnessForHome(home).catch(() => {})
    logAudit(user, 'runtime-bundle.toggle', name, next ? 'enable' : 'disable', netOf(req))
    json(res, 200, { ok: true, bundles: next, restartRequired: true })
  },
  'POST /api/runtime/bundles/install': async (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可安装组合包' })
    const body = JSON.parse(req.__body || '{}')
    const spec = String(body.spec || '').trim()
    if (!spec) return json(res, 400, { error: '缺少组合包 spec' })
    if (!pnpmAvailable()) {
      return json(res, 501, { error: '当前环境没有 pnpm，无法安装组合包。请先在客户端环境安装 pnpm，或使用离线 profile 包。', code: 'PNPM_MISSING' })
    }
    const home = ensureUserDshHome(user.id)
    const result = runDshPlugin(['add', spec], 180000, home)
    const okRun = result.status === 0
    if (okRun) await closeHarnessForHome(home)
    logAudit(user, 'runtime-bundle.install', spec, okRun ? 'ok' : 'failed', netOf(req))
    if (!okRun) {
      return json(res, 502, {
        error: `组合包安装失败：${(result.stderr || result.stdout || 'pnpm 未返回诊断').slice(-2000)}`,
        code: 'RUNTIME_BUNDLE_INSTALL_FAILED',
      })
    }
    json(res, 200, { ok: true, stdout: (result.stdout || '').slice(-4000), restartRequired: true })
  },
  'GET /api/mcp/resources': (req, res, url) => {
    const user = mcpRequestUser(req)
    const net = netOf(req)
    const catalog = mcpCatalog(user, net, url.searchParams.get('q') || '')
    json(res, 200, { ok: true, ...catalog })
  },
  'GET /api/mcp/resource': (req, res, url) => {
    const user = mcpRequestUser(req)
    const net = netOf(req)
    const uri = url.searchParams.get('uri') || ''
    const item = readMcpResource(user, net, uri)
    if (!item) return json(res, 404, { error: 'MCP 资源不存在或当前身份无权读取' })
    json(res, 200, { ok: true, ...item })
  },
  'GET /api/datacenter/overview': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    json(res, 200, { ok: true, ...buildOverview(user, net) })
  },
  'GET /api/resources': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const type = url.searchParams.get('type') || 'all'
    const category = url.searchParams.get('category') || 'all'
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const list = liveResources
      .filter((r) => canSee(user, r, net))
      .filter((r) => (type === 'all' ? true : r.type === type))
      .filter((r) => (category === 'all' ? true : categoryKey(businessCategoryOf(r)) === categoryKey(category)))
      .filter((r) => (q ? `${r.name}${r.source}${r.desc}${businessCategoryOf(r)}`.toLowerCase().includes(q) : true))
      .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))
    logAudit(user, 'resource.search', `type=${type} category=${category} q=${q || '-'}`, `allow(${list.length})`, net)
    json(res, 200, {
      items: list.map(pickResource).map((x) => {
        const raw = liveResources.find((r) => r.id === x.id)
        return { ...x, canEdit: canEditResource(user, raw), canDownload: canSee(user, raw, net) }
      }),
      totalVisible: list.length,
      totalAll: liveResources.filter((r) => (r.nets || []).includes(net)).length,
      categories: [...new Set(list.map((r) => businessCategoryOf(r)))],
    })
  },
  'GET /api/resource': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const id = url.searchParams.get('id')
    const resource = liveResources.find((r) => r.id === id)
    if (!resource) return json(res, 404, { error: '资源不存在' })
    if (!canSee(user, resource, net)) {
      logAudit(user, 'resource.read', id, 'deny(403)', net)
      return json(res, 403, {
        error: '越权访问已被拦截',
        detail: `资源「${resource.name}」不在当前网络（${networks[net].label}）与角色的授权范围内；目录、详情、下载链接三处一致判定。`,
        resource: { id: resource.id, name: resource.name, security: resource.security },
      })
    }
    logAudit(user, 'resource.read', id, 'allow', net)
    resourceReads.set(id, (resourceReads.get(id) || 0) + 1)
    json(res, 200, {
      item: {
        ...resource,
        businessCategory: businessCategoryOf(resource),
        dataOwner: resource.dataStandard?.dataOwner || resource.contact || '',
      },
      fieldGroups: fieldGroupsOf(resource),
      canPreview: resource.status === 'authorized',
      permissions: {
        canEdit: canEditResource(user, resource),
        canDownload: true,
        editApproval: canApproveEdit(user),
      },
      editRequest: liveEditRequests.get(id) || null,
      downloadRequest: liveDownloadRequests.get(id) || null,
    })
  },
  'POST /api/resources/register': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    if (user.id === 'guest') return json(res, 403, { error: '外部访客不能上传数据；需由集团员工或部门负责人登记' })
    const body = JSON.parse(req.__body || '{}')
    const kind = ['pure', 'deliverable', 'service'].includes(body.kind) ? body.kind : 'pure'
    const id = `R-NEW-${String(liveResources.length + 1).padStart(2, '0')}`
    const now = stamp()
    const rawFiles = Array.isArray(body.files) ? body.files.slice(0, 200) : []
    const requestedFileIds = Array.isArray(body.fileIds) ? body.fileIds.slice(0, 200).map((x) => String(x || '')) : []
    const validFileIds = requestedFileIds.filter((fid) => {
      const meta = fid && getFile(fid)
      return !!(meta && (meta.owner === user.name || canManage(user)))
    })
    const files = rawFiles.map((f, i) => ({ ...f, fileId: validFileIds[i] || f.fileId || '' }))
    const actualBytes = validFileIds.reduce((sum, fid) => {
      const meta = getFile(fid)
      return sum + (meta ? meta.size : 0)
    }, 0)
    const formats = Array.isArray(body.formats) && body.formats.length
      ? body.formats
      : [...new Set(files.map((f) => String(f.name || f.path || '').split('.').pop().toUpperCase()).filter((x) => x && x !== '文件'))]
    const dataDate = body.dataDate || body.period || ''
    const businessCategory = body.businessCategory || body.domain || '其他'
    const originalSource = body.originalSource || (body.sourceType === 'cloud' ? '企业云空间现有资料' : '集团自产')
    const internalLevel = /^L[1-5]$/.test(String(body.internalLevel || '')) ? body.internalLevel : 'L2'
    const secrecy = body.secrecy || (body.security === 'secret' ? '待认定' : '非涉密')
    const zoneIds = Array.isArray(body.zones) ? body.zones : (Array.isArray(body.nets) ? body.nets : [net])
    const zones = [...new Set(zoneIds.map((z) => ({ 内网: 'intranet', 政务外网: 'gov', 互联网: 'inet', intranet: 'intranet', gov: 'gov', inet: 'inet' }[z] || z)).filter((z) => ZONE_LABEL[z]))]
    if (zones.includes('inet')) {
      if (!zones.includes('gov')) zones.push('gov')
      if (!zones.includes('intranet')) zones.push('intranet')
    }
    if (zones.includes('gov') && !zones.includes('intranet')) zones.push('intranet')
    const orderedZones = ['intranet', 'gov', 'inet'].filter((z) => zones.includes(z))
    zones.length = 0
    zones.push(...orderedZones)
    const authorizationType = body.authorizationType === 'orgs' ? 'orgs' : 'group'
    const accessScope = ['self', 'dept', 'group', 'orgs'].includes(body.accessScope) ? body.accessScope : 'dept'
    const autoRegistered = regAutoApproved(kind, { ...body, internalLevel, secrecy, accessScope })
    const authorizedOrgs = authorizationType === 'orgs' && Array.isArray(body.authorizedOrgs) ? body.authorizedOrgs : []
    const rightsBasis = body.rightsBasis || ''
    const sourceOrg = body.sourceOrg || user.unit
    const dataOwner = body.dataOwner || user.name
    const projectLinked = body.projectLinked === true
    const projectId = body.projectId || ''
    const projectName = body.projectName || body.project || ''
    const spatialEnabled = body.spatial && body.spatial.enabled === true
    const adminResult = spatialEnabled ? recognizeAdmin(body.spatial.extent) : null
    const spatial = {
      enabled: !!spatialEnabled,
      type: spatialEnabled ? (body.spatial.type || 'GIS_VECTOR') : '',
      typeLabel: spatialEnabled ? (body.spatial.typeLabel || body.spatial.type || 'GIS 矢量') : '',
      mapCatalog: spatialEnabled ? (body.spatial.mapCatalog || '') : '',
      mapPath: spatialEnabled ? (body.spatial.mapPath || '') : '',
      regions: spatialEnabled ? (adminResult?.path || body.spatial.regions || '') : '',
      adminLevel: spatialEnabled ? (adminResult?.level || '') : '',
      adminNote: spatialEnabled ? (adminResult?.note || '') : '',
      crs: spatialEnabled ? (body.spatial.crs || body.crs || '') : '',
      extent: spatialEnabled ? (body.spatial.extent || body.coverage || '') : '',
      scale: spatialEnabled ? (body.spatial.scale || '') : '',
      datasetId: spatialEnabled ? `SD-${id}` : '',
    }
    const hasNewSecurity = !!(body.internalLevel || body.secrecy || body.zones || body.authorizationType)
    const security = hasNewSecurity
      ? ((secrecy !== '非涉密' || Number(internalLevel.slice(1)) >= 4) ? 'secret' : 'internal')
      : (body.security || 'internal')
    const scope = authorizationType === 'orgs' && authorizedOrgs.length
      ? [...new Set([...authorizedOrgs, `unit:${user.unit}`])]
      : ['internal', `unit:${user.unit}`]
    const keywords = Array.isArray(body.keywords)
      ? body.keywords
      : String(body.keywords || '').split(/[,，\s]+/).filter(Boolean)
    const aiMeta = {
      domain: businessCategory,
      subtype: '',
      project: projectName,
      projectCode: projectId,
      coverage: spatial.extent || body.coverage || '',
      period: dataDate,
      updateFreq: body.updateFreq || '',
      keywords,
      caps: Array.isArray(body.caps) ? body.caps : [],
      summary: body.description || body.desc || '',
      searchText: [body.name, businessCategory, projectName, spatial.mapPath, spatial.regions, dataDate, keywords.join(' ')].filter(Boolean).join(' '),
    }
    const service = kind === 'service' ? {
      url: body.serviceUrl || '',
      type: body.serviceType || 'QGIS WMS',
      layers: body.layerCount || 0,
      auth: body.authMode || '统一网关票据',
      provider: body.serviceProvider || sourceOrg,
      networkZone: body.serviceZone || '',
      rateLimit: body.rateLimit || '',
      detectStatus: body.serviceDetectStatus || '',
      updateFreq: body.updateFreq || '',
      sla: body.sla || '',
    } : null
    const qualityRequired = body.qcRequired === true
    const quality = qualityRequired
      ? { required: true, software: body.qcSoftware || '规划成果质检系统', status: 'pending', reportNo: '', manifest: !!body.manifest }
      : { required: false, software: '', status: 'not-required', reportNo: '', manifest: !!body.manifest }
    const item = {
      id,
      name: body.name || '未命名资源',
      type: kind === 'service' ? 'service' : kind === 'deliverable' ? 'deliverable' : (body.type || 'document'),
      format: kind === 'service' ? (body.serviceType || 'OGC API') : kind === 'deliverable' ? '成果包（多格式）' : (body.format || formats[0] || 'PDF'),
      regKind: kind,
      accessScope,
      publishStatus: kind === 'service' ? 'pending-review' : 'unpublished',
      sourceType: body.sourceType === 'cloud' ? 'cloud' : 'local',
      source: body.source || (body.sourceType === 'cloud' ? '企业云空间' : '本地上传'),
      sourceRef: Array.isArray(body.sourceRef) ? body.sourceRef : [],
      files,
      fileIds: validFileIds,
      formats,
      updated: now,
      owner: sourceOrg,
      producer: sourceOrg,
      contact: dataOwner,
      security,
      nets: zones.length ? zones : [net],
      scope,
      size: actualBytes
        ? (actualBytes >= 1024 ** 3 ? `${(actualBytes / 1024 ** 3).toFixed(1)} GB` : actualBytes >= 1024 ** 2 ? `${(actualBytes / 1024 ** 2).toFixed(1)} MB` : `${(actualBytes / 1024).toFixed(0)} KB`)
        : (body.size || (files.length ? `${files.length} 个文件` : '—')),
      status: autoRegistered ? 'authorized' : 'pending-dept',
      action: kind === 'service' ? '服务调用 · 图层查询' : kind === 'deliverable' ? '成果包预览 · 空间检索 · 批量下载' : '在线预览 · 全文检索',
      meta: { version: body.version || 'V1.0', crs: spatial.crs || body.crs || '', coverage: spatial.extent || body.coverage || '' },
      aiMeta,
      spatial,
      securityMeta: { internalLevel, secrecy, requestedZones: zones, approvedZones: [], authorizationType, authorizedOrgs, rightsBasis, accessScope },
      project: { linked: projectLinked, projectId, projectName },
      result: kind === 'deliverable' ? { projectId, resourceId: id, internalDataId: `PKG-${id}`, category: body.resultCategory || '', stage: body.resultStage || '', version: body.version || 'V1.0', formal: body.formalResult === true, qcStatus: qualityRequired ? 'pending' : 'not-required', qcReportId: '' } : null,
      dataStandard: {
        schemaVersion: '1.0', dataId: id, dataType: REG_KIND_LABEL[kind], dataName: body.name || '未命名资源',
        businessCategory, uploader: user.name, dataOwner, sourceOrg, originalSource, dataDate,
        registeredAt: now, formats, sizeBytes: actualBytes || Number(body.sizeBytes || 0) || 0,
        security: { internalLevel, secrecy, requestedZones: zones, approvedZones: [], authorizationType, authorizedOrgs, rightsBasis, accessScope },
        project: { linked: projectLinked, projectId, projectName, stage: body.resultStage || '', version: body.version || '' },
        confirmation: { status: (kind === 'deliverable' && body.formalResult === true) ? 'PENDING' : 'NOT_REQUIRED', confirmedBy: null, confirmedAt: null },
        registrationStatus: autoRegistered ? 'REGISTERED' : 'PENDING_DEPT',
        publishStatus: kind === 'service' ? 'PENDING_REVIEW' : 'UNPUBLISHED',
      },
      service,
      quality,
      workflow: regWorkflow(kind, user, body),
      desc: body.description || body.desc || '本次登记的资源，原始文件保留在来源系统，目录仅登记引用。',
    }
    liveResources.push(item)
    if (kind === 'service') {
      liveDataServices.push({
        id: `DS-${String(liveDataServices.length + 1).padStart(2, '0')}`,
        name: item.name,
        method: 'GET',
        path: service.url,
        scope: (item.scope || []).join(' / '),
        calls: 0,
        latency: '—',
        status: autoRegistered ? 'authorized' : 'pending-dept',
        published: false,
        publishStatus: 'pending-review',
        resourceId: item.id,
      })
    }
    logAudit(user, 'resource.register', id, 'allow', net)
    json(res, 200, { ok: true, item, visible: liveResources.filter((r) => canSee(user, r, net)).length })
  },
  'POST /api/resources/approval': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const r = liveResources.find((x) => x.id === body.id)
    if (!r || !r.workflow) return json(res, 404, { error: '资源不存在或没有登记流程' })
    if (!canSee(user, r, net)) return json(res, 403, { error: '无授权处理该登记' })
    const action = body.action
    const stage = r.workflow.stage
    if (stage === 'done') return json(res, 400, { error: '该资源已完成登记' })
    if (action === 'reject') {
      const step = r.workflow.steps.find((x) => x.key === stage)
      if (step) { step.state = 'rejected'; step.at = stamp(); step.by = user.name }
      r.status = 'rejected'
      r.workflow.stage = 'rejected'
      logAudit(user, 'resource.approval.reject', r.id, 'allow', net)
      return json(res, 200, { ok: true, item: r, message: '已退回登记' })
    }
    if (stage === 'dept' && action === 'dept-approve') {
      const step = r.workflow.steps.find((x) => x.key === 'dept')
      step.state = 'done'; step.at = stamp(); step.by = user.name
      const next = r.workflow.steps.some((x) => x.key === 'qc') ? 'qc' : 'data'
      r.workflow.stage = next
      const nextStep = r.workflow.steps.find((x) => x.key === next)
      if (nextStep) nextStep.state = 'active'
      r.status = regStatusOf(next, r.regKind)
      logAudit(user, 'resource.approval.dept', r.id, 'allow', net)
      return json(res, 200, { ok: true, item: r, message: next === 'qc' ? '部门负责人已同意，进入质检' : '部门负责人已同意，进入数据管理员审批' })
    }
    if (stage === 'qc' && (action === 'qc-pass' || action === 'qc-fail')) {
      const step = r.workflow.steps.find((x) => x.key === 'qc')
      step.at = stamp(); step.by = user.name
      if (action === 'qc-fail') {
        step.state = 'rejected'
        r.quality.status = 'failed'
        r.status = 'rejected'
        r.workflow.stage = 'rejected'
        logAudit(user, 'resource.approval.qc.fail', r.id, 'allow', net)
        return json(res, 200, { ok: true, item: r, message: '质检未通过，已退回' })
      }
      step.state = 'done'
      r.quality.status = 'passed'
      r.quality.reportNo = `QC-${new Date().getFullYear()}-${String(liveResources.length).padStart(4, '0')}`
      const next = r.workflow.steps.find((x) => x.key === 'data')
      r.workflow.stage = 'data'
      if (next) next.state = 'active'
      r.status = 'pending-data'
      logAudit(user, 'resource.approval.qc.pass', r.id, 'allow', net)
      return json(res, 200, { ok: true, item: r, message: '质检通过，进入数据管理员审批' })
    }
    if (stage === 'data' && action === 'data-approve') {
      const step = r.workflow.steps.find((x) => x.key === 'data')
      const done = r.workflow.steps.find((x) => x.key === 'done')
      if (step) { step.state = 'done'; step.at = stamp(); step.by = user.name }
      if (done) { done.state = 'done'; done.at = stamp(); done.by = user.name }
      if (!r.quality.required) r.quality.status = 'assessed'
      r.status = 'authorized'
      r.workflow.stage = 'done'
      r.updated = stamp()
      if (r.regKind === 'service') {
        const ds = liveDataServices.find((x) => x.resourceId === r.id)
        if (ds) { ds.status = 'authorized'; ds.published = true; ds.calls = 0; ds.latency = '—' }
      }
      logAudit(user, 'resource.approval.data', r.id, 'allow', net)
      return json(res, 200, { ok: true, item: r, message: '数据管理员审批通过，资源已登记入库' })
    }
    return json(res, 400, { error: '当前阶段不支持该操作' })
  },
  'POST /api/resources/edit': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const r = liveResources.find((x) => x.id === body.id)
    if (!r) return json(res, 404, { error: '资源不存在' })
    if (!canSee(user, r, net)) return json(res, 403, { error: '无权限编辑该资源' })
    if (!canEditResource(user, r)) return json(res, 403, { error: '仅数据负责人或所属部门负责人可编辑该资源' })
    if (liveEditRequests.get(r.id)?.status === 'pending') return json(res, 400, { error: '该资源已有编辑申请在审批中' })
    const changes = {
      name: String(body.changes?.name || r.name).trim(),
      businessCategory: String(body.changes?.businessCategory || businessCategoryOf(r)).trim(),
      desc: String(body.changes?.desc ?? r.desc ?? '').trim(),
    }
    const now = stamp()
    liveEditRequests.set(r.id, {
      id: `EDIT-${String(Date.now()).slice(-6)}`,
      resourceId: r.id,
      status: 'pending',
      stage: 'dept',
      changes,
      by: user.name,
      at: now,
      steps: [
        { key: 'submit', label: '上传人提交编辑', state: 'done', by: user.name, at: now },
        { key: 'dept', label: '部门负责人同意', state: 'active', by: '', at: '' },
        { key: 'ops', label: '运维管理同意', state: 'pending', by: '', at: '' },
      ],
    })
    logAudit(user, 'resource.edit.submit', r.id, 'allow', net)
    json(res, 200, { ok: true, request: liveEditRequests.get(r.id), message: '编辑申请已提交，需部门负责人与运维管理同意后生效' })
  },
  'POST /api/resources/edit-approval': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const r = liveResources.find((x) => x.id === body.id)
    const edit = liveEditRequests.get(body.id)
    if (!r || !edit) return json(res, 404, { error: '没有待处理的编辑申请' })
    if (edit.status !== 'pending') return json(res, 400, { error: '该编辑申请已处理' })
    const action = body.action
    if (action === 'reject') {
      edit.steps.forEach((s) => { if (s.state === 'active') s.state = 'rejected' })
      edit.status = 'rejected'
      edit.stage = 'rejected'
      logAudit(user, 'resource.edit.reject', r.id, 'allow', net)
      return json(res, 200, { ok: true, message: '编辑申请已退回，原资源保持不变' })
    }
    if (edit.stage === 'dept' && action === 'dept-approve') {
      const step = edit.steps.find((s) => s.key === 'dept')
      step.state = 'done'; step.at = stamp(); step.by = user.name
      edit.stage = 'ops'
      const next = edit.steps.find((s) => s.key === 'ops')
      if (next) next.state = 'active'
      logAudit(user, 'resource.edit.dept', r.id, 'allow', net)
      return json(res, 200, { ok: true, message: '部门负责人已同意，进入运维管理审批' })
    }
    if (edit.stage === 'ops' && action === 'ops-approve') {
      if (!canApproveEdit(user)) return json(res, 403, { error: '仅运维管理可完成编辑审批' })
      const step = edit.steps.find((s) => s.key === 'ops')
      step.state = 'done'; step.at = stamp(); step.by = user.name
      const c = edit.changes || {}
      if (c.name) r.name = c.name
      if (c.businessCategory) {
        r.dataStandard = { ...(r.dataStandard || {}), businessCategory: c.businessCategory, dataOwner: r.dataStandard?.dataOwner || r.contact || edit.by }
      }
      if (typeof c.desc === 'string') {
        r.desc = c.desc
        if (r.aiMeta) r.aiMeta.summary = c.desc
      }
      r.updated = stamp()
      edit.status = 'approved'
      edit.stage = 'done'
      logAudit(user, 'resource.edit.ops', r.id, 'allow', net)
      return json(res, 200, { ok: true, message: '部门负责人与运维管理均已同意，编辑内容已生效' })
    }
    return json(res, 400, { error: '当前阶段不支持该操作' })
  },
  'POST /api/resources/download': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const r = liveResources.find((x) => x.id === body.id)
    if (!r) return json(res, 404, { error: '资源不存在' })
    if (!canSee(user, r, net)) return json(res, 403, { error: '不在当前网络与授权范围内，不能下载' })
    const fileId = resourceFileId(r)
    if (!fileId) {
      return json(res, 409, {
        error: '该资源登记时未上传真实文件，无法签发下载；请重新登记并上传文件，或由管理员补充文件。',
        code: 'NO_FILE',
      })
    }
    const prev = liveDownloadRequests.get(r.id)
    if (prev?.status === 'approved') {
      const token = issueDownloadToken({ fileId, resourceId: r.id, userName: user.name })
      return json(res, 200, {
        ok: true, status: 'approved', request: prev,
        downloadUrl: `/api/resources/download/file?token=${encodeURIComponent(token)}`,
        expiresIn: 900,
        message: '已签发 15 分钟受控下载链接，点击即可下载原文件',
      })
    }
    if (prev?.status === 'pending') {
      return json(res, 200, { ok: true, status: 'pending', request: prev, message: '下载申请已在审批中，请等待授权管理员处理' })
    }
    const authorizationType = r.securityMeta?.authorizationType || (String(r.scope || '').includes('unit:') ? 'group' : 'orgs')
    const autoApprove = r.security !== 'secret' && authorizationType === 'group'
    const request = {
      id: `DL-${String(Date.now()).slice(-6)}`,
      resourceId: r.id,
      status: autoApprove ? 'approved' : 'pending',
      by: user.name,
      at: stamp(),
      approvedBy: autoApprove ? '集团内部公开资源自动授权' : '',
      approvedAt: autoApprove ? stamp() : '',
      approval: '数据管理员 / 授权管理员',
      note: autoApprove ? '集团内部公开且非涉密，按授权范围自动签发' : '按资源密级、网络环境与授权组织审批',
    }
    liveDownloadRequests.set(r.id, request)
    resourceDownloads.set(r.id, (resourceDownloads.get(r.id) || 0) + 1)
    logAudit(user, 'resource.download.request', r.id, autoApprove ? 'allow(auto)' : 'pending', net)
    if (autoApprove) {
      const token = issueDownloadToken({ fileId, resourceId: r.id, userName: user.name })
      return json(res, 200, {
        ok: true, status: 'approved', request,
        downloadUrl: `/api/resources/download/file?token=${encodeURIComponent(token)}`,
        expiresIn: 900,
        message: '集团内部公开资源已自动授权，15 分钟受控下载链接已签发',
      })
    }
    return json(res, 200, { ok: true, status: 'pending', request, message: '下载申请已提交，审批通过后签发 15 分钟受控链接' })
  },
  'POST /api/resources/download/approval': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    if (!canManage(user) && !dutiesOf(user).includes('dataAdmin')) return json(res, 403, { error: '仅数据管理员或授权管理员可审批下载申请' })
    const body = JSON.parse(req.__body || '{}')
    const r = liveResources.find((x) => x.id === body.id)
    const request = liveDownloadRequests.get(body.id)
    if (!r || !request) return json(res, 404, { error: '没有待处理的下载申请' })
    if (request.status !== 'pending') return json(res, 409, { error: '该下载申请已处理' })
    if (body.action === 'reject') {
      request.status = 'rejected'
      request.reviewedBy = user.name
      request.reviewedAt = stamp()
      logAudit(user, 'resource.download.reject', r.id, 'allow', net)
      return json(res, 200, { ok: true, status: 'rejected', request })
    }
    const fileId = resourceFileId(r)
    if (!fileId) return json(res, 409, { error: '该资源没有真实文件，无法批准下载', code: 'NO_FILE' })
    request.status = 'approved'
    request.reviewedBy = user.name
    request.reviewedAt = stamp()
    request.approvedAt = stamp()
    const token = issueDownloadToken({ fileId, resourceId: r.id, userName: request.by })
    logAudit(user, 'resource.download.approve', r.id, 'allow', net)
    return json(res, 200, {
      ok: true, status: 'approved', request,
      downloadUrl: `/api/resources/download/file?token=${encodeURIComponent(token)}`,
      expiresIn: 900,
      message: '下载申请已批准，15 分钟受控下载链接已签发',
    })
  },
  'GET /api/resources/download/file': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const ticket = verifyDownloadToken(url.searchParams.get('token'))
    if (!ticket) return json(res, 403, { error: '下载链接已失效或签名不正确，请重新申请' })
    if (ticket.userName !== user.name) return json(res, 403, { error: '该下载链接不属于当前用户' })
    const r = liveResources.find((x) => x.id === ticket.resourceId)
    if (!r || !canSee(user, r, net)) return json(res, 403, { error: '资源不在当前网络与授权范围内' })
    const meta = getFile(ticket.fileId)
    const buffer = readFileBuffer(ticket.fileId)
    if (!meta || !buffer) return json(res, 404, { error: '原文件不存在或已被清理' })
    logAudit(user, 'resource.download.file', `${r.id}:${ticket.fileId}`, 'allow', net)
    res.writeHead(200, {
      'content-type': meta.mime || 'application/octet-stream',
      'content-length': buffer.length,
      'content-disposition': contentDisposition(meta.name || `${r.name}.bin`),
      'cache-control': 'no-store',
    })
    res.end(buffer)
  },
  'POST /api/spatial/recognize': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const result = recognizeAdmin(body.extent)
    if (!result) return json(res, 400, { error: '无法从空间范围识别行政区划；请确认范围坐标包含在演示行政区划边界内' })
    json(res, 200, { ok: true, ...result })
  },
  'POST /api/resources/process': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const r = liveResources.find((x) => x.id === body.id)
    if (!r || !canSee(user, r, net)) return json(res, 403, { error: '无授权发起处理任务' })
    const task = {
      id: `T-${Date.now()}`, title: body.kind === 'preview' ? `生成预览：${r.name}` : `解析并建索引：${r.name}`,
      state: 'queued', progress: 0, target: `数据中心 · ${body.kind === 'preview' ? '预览生成' : '文档解析'}`,
      started: '—', createdAt: Date.now(),
    }
    liveTasks.unshift(task)
    logAudit(user, 'resource.process', r.id, 'allow', net)
    json(res, 200, { ok: true, task })
  },
  'GET /api/spatial': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const bbox = (url.searchParams.get('bbox') || '').split(',').map(Number)
    if (bbox.length !== 4 || bbox.some((n) => Number.isNaN(n))) return json(res, 400, { error: 'bbox 需要 minLng,minLat,maxLng,maxLat' })
    const hits = liveResources
      .filter((r) => canSee(user, r, net) && r.extent && bboxHit(bbox, r.extent))
      .map((r) => ({ ...pickResource(r), extent: r.extent }))
    const noCoord = liveResources.filter((r) => canSee(user, r, net) && r.type === 'cad' && !r.extent).map((r) => r.name)
    logAudit(user, 'resource.spatial', `bbox=${bbox.join(',')}`, `allow(${hits.length})`, net)
    json(res, 200, { items: hits, bounds: spatialBounds, note: noCoord.length ? `${noCoord.join('、')} 坐标信息不完整，不参与空间检索` : '全部命中资源均具备可靠地理参考' })
  },
  'GET /api/imagery': (req, res) => json(res, 200, imageryCompare),
  'GET /api/satellite': (req, res) => {
    const net = netOf(req)
    const user = roleOf(req)
    const local = liveResources.some((r) => ['R-2026-Q3-IMG', 'R-2026-Q2-IMG'].includes(r.id) && canSee(user, r, net))
    json(res, 200, {
      mode: net === 'inet' ? 'online' : 'geotiff',
      source: net === 'inet' ? '天地图 · 在线影像底图（引用）' : 'QGIS Server · GeoTIFF 动态读取（GDAL 金字塔）',
      quarters: satelliteQuarters,
      current: '2026Q3',
      history: ['2010', '2011', '2013', '2015', '2017', '2019', '2021', '2023', '2024', '2025'],
      note: net === 'inet'
        ? '互联网环境影像底图引用天地图库，不复制存储；近四季度切换与卷帘对比仅为浏览，定量分析需内部影像'
        : local ? '最近四个已完成季度 + 2010 年起年度归档' : '涉密影像当前角色不可见，需按涉密数据规定审批',
    })
  },
  'GET /api/plugins': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const list = installedPluginsForUser(user.id)
      .filter((p) => (p.nets || ['inet']).includes(net))
      .map((p) => ({ ...p, status: pluginEnabledFor(user.id, p) }))
    json(res, 200, { items: list, canManage: canManage(user) })
  },
  'GET /api/agent-entries': (req, res) => {
    const net = netOf(req)
    const user = roleOf(req)
    const inventory = runtimePluginInventory(ensureUserDshHome(user.id))
    const on = (id) => Boolean(inventory.find((x) => x.id === id)?.enabled)
    json(res, 200, {
      items: [
        { id: 'agent-team', label: 'Agent 团队', plugin: 'tool-agent-team', enabled: on('tool-agent-team'), desc: '把复杂任务拆给多个子 Agent，并行执行后汇总结果' },
        { id: 'worktree', label: '工作树', plugin: 'tool-worktree', enabled: on('tool-worktree'), desc: '在隔离工作树中修改代码，避免污染当前项目目录' },
        {
          id: 'auto-review', label: '自动审查（权限层）', plugin: 'auto-review', enabled: false,
          runtimeEnabled: on('auto-review'),
          desc: '实验性逐工具调用审查层，不是代码审查报告；本产品未接入该权限预设',
        },
      ],
      net,
    })
  },
  'GET /api/platform-capabilities': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    json(res, 200, {
      items: platformCapabilities(accountRuntimeHome(user)).filter((p) => p.layer !== 'kernel' && (p.nets || ['inet']).includes(net)),
      canManage: canManage(user),
      layer: 'platform',
      installScope: '系统级模块 · 默认安装启用，不进入插件市场',
    })
  },
  'GET /api/admin/official-baseline': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅超级管理员可管理系统内核' })
    const bundles = officialBaselineBundles().map((b) => ({ ...b, type: 'plugin', usedBy: 0 }))
    const infrastructure = platformCapabilities(accountRuntimeHome(user)).filter((p) => p.layer === 'kernel')
    json(res, 200, { ok: true, skills: [], bundles, infrastructure, canManage: true })
  },
  'POST /api/admin/official-baseline': async (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅超级管理员可查看系统内核' })
    return json(res, 403, { error: '系统内核是运行时基线，不允许停用或卸载' })
    const body = JSON.parse(req.__body || '{}')
    const dir = String(body.dir || '').trim()
    if (!OFFICIAL_SKILL_DIRS.includes(dir)) return json(res, 404, { error: '不是官方内置技能' })
    const action = String(body.action || '')
    if (!['enable', 'disable', 'install', 'uninstall'].includes(action)) return json(res, 400, { error: 'action 只能是 enable、disable、install 或 uninstall' })
    const globalDir = join(dataDirPath(), 'dsh-home', 'skills', dir)
    if (action === 'uninstall') {
      rmSync(globalDir, { recursive: true, force: true })
      liveOfficialUninstalledSkills.add(dir)
      liveOfficialDisabledSkills.delete(dir)
    } else if (action === 'install') {
      mkdirSync(dirname(globalDir), { recursive: true })
      rmSync(globalDir, { recursive: true, force: true })
      cpSync(join(DSH_DEFAULT_SKILL_SOURCE, dir), globalDir, { recursive: true })
      liveOfficialUninstalledSkills.delete(dir)
      liveOfficialDisabledSkills.delete(dir)
    } else {
      if (liveOfficialUninstalledSkills.has(dir)) return json(res, 409, { error: '该官方技能已卸载，请先重新安装' })
      if (action === 'disable') liveOfficialDisabledSkills.add(dir)
      else liveOfficialDisabledSkills.delete(dir)
    }
    let accounts = []
    try { accounts = readdirSync(USER_AGENT_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name) } catch {}
    for (const userId of accounts) {
      const home = userDshHome(userId)
      await closeHarnessForHome(home)
      ensureUserDshHome(userId)
    }
    persistPersistentState()
    logAudit(user, 'official-baseline.skill', dir, body.action, netOf(req))
    const item = officialSkillCatalog().find((s) => s.dir === dir)
    json(res, 200, { ok: true, item })
  },
  'POST /api/admin/platform-capabilities': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅系统管理员可配置平台公共能力' })
    const body = JSON.parse(req.__body || '{}')
    const cap = PLATFORM_CAPABILITIES.find((x) => x.id === body.id)
    if (!cap) return json(res, 404, { error: '平台能力不存在' })
    if (body.action === 'enable' || body.action === 'disable') {
      const prev = capabilityPolicyOf(cap)
      const enabled = body.action === 'enable'
      liveCapabilityPolicies.set(cap.id, {
        permissions: prev.permissions,
        limits: prev.limits,
        disabled: !enabled,
        disabledAt: enabled ? 0 : Date.now(),
        disabledBy: enabled ? '' : user.name,
        updatedAt: Date.now(),
        updatedBy: user.name,
      })
      persistPersistentState()
      logAudit(user, 'platform-capability.toggle', cap.id, enabled ? 'enable' : 'disable', netOf(req))
      return json(res, 200, { ok: true, item: platformCapabilities(accountRuntimeHome(user)).find((x) => x.id === cap.id) })
    }
    if (body.reset === true) {
      liveCapabilityPolicies.delete(cap.id)
      persistPersistentState()
      logAudit(user, 'platform-capability.reset', cap.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, item: platformCapabilities(accountRuntimeHome(user)).find((x) => x.id === cap.id) })
    }
    const rawPermissions = Array.isArray(body.permissions)
      ? body.permissions
      : typeof body.permissions === 'string' ? body.permissions.split(/[,，\n]/) : []
    const permissions = [...new Set(rawPermissions.map((x) => String(x).trim()).filter(Boolean))].slice(0, 12)
    if (!permissions.length) return json(res, 400, { error: '至少保留一项权限' })
    const limits = {}
    for (const key of ['cpu', 'memory', 'timeout', 'concurrency']) {
      const n = Number(body.limits?.[key])
      if (Number.isFinite(n) && n > 0) limits[key] = Math.min(key === 'timeout' ? 3600 : key === 'memory' ? 16384 : 64, Math.round(n))
    }
    liveCapabilityPolicies.set(cap.id, { permissions, limits: { ...cap.limits, ...limits }, updatedAt: Date.now(), updatedBy: user.name })
    persistPersistentState()
    logAudit(user, 'platform-capability.policy', cap.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item: platformCapabilities(accountRuntimeHome(user)).find((x) => x.id === cap.id) })
  },
  'GET /api/plugin-review': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '当前角色无插件审批权' })
    json(res, 200, { items: installedSkillPlugins() })
  },
  'POST /api/guest/grant': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '只有管理角色可以调整外部访客的模块授权' })
    const body = JSON.parse(req.__body || '{}')
    const module = String(body.module || '')
    if (!module || !roles.guest.visibleModules.includes(module)) return json(res, 400, { error: '模块不在外部访客的可见框架内' })
    roles.guest.grants = roles.guest.grants || []
    const has = roles.guest.grants.includes(module)
    if (body.allow === false) {
      if (has) roles.guest.grants = roles.guest.grants.filter((m) => m !== module)
    } else if (!has) {
      roles.guest.grants.push(module)
    }
    logAudit(user, body.allow === false ? 'guest.grant.revoke' : 'guest.grant.allow', module, 'done')
    json(res, 200, { ok: true, grants: roles.guest.grants })
  },
  'POST /api/plugins/review': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    if (!canManage(user)) return json(res, 403, { error: '当前角色无插件审批权' })
    const p = installedSkillPlugins().find((x) => x.id === body.id)
    if (!p) return json(res, 404, { error: '插件不存在' })
    return json(res, 409, { error: '该条目已由本机 DSH 运行时加载，没有待审队列', code: 'PLUGIN_ALREADY_MOUNTED' })
  },
  'POST /api/plugins/toggle': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const p = installedSkillPlugins().find((x) => x.id === body.id)
    if (!p) return json(res, 404, { error: '插件不存在' })
    return json(res, 409, { error: '该条目由 DSH 运行时加载，产品内不能逐项停用；请在「DSH 插件运行时」管理', code: 'PLUGIN_MANAGED_BY_RUNTIME' })
  },
  'GET /api/plugin-market': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const items = [...liveMarket]
      .filter((m) => m.listed !== false)
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((m) => marketItemState(m, { userId: user.id }))
      .concat(PRODUCT_MARKET_PLUGINS.map((m) => ({ ...m, origin: 'builtin', installed: true, locked: true, available: true, type: 'plugin' })))
    json(res, 200, { items, network: networks[net]?.label || '', installScope: '当前账号或项目技能目录；Bundle 按账号独立 DSH_HOME' })
  },
  'GET /api/plugin-market/download': (req, res, url) => {
    const id = String(url.searchParams.get('id') || '')
    const item = liveMarket.find((x) => x.id === id)
    const sub = item && item.subId ? pluginSubs.find((s) => s.id === item.subId) : null
    if (!sub || sub.status !== 'approved' || !sub.fileId) {
      return json(res, 404, { error: '该插件没有可下载的原始包' })
    }
    const meta = getFile(sub.fileId)
    let buffer = null
    try { buffer = readFileBuffer(sub.fileId) } catch {}
    if (!meta || !buffer) return json(res, 404, { error: '插件包文件已失效，请让提交人重新上传' })
    res.writeHead(200, {
      'content-type': meta.mime || 'application/zip',
      'content-length': buffer.length,
      'content-disposition': contentDisposition(meta.name),
      'cache-control': 'no-store',
    })
    res.end(buffer)
  },
  'POST /api/plugin-market/install': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveMarket.find((x) => x.id === body.id)
    if (!item) return json(res, 404, { error: '插件不存在' })
    if (item.kind === 'plugin') return json(res, 409, { error: '该插件随客户端内置，不支持单独安装或卸载', code: 'PLUGIN_LOCKED' })
    const isBundle = item.kind === 'bundle'
    if (isBundle ? !marketBundleAvailable(item.id) : !marketSkillAvailable(item.id)) {
      return json(res, 409, {
        error: isBundle ? '该插件尚未提供可安装的 Bundle 包，暂不能安装' : '该插件尚未提供可安装的技能包，暂不能安装',
        code: 'MARKET_PACKAGE_NOT_READY',
      })
    }
    if (item.scope === '需授权' && !canManage(user)) return json(res, 403, { error: '该插件需部门负责人授权后安装' })
    if (activeRuns.size) return json(res, 409, { error: '有会话正在执行，安装或卸载会在下一轮生效，请稍后再试', code: 'RUNTIME_BUSY' })
    const scope = isBundle ? 'account' : (body.scope === 'project' ? 'project' : 'user')
    const projectId = scope === 'project' ? String(body.projectId || '') : ''
    if (scope === 'project' && !projectCwdOf(projectId)) return json(res, 400, { error: '请选择有本地工作目录的项目后再安装' })
    const home = isBundle ? ensureUserDshHome(user.id) : ''
    const ctx = { scope, userId: user.id, projectId, projectCwd: projectCwdOf(projectId), dshHome: home }
    const has = isBundle ? marketBundleInstalled(item.id, home) : Boolean(marketSkillManifestAt(marketSkillTarget(item.id, ctx))?.marketId === item.id)
    try {
      if (isBundle) {
        if (!pnpmAvailable()) return json(res, 501, { error: '客户端未内置 pnpm，无法安装 DSH Bundle', code: 'PNPM_MISSING' })
        if (has) await uninstallMarketBundle(item, home)
        else await installMarketBundle(item, home)
      } else if (has) {
        await uninstallMarketSkill(item, user, ctx)
      } else {
        await installMarketSkill(item, user, ctx)
      }
    } catch (error) {
      return json(res, 409, { error: error.message || (has ? '卸载失败' : '安装失败') })
    }
    if (isBundle) {
      if (has) removeMarketInstallRecord(item.id, { userId: user.id, scope: 'account', projectId: '' })
      else addMarketInstallRecord(item.id, { userId: user.id, userName: user.name, scope: 'account', projectId: '', installedAt: Date.now() })
    } else {
      if (has) removeMarketInstallRecord(item.id, { userId: user.id, scope, projectId })
      else addMarketInstallRecord(item.id, { userId: user.id, userName: user.name, scope, projectId, installedAt: Date.now() })
    }
    logAudit(user, has ? 'plugin.remove' : 'plugin.install', item.id, `${scope}(${user.id})${projectId ? `:${projectId}` : ''}`, netOf(req))
    json(res, 200, {
      ok: true,
      item: { ...marketItemState(item, { userId: user.id }), installed: !has },
      message: has
        ? (scope === 'project' ? '已从该项目卸下，对项目外会话不可见' : '已从当前账号卸下，其他账号不受影响')
        : (scope === 'project' ? '已安装到当前项目，仅该项目会话可见' : '已安装到当前账号，其他账号不可见'),
    })
  },
  'GET /api/admin/plugin-market': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可管理插件市场' })
    const items = [...liveMarket]
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map((m) => marketItemState(m, { any: true }))
    json(res, 200, {
      ok: true,
      items,
      counts: {
        total: items.length,
        listed: items.filter((m) => m.listed !== false).length,
        installed: items.filter((m) => m.installed).length,
      },
    })
  },
  'POST /api/admin/plugin-market': async (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可管理插件市场' })
    const body = JSON.parse(req.__body || '{}')
    const item = liveMarket.find((x) => x.id === body.id)
    if (!item) return json(res, 404, { error: '市场条目不存在' })
    const action = String(body.action || '')
    if (action === 'list' || action === 'unlist') {
      item.listed = action === 'list'
      persistPersistentState()
      logAudit(user, `plugin-market.${action}`, item.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, item: marketItemState(item, { any: true }) })
    }
    if (action === 'update') {
      if (typeof body.name === 'string' && body.name.trim()) item.name = body.name.trim().slice(0, 40)
      if (typeof body.desc === 'string') item.desc = body.desc.trim().slice(0, 200)
      if (typeof body.section === 'string' && ['官方与内置', '热门', '新品推荐', '企业内部'].includes(body.section)) item.section = body.section
      if (typeof body.publisher === 'string' && body.publisher.trim()) item.publisher = body.publisher.trim().slice(0, 40)
      persistPersistentState()
      logAudit(user, 'plugin-market.update', item.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, item: marketItemState(item, { any: true }) })
    }
    if (action === 'sort') {
      const direction = body.direction === 'up' ? -1 : 1
      const ordered = [...liveMarket].sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      const index = ordered.findIndex((x) => x.id === item.id)
      const next = index + direction
      if (index < 0 || next < 0 || next >= ordered.length) return json(res, 400, { error: '已经到边界，无法继续移动' })
      ordered[index] = ordered[next]
      ordered[next] = item
      ordered.forEach((x, i) => { x.order = i })
      persistPersistentState()
      logAudit(user, 'plugin-market.sort', item.id, `move-${body.direction === 'up' ? 'up' : 'down'}`, netOf(req))
      return json(res, 200, { ok: true, items: ordered.map((m) => marketItemState(m, { any: true })) })
    }
    if (action === 'upgrade') {
      if (!item.subId) return json(res, 400, { error: '内置市场条目不接受升级包；请通过代码发布' })
      if (!['bundle', 'skill'].includes(item.kind)) return json(res, 400, { error: '该条目不是可升级的 Bundle 或技能包' })
      if (activeRuns.size) return json(res, 409, { error: '有会话正在执行，升级会在下一轮生效，请稍后再试', code: 'RUNTIME_BUSY' })
      const fileId = String(body.fileId || '').trim()
      const meta = fileId ? getFile(fileId) : null
      if (!meta) return json(res, 400, { error: '请先上传新版本 ZIP 包', code: 'PLUGIN_FILE_REQUIRED' })
      let buffer
      try { buffer = readFileBuffer(fileId) } catch { return json(res, 400, { error: '升级包读取失败' }) }
      const scan = inspectPluginZip(buffer)
      if ((scan.kind || 'bundle') !== item.kind) return json(res, 400, { error: `包类型不匹配：当前是 ${item.kind}，上传包是 ${scan.kind || 'bundle'}` })
      if ((scan.checks || []).some((c) => c[1] !== '通过')) {
        return json(res, 400, { error: '升级包未通过平台检测：' + scan.checks.filter((c) => c[1] !== '通过').map((c) => c[0]).join('；') })
      }
      const backup = backupMarketPackage(item, `升级前 ${item.version || ''}`.trim())
      const target = marketPackageDir(item)
      try {
        rmSync(target, { recursive: true, force: true })
        mkdirSync(target, { recursive: true })
        if (item.kind === 'skill') extractSkillPackage(buffer, target)
        else {
          extractBundlePackage(buffer, target)
          const pkg = bundlePackageManifest(item.id)
          if (!pkg || !pkg.name || !pkg.dsh || !pkg.dsh.bundle) throw new Error('Bundle 的 package.json 缺少 name 或 dsh.bundle')
          item.packageName = pkg.name
        }
        const sub = pluginSubs.find((s) => s.id === item.subId)
        const nextVersion = String(body.version || bundlePackageManifest(item.id)?.version || sub?.version || '').trim()
        if (nextVersion) { item.version = nextVersion; if (sub) sub.version = nextVersion }
        item.upgradedAt = new Date().toISOString()
        item.upgradeFile = meta.name
        if (sub) { sub.fileId = fileId; sub.file = meta.name; sub.sha256 = meta.sha256; sub.size = meta.size >= 1024 ** 2 ? `${(meta.size / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(meta.size / 1024))} KB` }
        if (item.kind === 'bundle') {
          const users = bundleInstallUsers(item.id)
          for (const entry of users) await closeHarnessForHome(userDshHome(entry.userId)).catch(() => {})
        }
      } catch (error) {
        if (backup) {
          try { restoreMarketPackage(item) } catch {}
        }
        return json(res, 409, { error: `升级失败，已尝试回滚：${error.message}` })
      }
      persistPersistentState()
      logAudit(user, 'plugin-market.upgrade', item.id, `version=${item.version || '—'},backup=${backup?.id || 'none'}`, netOf(req))
      return json(res, 200, { ok: true, item: marketItemState(item, { any: true }), backup: backup?.id || '', note: '已替换包目录；已安装账号的运行时已关闭，下一轮重新加载。' })
    }
    if (action === 'rollback') {
      if (!item.subId) return json(res, 400, { error: '内置市场条目不支持回滚' })
      if (activeRuns.size) return json(res, 409, { error: '有会话正在执行，回滚会在下一轮生效，请稍后再试', code: 'RUNTIME_BUSY' })
      try {
        const result = restoreMarketPackage(item)
        if (item.kind === 'bundle') {
          for (const entry of bundleInstallUsers(item.id)) await closeHarnessForHome(userDshHome(entry.userId)).catch(() => {})
        }
        persistPersistentState()
        logAudit(user, 'plugin-market.rollback', item.id, `restored=${result.restoredVersion || '—'}`, netOf(req))
        return json(res, 200, { ok: true, item: marketItemState(item, { any: true }), restoredVersion: result.restoredVersion, remaining: result.remaining })
      } catch (error) {
        return json(res, 409, { error: error.message || '回滚失败' })
      }
    }
    if (action === 'delete') {
      if (!item.subId) return json(res, 400, { error: '内置市场条目不能删除，只能下架' })
      const index = liveMarket.findIndex((x) => x.id === item.id)
      if (index >= 0) liveMarket.splice(index, 1)
      rmSync(item.kind === 'bundle' ? bundlePackageDir(item.id) : join(MARKET_PACKAGE_ROOT, item.id), { recursive: true, force: true })
      const sub = pluginSubs.findIndex((s) => s.id === item.subId)
      if (sub >= 0) pluginSubs.splice(sub, 1)
      liveMarketInstalls.delete(item.id)
      persistPersistentState()
      logAudit(user, 'plugin-market.delete', item.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, deleted: item.id })
    }
    return json(res, 400, { error: '未知的市场管理操作' })
  },
  'GET /api/plugin-subs': (req, res, url) => {
    const user = roleOf(req)
    const mine = url.searchParams.get('mine') === '1'
    const items = canManage(user) && !mine ? pluginSubs : pluginSubs.filter((s) => s.author === user.name)
    json(res, 200, { items })
  },
  'POST /api/plugin-subs': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const name = String(body.name || '').trim()
    if (!name) return json(res, 400, { error: '请填写插件名称' })
    const fileId = String(body.fileId || '').trim()
    if (!fileId) return json(res, 400, { error: '请先上传 ZIP 插件包，平台需要真实文件才能检测', code: 'PLUGIN_FILE_REQUIRED' })
    const meta = getFile(fileId)
    if (!meta) return json(res, 400, { error: '插件包不存在或已失效，请重新上传', code: 'PLUGIN_FILE_MISSING' })
    if (meta.owner !== user.name && !canManage(user)) return json(res, 403, { error: '只能提交本人上传的插件包' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 400, { error: '插件包读取失败，请重新上传' }) }
    const scan = inspectPluginZip(buffer)
    const hasFail = (scan.checks || []).some((c) => c[1] === '不通过')
    const id = `SUB-${Date.now().toString(36).toUpperCase()}`
    const sizeText = meta.size >= 1024 ** 2 ? `${(meta.size / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(meta.size / 1024))} KB`
    const sub = {
      id, name, version: body.version || '0.1.0', file: meta.name, size: sizeText,
      fileId, sha256: meta.sha256, kind: scan.kind || 'bundle',
      author: user.name, unit: user.unit, scope: body.scope || '全集团',
      status: hasFail ? 'rejected' : 'pending', submitted: stamp(),
      desc: body.desc || '企业自研插件，按插件开发规范打包，经平台检测与审核后上架',
      checks: scan.checks,
      reason: hasFail ? '自动检测未通过：' + scan.checks.filter((c) => c[1] === '不通过').map((c) => `${c[0]}（${c[2]}）`).join('；') : '',
    }
    pluginSubs.unshift(sub)
    logAudit(user, 'plugin.submit', `${id}:${meta.sha256.slice(0, 12)}`, hasFail ? 'deny(auto-check)' : 'allow', netOf(req))
    json(res, 200, { ok: true, item: sub })
  },
  'POST /api/plugin-subs/review': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可审核插件' })
    const body = JSON.parse(req.__body || '{}')
    const sub = pluginSubs.find((x) => x.id === body.id)
    if (!sub) return json(res, 404, { error: '提交记录不存在' })
    const action = body.action === 'approve' ? 'approve' : 'reject'
    sub.status = action === 'approve' ? 'approved' : 'rejected'
    sub.reviewed = '刚刚'
    if (action === 'reject') sub.reason = String(body.reason || '').trim() || '安全检测或权限说明不满足上架要求'
    let packageReady = false
    if (action === 'approve') {
      const kind = sub.kind || 'bundle'
      const marketId = sub.marketId || (kind === 'skill' ? `PLG-${sub.id.replace(/^SUB-/, '')}` : `M-${Date.now()}`)
      if (kind === 'skill' || kind === 'bundle') {
        const meta = getFile(sub.fileId)
        if (!meta) return json(res, 409, { error: '插件包文件已失效，请让提交人重新上传' })
        try {
          const buffer = readFileBuffer(sub.fileId)
          const target = kind === 'skill' ? join(MARKET_PACKAGE_ROOT, marketId) : bundlePackageDir(marketId)
          const existing = liveMarket.find((m) => m.id === marketId)
          if (existing) backupMarketPackage(existing, `审核替换 ${sub.version || ''}`.trim())
          rmSync(target, { recursive: true, force: true })
          mkdirSync(target, { recursive: true })
          if (kind === 'skill') {
            extractSkillPackage(buffer, target)
          } else {
            extractBundlePackage(buffer, target)
            const pkg = bundlePackageManifest(marketId)
            if (!pkg || !pkg.name || !pkg.dsh || !pkg.dsh.bundle) throw new Error('Bundle 的 package.json 缺少 name 或 dsh.bundle')
            sub.packageName = pkg.name
          }
          sub.marketId = marketId
          packageReady = true
        } catch (error) {
          return json(res, 409, { error: `${kind === 'skill' ? '技能包' : 'Bundle'}入库失败：${error.message}` })
        }
      }
      if (!liveMarket.some((m) => m.subId === sub.id)) {
        liveMarket.unshift({
          id: marketId, subId: sub.id, section: '企业内部', name: sub.name, desc: sub.desc,
          publisher: sub.unit, installed: false, scope: sub.scope, version: sub.version,
          kind, packageId: packageReady ? marketId : '',
        })
      }
    }
    logAudit(user, 'plugin.review.' + action, sub.id, 'allow', netOf(req))
    json(res, 200, {
      ok: true,
      item: sub,
      packageReady,
      note: action === 'approve' && !packageReady ? '已上架，但该包没有可安装的包文件，当前运行时不能直接安装' : '',
    })
  },
  'GET /api/projects': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const list = liveProjects
      .filter((p) => !p.removed)
      .filter((p) => (p.nets || ['inet']).includes(net) && (canManage(user) || p.scope === 'all-org' || p.scope.endsWith(user.unit) || p.owner === user.name))
      .map(decorateProject)
    json(res, 200, { items: list })
  },
  'POST /api/projects/create': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const name = String(body.name || '').trim()
    if (!name) return json(res, 400, { error: '项目名称不能为空' })
    const dir = projectDirInfo(body.cwd)
    if (dir.error) return json(res, 400, { error: dir.error, code: 'PROJECT_DIR_INVALID' })
    const duplicate = findProjectByDir(user, dir.cwd)
    if (duplicate) {
      return json(res, 200, {
        ok: true, item: decorateProject(duplicate), existing: true,
        note: '该文件夹已绑定到当前设备上的现有项目，已直接打开。',
      })
    }
    const item = {
      id: `PRJ-${randomBytes(3).toString('hex').toUpperCase()}`,
      name, desc: String(body.desc || '本地项目，Agent 可在授权文件夹内读写文件与执行命令。'),
      owner: user.name, dept: user.unit, members: 1, updated: stamp(),
      convs: 0, files: 0, scope: 'user', nets: [netOf(req)], pinned: false, personal: true,
      cwd: dir.cwd, folderName: dir.folderName, deviceId: deviceId(), status: 'online',
      instructions: String(body.instructions || '').slice(0, 4000),
      removed: false, createdAt: new Date().toISOString(),
    }
    liveProjects.unshift(item)
    logAudit(user, 'project.create', item.id, `cwd=${item.cwd}`, netOf(req))
    json(res, 200, { ok: true, item: decorateProject(item) })
  },
  'POST /api/projects/update': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveProjects.find((p) => p.id === body.id && !p.removed)
    if (!item) return json(res, 404, { error: '项目不存在' })
    if (item.owner !== user.name && !canManage(user)) return json(res, 403, { error: '无权修改该项目' })
    if (body.name !== undefined) {
      const name = String(body.name || '').trim()
      if (!name) return json(res, 400, { error: '项目名称不能为空' })
      item.name = name
    }
    if (body.desc !== undefined) item.desc = String(body.desc || '')
    if (body.instructions !== undefined) item.instructions = String(body.instructions || '').slice(0, 4000)
    if (body.pinned !== undefined) item.pinned = Boolean(body.pinned)
    if (body.cwd !== undefined) {
      const rawCwd = String(body.cwd || '').trim()
      if (!rawCwd) {
        item.cwd = ''
        item.folderName = ''
        item.deviceId = ''
      } else {
        const dir = projectDirInfo(rawCwd)
        if (dir.error) return json(res, 400, { error: dir.error, code: 'PROJECT_DIR_INVALID' })
        const duplicate = findProjectByDir(user, dir.cwd, item.id)
        if (duplicate) return json(res, 409, { error: `该文件夹已绑定到项目「${duplicate.name}」`, code: 'PROJECT_DIR_DUPLICATE' })
        item.cwd = dir.cwd
        item.folderName = dir.folderName
        item.deviceId = deviceId()
      }
    }
    item.updated = stamp()
    logAudit(user, 'project.update', item.id, `cwd=${item.cwd || '—'}`, netOf(req))
    json(res, 200, { ok: true, item: decorateProject(item) })
  },
  'POST /api/projects/remove': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveProjects.find((p) => p.id === body.id && !p.removed)
    if (!item) return json(res, 404, { error: '项目不存在' })
    if (item.owner !== user.name && !canManage(user)) return json(res, 403, { error: '无权移除该项目' })
    // 只移除平台记录：不删除本地文件夹、不删除会话历史。
    item.removed = true
    item.updated = stamp()
    for (const conv of conversations) {
      if (conv.projectId === item.id) {
        conv.projectId = null
        conv.mode = 'chat'
      }
    }
    logAudit(user, 'project.remove', item.id, 'record-only', netOf(req))
    json(res, 200, { ok: true, id: item.id, note: '已移除项目记录；本地文件夹与会话历史均未删除。' })
  },
  'POST /api/projects/verify': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveProjects.find((p) => p.id === body.projectId && !p.removed)
    if (!item) return json(res, 404, { error: '项目不存在' })
    if (item.owner !== user.name && !canManage(user)) return json(res, 403, { error: '无权检查该项目' })
    if (!item.cwd) return json(res, 409, { error: '项目未绑定本地文件夹，无法检查成果', code: 'PROJECT_DIR_UNBOUND' })
    if (projectStatus(item) !== 'online') {
      return json(res, 409, { error: '项目文件夹当前不可用（可能在其他设备或已被移动）', code: 'PROJECT_DIR_UNAVAILABLE' })
    }
    try {
      const result = checkProjectDeliverables({ cwd: item.cwd, projectName: item.name })
      logAudit(user, 'project.verify', item.id, `files=${result.summary.files};conflicts=${result.summary.conflicts}`, netOf(req))
      return json(res, 200, result)
    } catch (error) {
      return json(res, error?.status || 500, {
        error: error?.message || '成果检查失败',
        code: error?.code || 'PROJECT_VERIFY_FAILED',
      })
    }
  },
  'GET /api/apps': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const list = liveApps.filter((a) => ((a.nets || []).includes(net)) && (a.status === 'published' || canManage(user)))
    json(res, 200, { items: list, canManage: canManage(user) })
  },
  'GET /api/app': (req, res, url) => {
    const id = url.searchParams.get('id')
    const app = liveApps.find((a) => a.id === id)
    if (!app) return json(res, 404, { error: '应用不存在' })
    json(res, 200, { item: app })
  },
  'POST /api/apps/register': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    if (!canManage(user)) return json(res, 403, { error: '当前角色无应用提交权限' })
    const body = JSON.parse(req.__body || '{}')
    const id = `A-${Date.now().toString().slice(-6)}`
    const item = {
      id, name: body.name, desc: body.desc || '部门自建应用', dept: body.dept || user.unit,
      version: body.version || '0.1.0', nets: [net], status: 'review', icon: 'grid',
      maintainer: `${user.name}（${user.duty}）`, usage: body.usage || '由部门维护，按组织与角色授权使用',
      history: [{ version: body.version || '0.1.0', date: new Date().toISOString().slice(0, 10), note: '提交接入验证' }],
    }
    liveApps.unshift(item)
    logAudit(user, 'app.register', id, 'allow', net)
    json(res, 200, { ok: true, item, checks: ['URL 可达性', '身份回调', '权限声明', '健康检查'] })
  },
  'POST /api/apps/action': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅授权角色可执行审核与发布' })
    const body = JSON.parse(req.__body || '{}')
    const app = liveApps.find((a) => a.id === body.id)
    if (!app) return json(res, 404, { error: '应用不存在' })
    if (body.action === 'approve') app.status = 'published'
    if (body.action === 'reject') app.status = 'draft'
    if (body.action === 'offline') app.status = 'draft'
    if (body.action === 'rollback') {
      const prev = (app.history || [])[1]
      if (prev) { app.version = prev.version; app.history = [{ version: prev.version, date: new Date().toISOString().slice(0, 10), note: `回滚至 ${prev.version}` }, ...(app.history || [])] }
    }
    logAudit(user, `app.${body.action}`, app.id, 'allow', net)
    json(res, 200, { ok: true, item: app })
  },
  'GET /api/tasks': (req, res) => {
    taskTick()
    const user = roleOf(req)
    const items = liveTasks.filter((t) => !t.userId || String(t.userId) === String(user.id || ''))
    json(res, 200, { items })
  },
  'POST /api/tasks': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const task = {
      id: `T-${Date.now()}`, title: body.title || '未命名任务', state: 'queued', progress: 0,
      target: body.target || 'AI 工作台', started: '—', createdAt: Date.now(),
    }
    liveTasks.unshift(task)
    logAudit(user, 'task.create', task.id, 'allow', netOf(req))
    json(res, 200, { ok: true, task })
  },
  'POST /api/tasks/retry': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const t = liveTasks.find((x) => x.id === body.id)
    if (!t) return json(res, 404, { error: '任务不存在' })
    t.state = 'queued'
    t.progress = 0
    t.createdAt = Date.now()
    t.reason = ''
    json(res, 200, { ok: true, item: t })
  },
  'POST /api/tasks/delete': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可清理执行记录' })
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.id || '')
    const index = liveTasks.findIndex((x) => x.id === id)
    if (index < 0) return json(res, 404, { error: '任务不存在' })
    liveTasks.splice(index, 1)
    persistPersistentState()
    logAudit(user, 'task.delete', id, 'allow', netOf(req))
    json(res, 200, { ok: true, id })
  },
  'GET /api/conversations': (req, res, url) => {
    const user = roleOf(req)
    // 会话全文检索只在搜索面板请求时带上正文，避免侧栏每次刷新传输大段消息。
    const withText = url.searchParams.get('withText') === '1'
    json(res, 200, {
      items: conversations
        .filter((c) => conversationAllowed(user, c))
        .map((c) => ({
          id: c.id, title: c.title, kind: c.kind, time: c.time, model: c.model, turns: c.turns, status: c.status,
          workspace: c.workspace, projectId: c.projectId || '', executionPolicy: c.executionPolicy || 'auto', dshSessionId: c.dshSessionId || '',
          ...(withText ? { searchText: (c.messages || []).map((m) => String(m.text || '')).join('\n').slice(0, 20000) } : {}),
        })),
    })
  },
  'GET /api/conversation': (req, res, url) => {
    const user = roleOf(req)
    const id = url.searchParams.get('id')
    const c = conversations.find((x) => x.id === id)
    if (!c) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, c)) return json(res, 403, { error: '无权访问该会话', code: 'CONVERSATION_FORBIDDEN' })
    if (recoverConversationFromTrace(user, c)) persistPersistentState()
    json(res, 200, { item: hydrateConversationVisuals(c) })
  },
  'GET /api/visuals': (req, res, url) => {
    const user = roleOf(req)
    const id = String(url.searchParams.get('id') || '').trim()
    if (id) {
      const visual = getVisualArtifact(id)
      if (!visual) return json(res, 404, { error: '可视化对象不存在', code: 'VISUAL_NOT_FOUND' })
      if (String(visual.owner || '') !== user.id) return json(res, 403, { error: '无权访问该可视化对象', code: 'VISUAL_FORBIDDEN' })
      return json(res, 200, { ok: true, visual: visualPublic(visual), versions: listVisualVersions(id) })
    }
    const sessionId = String(url.searchParams.get('sessionId') || '').trim()
    if (sessionId) {
      const conv = conversations.find((x) => x.id === sessionId)
      if (!conv) return json(res, 404, { error: '会话不存在' })
      if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权访问该会话', code: 'CONVERSATION_FORBIDDEN' })
      const items = listVisualArtifacts({ sessionId, owner: user.id, limit: 200 })
      return json(res, 200, { ok: true, items: items.map(visualPublic) })
    }
    const items = listVisualArtifacts({ owner: user.id, savedOnly: url.searchParams.get('saved') === '1', limit: 200 })
    json(res, 200, { ok: true, items: items.map(visualPublic) })
  },
  'GET /api/visuals/versions': (req, res, url) => {
    const user = roleOf(req)
    const id = String(url.searchParams.get('id') || '').trim()
    const visual = getVisualArtifact(id)
    if (!visual) return json(res, 404, { error: '可视化对象不存在', code: 'VISUAL_NOT_FOUND' })
    if (String(visual.owner || '') !== user.id) return json(res, 403, { error: '无权访问该可视化对象', code: 'VISUAL_FORBIDDEN' })
    json(res, 200, { ok: true, visual: visualPublic(visual), items: listVisualVersions(id) })
  },
  'POST /api/visuals/save': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.id || '').trim()
    const visual = getVisualArtifact(id)
    if (!visual) return json(res, 404, { error: '可视化对象不存在', code: 'VISUAL_NOT_FOUND' })
    if (String(visual.owner || '') !== user.id) return json(res, 403, { error: '无权访问该可视化对象', code: 'VISUAL_FORBIDDEN' })
    const saved = saveVisualArtifact(id, { title: String(body.name || body.title || visual.title).slice(0, 120), actor: user.id })
    logAudit(user, 'visual.save', id, `status=${saved.status}`, netOf(req))
    json(res, 200, { ok: true, visual: visualPublic(saved) })
  },
  'POST /api/visuals/restore': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.id || '').trim()
    const visual = getVisualArtifact(id)
    if (!visual) return json(res, 404, { error: '可视化对象不存在', code: 'VISUAL_NOT_FOUND' })
    if (String(visual.owner || '') !== user.id) return json(res, 403, { error: '无权访问该可视化对象', code: 'VISUAL_FORBIDDEN' })
    try {
      const restored = restoreVisualVersion(id, body.version, user.id, `恢复 v${body.version}`)
      logAudit(user, 'visual.restore', id, `version=${body.version}`, netOf(req))
      json(res, 200, { ok: true, visual: visualPublic(restored) })
    } catch (error) {
      json(res, 422, { error: String(error?.message || error), code: 'VISUAL_RESTORE_FAILED' })
    }
  },
  'GET /api/conversation/export': (req, res, url) => {
    const user = roleOf(req)
    const id = url.searchParams.get('id')
    const c = conversations.find((x) => x.id === id)
    if (!c) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, c)) return json(res, 403, { error: '无权导出该会话', code: 'CONVERSATION_FORBIDDEN' })
    const markdown = conversationMarkdown(c)
    const safeId = String(c.id || 'conversation').replace(/[^A-Za-z0-9_-]/g, '')
    logAudit(user, 'conversation.export', c.id, `bytes=${Buffer.byteLength(markdown)}`, netOf(req))
    res.writeHead(200, {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="jg-${safeId}.md"`,
      'cache-control': 'no-store',
    })
    res.end(markdown)
  },
  'GET /api/conversation/trace': (req, res, url) => {
    const user = roleOf(req)
    const id = url.searchParams.get('id')
    const c = conversations.find((x) => x.id === id)
    if (!c) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, c)) return json(res, 403, { error: '无权访问该会话轨迹', code: 'CONVERSATION_FORBIDDEN' })
    const wanted = url.searchParams.get('trace')
    const home = userAgentHome(user.id)
    if (!wanted) return json(res, 200, { ok: true, items: listTraces(home, c.id) })
    const trace = readTrace(home, c.id, wanted)
    if (!trace) return json(res, 404, { error: '本轮运行轨迹不存在或已被清理', code: 'TRACE_NOT_FOUND' })
    json(res, 200, { ok: true, trace })
  },
  'GET /api/conversation/session-log': (req, res, url) => {
    const user = roleOf(req)
    const id = url.searchParams.get('id')
    const c = conversations.find((x) => x.id === id)
    if (!c) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, c)) return json(res, 403, { error: '无权导出该会话日志', code: 'CONVERSATION_FORBIDDEN' })
    if (!c.dshSessionId) return json(res, 409, { error: '该会话还没有关联的 Harness 会话日志', code: 'SESSION_LOG_NOT_READY' })
    const home = userDshHome(user.id)
    const traceId = (c.messages || []).slice().reverse().find((m) => m.traceId)?.traceId
    const trace = traceId ? readTrace(userAgentHome(user.id), c.id, traceId) : null
    const archive = buildSessionLogArchive({
      dshHome: home,
      conversationId: c.id,
      sessionId: c.dshSessionId,
      trace,
      meta: {
        title: c.title, userId: c.userId || user.id, model: c.model, turns: c.turns || 0,
        projectId: c.projectId || '', workspace: c.workspace || '',
      },
    })
    if (!archive) return json(res, 404, { error: '没有找到该会话的 DSH 原始日志文件', code: 'SESSION_LOG_NOT_FOUND' })
    const safeId = String(c.id || 'conversation').replace(/[^A-Za-z0-9_-]/g, '')
    logAudit(user, 'conversation.session-log', c.id, `files=${archive.files},bytes=${archive.buffer.length}`, netOf(req))
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': archive.buffer.length,
      'content-disposition': `attachment; filename="jg-${safeId}.session-log.zip"`,
      'cache-control': 'no-store',
    })
    res.end(archive.buffer)
  },
  'POST /api/conversation/fork': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.conversationId || body.id || '')
    const source = conversations.find((x) => x.id === id)
    if (!source) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, source)) return json(res, 403, { error: '无权分叉该会话', code: 'CONVERSATION_FORBIDDEN' })
    if (source.status === 'running') return json(res, 409, { error: '当前会话仍在执行，请结束后再分叉', code: 'CONVERSATION_RUNNING' })
    const messages = Array.isArray(source.messages) ? source.messages : []
    const requested = Number(body.index)
    const upto = Number.isFinite(requested) ? Math.max(0, Math.min(messages.length - 1, requested)) : messages.length - 1
    const copied = upto >= 0 ? messages.slice(0, upto + 1).map((m) => {
      const next = { ...m, streaming: false, feedback: null, feedbackAt: null }
      // 分叉会话不复用源会话的轨迹文件；下一轮会生成自己的轨迹。
      delete next.traceId
      delete next.runStats
      return next
    }) : []
    const newId = `C-${Date.now()}`
    const forkContext = copied
      .slice(-16)
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${String(m.text || '').replace(/\s+/g, ' ').slice(0, 500)}`)
      .join('\n')
      .slice(0, 6000)
    const conv = {
      id: newId,
      title: `分叉 · ${String(source.title || '未命名会话')}`.slice(0, 80),
      time: '刚刚',
      kind: source.kind || ((source.mode || source.resolvedMode) === 'work' ? 'work' : 'chat'),
      model: source.model,
      turns: Math.ceil(copied.length / 2),
      status: 'done',
      workspace: source.workspace || '默认工作区',
      projectId: source.projectId || null,
      mode: source.mode || source.resolvedMode || 'chat',
      taskMode: source.taskMode || 'auto',
      resolvedMode: source.resolvedMode || source.mode || 'chat',
      modeReason: source.modeReason || '',
      executionPolicy: source.executionPolicy === 'manual' ? 'manual' : 'auto',
      agentPresetId: source.agentPresetId || '',
      agentPresetName: source.agentPresetName || '',
      reasoningEffort: source.reasoningEffort || '',
      userId: String(source.userId || user.id),
      forkedFrom: source.id,
      forkedAt: new Date().toISOString(),
      forkContext,
      messages: copied,
    }
    conversations.unshift(conv)
    persistPersistentState()
    logAudit(user, 'conversation.fork', `${source.id}->${newId}`, `messages=${copied.length}`, net)
    json(res, 200, { ok: true, conversation: conv, note: '已复制可见对话历史并新开 DSH 会话；不是 DSH 原生 fork。' })
  },
  'POST /api/conversation/policy': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const conv = conversations.find((c) => c.id === body.conversationId)
    if (!conv) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权修改该会话', code: 'CONVERSATION_FORBIDDEN' })
    if (conv.status === 'running') {
      return json(res, 409, { error: '本轮执行尚未结束，切换策略会从下一轮开始生效', code: 'POLICY_RUNNING' })
    }
    const policy = body.executionPolicy === 'manual' ? 'manual' : body.executionPolicy === 'auto' ? 'auto' : ''
    if (!policy) return json(res, 400, { error: 'executionPolicy 只能是 auto 或 manual' })
    const previous = conv.executionPolicy || 'auto'
    conv.executionPolicy = policy
    logAudit(user, 'conversation.policy', conv.id, `${previous}->${policy}`, net)
    json(res, 200, { ok: true, executionPolicy: policy, previous })
  },
  'POST /api/conversation/job/kill': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const conv = conversations.find((c) => c.id === body.conversationId)
    if (!conv) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权操作该会话的后台作业', code: 'CONVERSATION_FORBIDDEN' })
    if (!conv.dshSessionId) return json(res, 409, { error: '该会话还没有关联的 Harness 会话', code: 'JOB_NO_SESSION' })
    const jobId = String(body.jobId || '').trim()
    if (!jobId) return json(res, 400, { error: '缺少 jobId' })
    const liveStatus = (s) => /running|pending|已启动/i.test(String(s || ''))
    const job = (conv.messages || []).flatMap((m) => m.jobs || []).find((j) => j.id === jobId)
    if (!job) return json(res, 404, { error: '该会话没有这个后台作业', code: 'JOB_NOT_FOUND' })
    if (!conv.agentCwd) return json(res, 409, { error: '该会话还没有可停止的运行时', code: 'JOB_RUNTIME_MISSING' })
    if (!liveStatus(job.status)) return json(res, 409, { error: '该作业已结束，无需停止', code: 'JOB_ALREADY_SETTLED' })
    const busyOther = conversations.some((c) => c.id !== conv.id && c.agentCwd === conv.agentCwd && activeRuns.has(c.id))
    if (busyOther) {
      return json(res, 409, { error: '该项目下还有其他会话正在执行，暂不能停止运行时', code: 'JOB_RUNTIME_BUSY' })
    }
    try {
      await stopBackgroundRuntime(conv.agentCwd)
      for (const message of (conv.messages || [])) {
        for (const item of (message.jobs || [])) if (liveStatus(item.status)) item.status = '已停止'
      }
      logAudit(user, 'conversation.job.kill', `${conv.id}:${jobId}`, 'allow', net)
      return json(res, 200, { ok: true, jobId })
    } catch (error) {
      if (error instanceof HarnessError) {
        logAudit(user, 'conversation.job.kill', `${conv.id}:${jobId}`, `fail:${error.code}`, net)
        return json(res, error.status || 502, { error: error.message, code: error.code })
      }
      return json(res, 500, { error: String(error) })
    }
  },
  'POST /api/conversation/move': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const conv = conversations.find((c) => c.id === body.conversationId)
    if (!conv) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权修改该会话', code: 'CONVERSATION_FORBIDDEN' })
    const projectId = String(body.projectId || '')
    if (projectId && !projects.some((p) => p.id === projectId)) return json(res, 404, { error: '项目不存在' })
    conv.projectId = projectId || null
    logAudit(user, 'conversation.move', conv.id, projectId ? `project=${projectId}` : 'project=none', net)
    json(res, 200, { ok: true, conversation: conv })
  },
  'POST /api/conversation/feedback': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.conversationId || body.id || '')
    const index = Number(body.index)
    const value = String(body.value || '')
    if (!['up', 'down', 'clear'].includes(value)) return json(res, 400, { error: '反馈值只能是 up / down / clear' })
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权评价该会话', code: 'CONVERSATION_FORBIDDEN' })
    const message = conv.messages[index]
    if (!message || message.role !== 'assistant') return json(res, 400, { error: '只能对助手消息反馈' })
    message.feedback = value === 'clear' ? null : value
    message.feedbackAt = value === 'clear' ? null : new Date().toISOString()
    logAudit(user, 'conversation.feedback', id, `#${index}:${value}`, net)
    json(res, 200, { ok: true, index, feedback: message.feedback })
  },
  'POST /api/conversation/delete': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.conversationId || body.id || '')
    const index = conversations.findIndex((c) => c.id === id)
    if (index < 0) return json(res, 404, { error: '会话不存在' })
    const conv = conversations[index]
    if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权删除该会话', code: 'CONVERSATION_FORBIDDEN' })
    conversations.splice(index, 1)
    logAudit(user, 'conversation.delete', id, `turns=${conv.turns || 0}`, net)
    json(res, 200, { ok: true, id, note: '仅移除产品会话记录；Harness 历史文件按会话策略保留。' })
  },
  'POST /api/conversation/clear': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    if (!body.confirm) return json(res, 400, { error: '清空最近对话需要明确确认' })
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map((id) => String(id || '')).filter(Boolean))]
      : []
    if (!ids.length) return json(res, 400, { error: '没有指定要清空的最近对话' })
    const targets = conversations.filter((conv) => ids.includes(conv.id) && conversationAllowed(user, conv) && !conv.projectId)
    if (!targets.length) return json(res, 400, { error: '没有可清空的最近对话；项目下的对话会始终保留' })
    const running = targets.filter((conv) => conv.status === 'running')
    if (running.length) return json(res, 409, { error: `还有 ${running.length} 条对话正在生成，请先停止后再清空` })
    let removed = 0
    for (let i = conversations.length - 1; i >= 0; i -= 1) {
      const conv = conversations[i]
      // 项目会话即使被误传 ID 也不会删除；项目入口与线程始终保留。
      if (!conversationAllowed(user, conv) || conv.projectId) continue
      if (!ids.includes(conv.id)) continue
      conversations.splice(i, 1)
      removed += 1
    }
    persistPersistentState()
    const preservedProjects = conversations.filter((conv) => conversationAllowed(user, conv) && conv.projectId).length
    logAudit(user, 'conversation.clear', 'recent', `count=${removed};projects=${preservedProjects}`, net)
    json(res, 200, { ok: true, removed, preservedProjects, note: '仅清空最近对话；项目下的对话、项目文件、项目目录与审计记录保留。' })
  },
  'POST /api/conversation/message/delete': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.conversationId || body.id || '')
    const index = Number(body.index)
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return json(res, 404, { error: '会话不存在' })
    if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权修改该会话', code: 'CONVERSATION_FORBIDDEN' })
    if (conv.status === 'running') return json(res, 409, { error: '对话正在生成，暂不能删除消息' })
    if (!Number.isInteger(index) || index < 0 || index >= conv.messages.length) return json(res, 400, { error: '消息位置无效' })
    if (conv.messages[index]?.role !== 'user') return json(res, 400, { error: '这里只能删除用户消息' })
    const [removed] = conv.messages.splice(index, 1)
    persistPersistentState()
    logAudit(user, 'conversation.message.delete', id, `#${index}:${String(removed?.text || '').slice(0, 80)}`, net)
    json(res, 200, { ok: true, index })
  },
  'POST /api/terminal/exec': async (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可使用平台终端' })
    const body = JSON.parse(req.__body || '{}')
    const root = join(dataDirPath(), 'terminal', String(user.id || 'admin'))
    mkdirSync(root, { recursive: true })
    const result = await execTerminal(user.id, root, body.command, Math.max(5000, Math.min(120000, Number(body.timeoutMs) || 60000)))
    logAudit(user, 'terminal.exec', String(body.command || '').slice(0, 160), result.ok ? `ok(${result.exitCode})` : `fail(${result.exitCode ?? 'timeout'})`, netOf(req))
    json(res, 200, result)
  },
  'GET /api/terminal': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可使用平台终端' })
    const root = join(dataDirPath(), 'terminal', String(user.id || 'admin'))
    mkdirSync(root, { recursive: true })
    json(res, 200, { ok: true, ...terminalStatus(user.id, root) })
  },
  'POST /api/terminal/reset': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理员可使用平台终端' })
    resetTerminal(user.id)
    logAudit(user, 'terminal.reset', user.id, 'allow', netOf(req))
    json(res, 200, { ok: true })
  },
  'GET /api/worktrees': (req, res, url) => {
    const user = roleOf(req)
    const projectId = String(url.searchParams.get('projectId') || '').trim()
    if (!projectId) return json(res, 400, { error: '缺少 projectId' })
    const info = projectWorktreeInfo(user, projectId)
    if (info.error) return json(res, info.status || 400, { error: info.error })
    if (!info.repo) return json(res, 200, { ok: true, repo: false, projectId, cwd: info.cwd, items: [], note: info.note })
    json(res, 200, {
      ok: true, repo: true, projectId, projectName: info.project.name, cwd: info.cwd,
      items: info.items, branches: info.branches, note: info.note,
    })
  },
  'POST /api/worktrees/merge': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const info = projectWorktreeInfo(user, String(body.projectId || ''))
    if (info.error) return json(res, info.status || 400, { error: info.error })
    if (!info.repo) return json(res, 409, { error: '当前项目不是 Git 仓库', code: 'NOT_GIT_REPO' })
    const targetPath = String(body.path || '').trim().replace(/[\\/]+$/, '')
    const target = info.items.find((x) => x.path.toLowerCase() === targetPath.toLowerCase())
    if (!target) return json(res, 404, { error: '工作树不存在或已移除' })
    if (target.main) return json(res, 400, { error: '不能把主工作树合并到自身' })
    if (!target.branch) return json(res, 409, { error: '该工作树处于分离 HEAD，无法确定要合并的分支' })
    if (target.dirty) return json(res, 409, { error: `该工作树有 ${target.dirty} 个未提交改动，请先提交后再合并` })
    const main = info.items[0]
    const mainStatus = worktreeStatus(main.path)
    if (mainStatus.dirty) return json(res, 409, { error: `主工作树有 ${mainStatus.dirty} 个未提交改动，请先提交后再合并` })
    const merged = gitAt(main.path, ['merge', '--no-ff', '--no-edit', '--', target.branch], 30000)
    if (!merged.ok) {
      return json(res, 409, {
        error: '合并未完成',
        code: 'MERGE_FAILED',
        branch: target.branch,
        output: `${merged.stdout}\n${merged.stderr}`.trim(),
        note: 'Git 已保留冲突现场，请在主工作树中解决冲突后继续。',
      })
    }
    logAudit(user, 'worktree.merge', info.project.id, `${target.branch} -> ${main.branch || 'current'}`, netOf(req))
    json(res, 200, { ok: true, branch: target.branch, output: `${merged.stdout}\n${merged.stderr}`.trim() })
  },
  'POST /api/worktrees/discard': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const info = projectWorktreeInfo(user, String(body.projectId || ''))
    if (info.error) return json(res, info.status || 400, { error: info.error })
    if (!info.repo) return json(res, 409, { error: '当前项目不是 Git 仓库', code: 'NOT_GIT_REPO' })
    const targetPath = String(body.path || '').trim().replace(/[\\/]+$/, '')
    const target = info.items.find((x) => x.path.toLowerCase() === targetPath.toLowerCase())
    if (!target) return json(res, 404, { error: '工作树不存在或已移除' })
    if (target.main) return json(res, 400, { error: '不能移除主工作树' })
    const removed = gitAt(info.cwd, ['worktree', 'remove', '--force', target.path], 20000)
    if (!removed.ok) {
      return json(res, 502, {
        error: '移除工作树失败', code: 'WORKTREE_REMOVE_FAILED',
        output: `${removed.stdout}\n${removed.stderr}`.trim(),
      })
    }
    logAudit(user, 'worktree.discard', info.project.id, target.path, netOf(req))
    json(res, 200, { ok: true, path: target.path, note: '工作树目录及其未提交改动已移除，分支保留。' })
  },
  'POST /api/worktrees/delete-branch': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const info = projectWorktreeInfo(user, String(body.projectId || ''))
    if (info.error) return json(res, info.status || 400, { error: info.error })
    if (!info.repo) return json(res, 409, { error: '当前项目不是 Git 仓库', code: 'NOT_GIT_REPO' })
    const branch = String(body.branch || '').trim()
    if (!branch) return json(res, 400, { error: '缺少分支名' })
    const target = info.branches.find((item) => item.name === branch)
    if (!target) return json(res, 404, { error: '分支不存在或已删除' })
    if (target.current) return json(res, 409, { error: '不能删除当前检出的分支，请先切换到其他分支' })
    if (!target.orphan) return json(res, 409, { error: '该分支仍被工作树占用，请先移除工作树再删除分支' })
    const deleted = gitAt(info.cwd, ['branch', '-D', branch], 10000)
    if (!deleted.ok) {
      return json(res, 502, {
        error: '删除分支失败', code: 'BRANCH_DELETE_FAILED',
        output: `${deleted.stdout}\n${deleted.stderr}`.trim(),
      })
    }
    logAudit(user, 'worktree.delete-branch', info.project.id, branch, netOf(req))
    json(res, 200, { ok: true, branch, note: '分支已被强制删除；提交对象仍可能被 Git 保留到清理前。' })
  },
  'GET /api/files/tree': (req, res, url) => {
    const user = roleOf(req)
    const rootInfo = resolveFileRoot(user, url)
    if (rootInfo.error) return json(res, rootInfo.status || 400, { error: rootInfo.error })
    const rel = String(url.searchParams.get('path') || '')
    const depth = Math.max(1, Math.min(5, Number(url.searchParams.get('depth') || 1)))
    const tree = projectFileTree(rootInfo.root, rel, depth)
    if (tree.error) return json(res, tree.status || 400, { error: tree.error })
    json(res, 200, { ok: true, root: rootInfo.root, label: rootInfo.label, kind: rootInfo.kind, ...tree })
  },
  'GET /api/files/content': (req, res, url) => {
    const user = roleOf(req)
    const rootInfo = resolveFileRoot(user, url)
    if (rootInfo.error) return json(res, rootInfo.status || 400, { error: rootInfo.error })
    const safe = safeFilePath(rootInfo.root, String(url.searchParams.get('path') || ''))
    if (safe.error) return json(res, safe.status || 400, { error: safe.error })
    const stat = statSync(safe.path)
    if (stat.isDirectory()) return json(res, 400, { error: '不能预览目录' })
    const ext = extname(safe.path).toLowerCase()
    const base = { ok: true, path: safe.rel, name: basename(safe.path), size: stat.size, ext, mtime: stat.mtimeMs, image: FILE_IMAGE_EXT.has(ext) }
    if (FILE_IMAGE_EXT.has(ext) || (stat.size > 0 && stat.size <= 20 * 1024 * 1024 && !FILE_TEXT_EXT.has(ext))) {
      const head = readFileSync(safe.path).subarray(0, 512)
      const binary = head.includes(0)
      if (binary || FILE_IMAGE_EXT.has(ext) || !FILE_TEXT_EXT.has(ext)) {
        return json(res, 200, { ...base, binary: true, rawUrl: `/api/files/raw?${new URLSearchParams({ projectId: url.searchParams.get('projectId') || '', conversationId: url.searchParams.get('conversationId') || '', path: safe.rel }).toString()}` })
      }
    }
    if (stat.size > 1024 * 1024) return json(res, 200, { ...base, binary: false, tooLarge: true, text: '' })
    const text = readFileSync(safe.path, 'utf8')
    json(res, 200, { ...base, binary: false, text: text.slice(0, 400000), truncated: text.length > 400000 })
  },
  'GET /api/files/raw': (req, res, url) => {
    const user = roleOf(req)
    const rootInfo = resolveFileRoot(user, url)
    if (rootInfo.error) return json(res, rootInfo.status || 400, { error: rootInfo.error })
    const safe = safeFilePath(rootInfo.root, String(url.searchParams.get('path') || ''))
    if (safe.error) return json(res, safe.status || 400, { error: safe.error })
    const stat = statSync(safe.path)
    if (stat.isDirectory() || stat.size > 20 * 1024 * 1024) return json(res, 400, { error: '文件不可预览或超过 20MB' })
    const ext = extname(safe.path).toLowerCase()
    res.writeHead(200, {
      'content-type': FILE_RAW_TYPES[ext] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'private, max-age=60',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(basename(safe.path))}`,
    })
    res.end(readFileSync(safe.path))
  },
  'GET /api/speech/catalog': async (req, res) => {
    const status = modelStatus()
    json(res, 200, { ok: true, provider: 'sensevoice-local', ...status })
  },
  'POST /api/speech/prepare': async (req, res) => {
    try {
      const status = await prepareSpeech()
      json(res, 200, { ok: true, ...status })
    } catch (error) {
      json(res, 502, { error: error?.message || '本地模型准备失败' })
    }
  },
  'POST /api/speech/transcribe': async (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const audioBase64 = String(body.audioBase64 || '')
    if (!audioBase64 || audioBase64.length > 24 * 1024 * 1024) return json(res, 400, { error: '音频为空或超过 24MB' })
    try {
      const result = await transcribeSpeech(Buffer.from(audioBase64, 'base64'), body.language || 'zh')
      json(res, 200, { ok: true, ...result })
    } catch (error) {
      if (error?.code === 'SPEECH_NOT_READY') return json(res, 409, { error: '本地语音模型尚未准备，请联系管理员在管理中心准备模型' })
      json(res, 502, { error: error?.message || '本地语音识别失败' })
    }
  },
  'POST /api/chat': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const text = (body.text || '').trim()
    if (!text) return json(res, 400, { error: '请输入任务描述' })
    const regenerate = body.regenerate === true
    const regenerateIndex = Number(body.messageIndex)
    const projectId = String(body.projectId || '')
    const project = projectId ? liveProjects.find((p) => p.id === projectId && !p.removed) : null
    if (projectId && !project) return json(res, 404, { error: '项目不存在' })
    const idempotencyKey = String(body.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 160)
    if (idempotencyKey) {
      const prior = liveTasks.find((t) => t.kind === 'chat-run' && t.idempotencyKey === idempotencyKey && String(t.userId || '') === String(user.id || ''))
      if (prior && ['queued', 'running', 'resuming'].includes(prior.state)) {
        return json(res, 409, { error: '同一请求正在执行，请勿重复提交', code: 'DUPLICATE_REQUEST', task: prior })
      }
      if (prior && ['done', 'failed', 'cancelled', 'interrupted'].includes(prior.state)) {
        const priorConv = conversations.find((c) => c.id === prior.conversationId)
        return json(res, 200, { ok: true, duplicate: true, task: prior, conversation: priorConv || null, reply: prior.replyText || '', steps: prior.steps || [] })
      }
    }
    // 执行前再校验项目归属与设备绑定：前端列表过滤不能作为唯一防线。
    if (projectId) {
      const check = projectRunnableBy(user, project)
      if (!check.ok) return json(res, check.code === 'PROJECT_FORBIDDEN' ? 403 : 409, { error: check.error, code: check.code })
    }
    // 统一入口：Auto 规则路由决定本轮按 Chat 还是 Work 执行；手动 Chat/Work 直接覆盖。
    const taskMode = ['auto', 'chat', 'work'].includes(String(body.mode || ''))
      ? String(body.mode)
      : 'auto'
    const route = resolveTaskMode(text, taskMode, projectId)
    const mode = route.mode
    const webSearch = Boolean(body.webSearch)
    if (webSearch) {
      const webCap = platformCapabilities(accountRuntimeHome(user)).find((c) => c.id === 'CAP-WEB')
      if (!webCap?.enabled) return json(res, 403, { error: 'Web 搜索能力当前已被平台停用', code: 'WEB_SEARCH_DISABLED' })
      if (net === 'secret') return json(res, 403, { error: '涉密内网不开放互联网网页搜索', code: 'WEB_SEARCH_NETWORK_BLOCKED' })
    }
    if (projectId && projectStatus(project) !== 'online') {
      return json(res, 409, {
        error: projectStatus(project) === 'other-device' ? '该项目绑定在另一台设备上，当前设备不可执行' : '项目本地文件夹当前不可用，请重新连接后再执行',
        code: projectStatus(project) === 'other-device' ? 'PROJECT_DEVICE_MISMATCH' : 'PROJECT_OFFLINE',
      })
    }
    const requestedPreset = agentPresets.find((p) => p.id === String(body.presetId || '')) || null
    const requestedPolicy = body.executionPolicy === 'manual'
      ? 'manual'
      : body.executionPolicy === 'auto' ? 'auto' : (requestedPreset?.defaultPolicy || runtimeSettings.defaultPolicy)
    const effortLevel = ['low', 'medium', 'high'].includes(String(body.reasoningEffort || ''))
      ? String(body.reasoningEffort)
      : (requestedPreset?.defaultEffort || runtimeSettings.defaultEffort)
    const deepThink = body.deepThink === true
    // DeepSeek provider supports off/low/high/max；产品三档映射为 低→off、中→low、高→high。
    // 深度思索使用独立推理模型，固定按高推理强度运行，不复用普通对话的档位。
    const reasoningEffort = deepThink ? 'high' : effortLevel === 'low' ? 'off' : effortLevel === 'medium' ? 'low' : 'high'
    const requestKey = String(body.ownApiKey || '').trim()
    if (user.id === 'guest' && !requestKey) {
      return json(res, 403, {
        error: '外部访客只能使用自己的模型 API，不能使用集团统一配置的 API；请在「设置 · 模型与密钥」填写自己的 Key',
        ownApiRequired: true,
      })
    }
    let conv = conversations.find((c) => c.id === body.conversationId)
    let executionPolicy
    let activePreset = requestedPreset
    if (!conv) {
      if (regenerate) return json(res, 404, { error: '要重新生成的会话不存在' })
      // 允许客户端先分配会话 ID，便于首轮执行期间就能按会话轮询审批/提问。
      const requestedId = /^C-\d{6,}$/.test(String(body.conversationId || '')) ? String(body.conversationId) : ''
      executionPolicy = requestedPolicy
      conv = {
        id: requestedId || `C-${Date.now()}`, title: text.length > 26 ? `${text.slice(0, 26)}…` : text,
        time: '刚刚', model: deepThink ? 'DeepSeek Reasoner' : (networks[net].models.find((m) => m.id === body.model)?.label || networks[net].models[0].label),
        turns: 0, status: 'running', workspace: '默认工作区', projectId: projectId || null, mode,
        taskMode, resolvedMode: mode, modeReason: route.reason,
        executionPolicy, agentPresetId: requestedPreset?.id || '', agentPresetName: requestedPreset?.name || '', messages: [], reasoningEffort: deepThink ? 'high' : effortLevel, deepThink, userId: String(user.id),
      }
      conversations.unshift(conv)
    } else {
      if (!conversationAllowed(user, conv)) return json(res, 403, { error: '无权访问该会话', code: 'CONVERSATION_FORBIDDEN' })
      if (regenerate) {
        if (!Number.isInteger(regenerateIndex) || regenerateIndex < 0 || regenerateIndex >= conv.messages.length) {
          return json(res, 400, { error: '要重新生成的消息位置无效' })
        }
        if (conv.messages[regenerateIndex]?.role !== 'assistant') {
          return json(res, 400, { error: '只能重新生成助手回复' })
        }
        if (conv.status === 'running') return json(res, 409, { error: '当前会话正在生成，请完成或停止后再重新生成' })
      }
      if (!conv.userId) conv.userId = 'admin'
      // 已有会话的策略以服务端存储为准；请求体只作为首次创建时的初始值。
      executionPolicy = conv.executionPolicy === 'manual' ? 'manual' : 'auto'
      conv.mode = mode
      conv.taskMode = taskMode
      conv.resolvedMode = mode
      conv.modeReason = route.reason
      conv.projectId = projectId || null
      conv.executionPolicy = executionPolicy
      if (requestedPreset) {
        activePreset = requestedPreset
        conv.agentPresetId = requestedPreset.id
        conv.agentPresetName = requestedPreset.name
      } else {
        activePreset = agentPresets.find((p) => p.id === conv.agentPresetId) || null
      }
    }
    // Chat 不要求用户建项目，但每个会话使用独立的托管目录；Work 则使用项目绑定的真实本地目录。
    if (executionPolicy === 'auto' && explicitHighRiskRequest(text)) {
      conv.status = 'failed'
      logAudit(user, 'chat.guard', conv.id, 'deny(auto-high-risk-request)', net)
      return json(res, 403, {
        error: '「帮我批准」不执行高风险删除/覆盖命令。请切换到「请求批准」，逐次批准后再执行。',
        code: 'HIGH_RISK_REQUIRES_MANUAL',
      })
    }
    conv.agentCwd = project?.cwd || chatWorkspaceDir(user, conv.id)
    conv.cancelRequested = false
    if (!regenerate) conv.messages.push({ role: 'user', text, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5) })
    conv.status = 'running'
    activeRuns.add(conv.id)
    let modelCfg = resolveModelConfig({
      userConfig: liveModelConfig.get(user.id) || {},
      request: { ownApiKey: requestKey, modelName: body.modelName },
    })
    if (modelCfg.source === 'none') {
      conv.status = 'failed'
      activeRuns.delete(conv.id)
      return json(res, 503, {
        error: '首页对话已接入真实模型网关，但当前没有配置模型密钥。请在启动环境设置 JG_MODEL_API_KEY（可选 JG_MODEL_BASE_URL、JG_MODEL_NAME），或在「设置 · 模型与密钥」保存个人 Key。',
        code: 'MODEL_KEY_MISSING',
        model: { name: modelCfg.model, endpoint: modelCfg.baseUrl, keyConfigured: false },
      })
    }
    if (deepThink) {
      const deepSeekRoute = /deepseek\.com/i.test(modelCfg.baseUrl) || /deepseek/i.test(modelCfg.model)
      if (!deepSeekRoute) {
        conv.status = 'failed'
        activeRuns.delete(conv.id)
        return json(res, 409, {
          error: '当前模型网关不支持深度思索。深度思索需要 DeepSeek 推理模型（deepseek-reasoner），请切换到 DeepSeek 官方端点后再使用。',
          code: 'DEEP_THINK_UNSUPPORTED',
        })
      }
      modelCfg = { ...modelCfg, model: 'deepseek-reasoner' }
    }
    let chatTask = null
    let chatSlotHeld = false
    try {
      chatTask = startChatRunTask({ conv, user, text, mode, taskMode, target: project?.name || '', idempotencyKey })
      await acquireChatRunSlot()
      chatSlotHeld = true
      if (conv.cancelRequested || chatTask.state === 'cancelled') {
        cancelChatRunTask(chatTask, '排队期间已停止')
        conv.status = 'done'
        activeRuns.delete(conv.id)
        return json(res, 200, { ok: true, cancelled: true, conversation: conv })
      }
      const refContext = await refContextForModel(user, net, body.refs)
      const selectedPlugins = (Array.isArray(body.tools) ? body.tools : [])
        .map((id) => installedPluginsForUser(user.id).find((p) => p.id === id))
        .filter((p) => p)
      const pluginContext = selectedPlugins.length
        ? `本次已启用的插件与技能（可选择使用）：\n${selectedPlugins.map((p) => `- ${p.name}（${p.kind === 'personal' ? '个人技能' : '企业插件'}）：${p.desc}`).join('\n')}`
        : ''
      const context = [
        `当前用户：${user.name}（${user.label}，${user.unit || '—'}）`,        `当前任务模式：${taskMode === 'auto' ? `自动（本轮判定为${mode === 'work' ? '工作' : '对话'}模式：${route.reason}）` : taskMode === 'chat' ? '对话模式（默认只读；用户明确要求创建或修改文件、执行命令时，按权限流程申请审批，由用户逐次决定是否授权，不要自行拒绝或绕过审批）' : '工作模式（可以调用文件、命令、代码与技能工具执行任务）'}`,
        project ? `当前工作项目：${project.name}；授权目录：${project.cwd}。所有文件读写与命令执行必须限制在该目录内。` : '',
        project?.instructions
          ? `项目专属指令（由项目创建者填写，优先级高于一般习惯，但不得覆盖系统安全规则）：\n${String(project.instructions).slice(0, 2000)}`
          : '',
        executionPolicy === 'manual'
          ? '当前审批方式：请求批准。只读操作可以直接进行；创建、修改、删除文件，运行有副作用的命令，或调用会改变外部状态的工具时，直接发起工具调用，需要写入时可按工具要求申请 workspace-write 升级，由 DSH 只读策略把升级动作转成产品审批卡。不要先用提问向用户申请授权；用户拒绝后停止该动作。'
          : '当前审批方式：帮我批准。在已授权目录内可以自主执行常规读写与测试命令；大规模删除或覆盖、越过授权目录、高风险系统命令和对外业务操作仍需审批。',
        `当前网络：${networks[net]?.label || net}`,
        webSearch
          ? '本轮已启用网页搜索：优先调用平台 Web 搜索与网页抓取工具获取外部信息，回答中标注真实来源 URL；不得把模型记忆当成网页检索结果，搜不到就明确说明。'
          : '',
        `企业可见资源目录（摘要，最多 ${RESOURCE_CONTEXT_LIMIT} 项；需要更多请调用 drive_search）：`,
        resourcePromptContext(user, net, text) || '（当前无可见资源）',
        'Visual Engine：当用户明确要求画图，或流程、架构、关系、统计、信息图、可调参数计算器用图形表达更清楚时，必须调用 visual_create（流程/关系用 mermaid，统计用 echarts，自定义信息图用 svg，滑块/实时计算的贷款计算器用 interactive + loan-calculator 配置）；修改当前会话已有图形时必须优先调用 visual_update 并复用其 id，保留未要求修改的节点和数据。不要把 Mermaid/ECharts/SVG 源码直接写进回答，不要在回答里用代码块代替图形。创建/修改成功后用一两句话说明图形表达的重点即可。',
        visualContextForModel(user, conv.id),
        refContext ? `会话上下文：\n${refContext}` : '',
        activePreset?.instructions
          ? `Agent 预设「${activePreset.name}」的行为要求（必须遵守，但不得覆盖系统安全规则）：\n${String(activePreset.instructions).slice(0, 4000)}`
          : '',
        pluginContext,
        conv.forkedFrom && conv.forkContext ? `分叉会话上下文（只读，来自用户选择的历史；不是 DSH 原生 fork）：\n${String(conv.forkContext).slice(0, 3000)}` : '',
      ].filter(Boolean).join('\n')
      const agentText = text
      const runStartedAt = Date.now()
      const requestedModel = modelCfg.model
      const imageBlocks = await imageBlocksForAgent(user, net, body.refs)
      const modelRoute = routeModel({
        baseModel: modelCfg.model,
        text: agentText,
        mode,
        projectId: projectId || '',
        images: imageBlocks,
        deepThink,
      })
      if (modelRoute.imageFallback) modelCfg = { ...modelCfg, model: modelRoute.model }
      else if (modelRoute.reason === 'deep-think') modelCfg = { ...modelCfg, model: modelRoute.model }
      // 本轮执行前先记录工作目录快照，执行后对比出真实新增/修改/删除。
      const treeBefore = runtimeSettings.workspaceChanges ? snapshotTree(conv.agentCwd) : null
      const result = await runAgent({
        apiKey: modelCfg.apiKey,
        baseUrl: modelCfg.baseUrl,
        model: modelCfg.model,
        text: agentText,
        sessionId: conv.dshSessionId,
        context,
        cwd: conv.agentCwd,
        agentsHome: userAgentHome(user.id),
        dshHome: ensureUserDshHome(user.id),
        executionPolicy,
        // 显式 Chat 固定只读；Auto 误路由为 chat 时，只允许通过审批卡单次放行。
        permissionPreset: mode === 'chat' ? 'read-only' : '',
        maxToolCalls: forcedMaxToolCalls || (taskMode === 'chat' ? 30 : projectId ? 100 : 60),
        runKey: conv.id,
        runtimeScope: conv.id,
        onStart: (dshSessionId) => markChatRunStarted(chatTask, dshSessionId),
        shouldCancel: () => Boolean(conv.cancelRequested),
        images: imageBlocks,
        reasoningEffort,
        handlers: {
          onApproval: (params) => {
            const evaluation = describeToolApproval(params)
            // 对话模式默认只读；一旦越界，不在系统侧替用户拒绝，而是发审批卡让用户决定。
            if (mode === 'chat') {
              const rule = taskMode === 'chat' ? 'chat-mode-approval' : 'auto-chat-runtime-approval'
              const decisionId = recordApprovalDecision({
                conversationId: conv.id,
                callId: params?.callId || '',
                tool: params?.toolNameResolved || params?.toolName || '',
                operation: evaluation.operation,
                summary: evaluation.summary,
                decision: 'pending',
                rule,
                risk: evaluation.risk,
                actor: user.name,
                approver: 'pending',
                net,
              })
              return createPendingInteraction('approval', conv.id, approvalDetails(params, { ...evaluation, rule, decisionId }))
            }
            // 是否自动放行由 DSH 权限预设决定：
            // Auto 使用 workspace-write，工作区内操作不会走到这里；能走到这里的都是沙箱升级请求。
            // 手动使用 read-only，写入/执行本来就需要用户确认。因此这里一律人工审批。
            const rule = executionPolicy === 'auto'
              ? 'dsh-workspace-write-escalation'
              : 'dsh-read-only-approval'
            const decisionId = recordApprovalDecision({
              conversationId: conv.id,
              callId: params?.callId || '',
              tool: params?.toolNameResolved || params?.toolName || '',
              operation: evaluation.operation,
              summary: evaluation.summary,
              decision: 'pending',
              rule,
              risk: evaluation.risk,
              actor: user.name,
              approver: 'pending',
              net,
            })
            return createPendingInteraction('approval', conv.id, approvalDetails(params, { ...evaluation, rule, decisionId }))
          },
          onQuestion: (params) => createPendingInteraction('question', conv.id, {
            questions: (Array.isArray(params?.questions) ? params.questions : []).map((q) => ({
              id: String(q.id || ''),
              question: String(q.question || ''),
              detail: q.detail ? String(q.detail) : '',
              header: q.header ? String(q.header) : '',
              intent: q.intent && typeof q.intent === 'object'
                ? { kind: String(q.intent.kind || ''), approve: String(q.intent.approve || '') }
                : null,
              multiSelect: Boolean(q.multiSelect),
              options: (Array.isArray(q.options) ? q.options : []).map((o) => ({
                label: String(o.label || ''),
                description: o.description ? String(o.description) : '',
              })),
            })), 
          }),
          onEvent: (event) => recordChatRunActivity(chatTask, event),
        },
      })
      let reply = result.reply
      if (conv.cancelRequested) {
        conv.status = 'done'
        activeRuns.delete(conv.id)
        cancelChatRunTask(chatTask, '用户停止本轮执行')
        return json(res, 200, { ok: true, cancelled: true, conversation: conv })
      }
      const messageId = `M-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
      const fromReply = visualsFromReply(reply, user, conv.id)
      if (fromReply.visuals.length) {
        reply = fromReply.text.trim() || '已生成可视化，可在消息中查看、放大或导出。'
      }
      const seenVisuals = new Set()
      const visuals = []
      for (const visual of [...(Array.isArray(result.visuals) ? result.visuals : []), ...fromReply.visuals]) {
        const row = visual?.id ? (getVisualArtifact(visual.id) || visual) : null
        if (!row || !row.id) continue
        const key = `${row.id}:${row.version || 1}`
        if (seenVisuals.has(key)) continue
        seenVisuals.add(key)
        attachVisualMessage(row.id, messageId)
        visuals.push(visualRef(row))
      }
      const visible = liveResources.filter((r) => canSee(user, r, net))
      const citationIds = [...new Set((reply.match(/R-[A-Z0-9-]+/g) || []).filter((id) => visible.some((r) => r.id === id)))]
      const citations = citationIds.map((id) => {
        const r = visible.find((x) => x.id === id)
        return { id, name: r.name }
      })
      const steps = result.steps
      const workspaceChanges = treeBefore ? diffTree(treeBefore, snapshotTree(conv.agentCwd), conv.agentCwd) : []
      const traceId = makeTraceId()
      const runStats = buildRunStats({
        startedAt: runStartedAt,
        endedAt: Date.now(),
        model: result.model,
        contextText: context,
        steps,
        usage: result.usage,
        events: result.events,
        taskClass: modelRoute.taskClass,
        imageCount: imageBlocks.length,
        modelReason: modelRoute.reason,
        replyChars: reply.length,
        finishReason: result.finishReason,
      })
      const assistantMsg = {
        id: messageId,
        role: 'assistant', text: reply,
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5),
        steps,
        subagents: Array.isArray(result.subagents) ? result.subagents : [],
        workflows: Array.isArray(result.workflows) ? result.workflows : [],
        todos: Array.isArray(result.todos) ? result.todos : [],
        jobs: Array.isArray(result.jobs) ? result.jobs : [],
        deliverables: Array.isArray(result.deliverables) ? result.deliverables : [],
        visuals,
        workspaceChanges,
        citations: citations.map((c) => c.id),
        model: result.model,
        usage: result.usage || null,
        usageAt: Date.now(),
        traceId,
        runStats,
        taskClass: modelRoute.taskClass,
      }
      // 先把回答落到会话快照，再写轨迹文件：避免进程在“轨迹已写、会话未落库”的窗口内退出，
      // 导致本地只剩用户提问而回答丢失。轨迹失败不影响回答已保存。
      const aiTitle = String(result.title || '').trim()
      const titleLooksUsable = aiTitle
        && aiTitle.length <= 48
        && !/当前用户|管理员|项目上下文|工作目录|系统提示/i.test(aiTitle)
        && !/^(用户|系统|项目|助手|Context|Session|System)/i.test(aiTitle)
      if (titleLooksUsable) conv.title = aiTitle.slice(0, 80)
      if (regenerate) conv.messages[regenerateIndex] = assistantMsg
      else conv.messages.push(assistantMsg)
      conv.turns = Math.ceil(conv.messages.length / 2)
      conv.status = 'done'
      conv.model = result.model
      conv.deepThink = deepThink
      if (reasoningEffort) conv.reasoningEffort = deepThink ? 'high' : effortLevel
      conv.dshSessionId = result.sessionId || conv.dshSessionId || ''
      persistPersistentState()
      try {
        writeTrace(userAgentHome(user.id), {
          traceId,
          conversationId: conv.id,
          dshSessionId: result.sessionId || conv.dshSessionId || '',
          userId: user.id,
          startedAt: runStartedAt,
          endedAt: Date.now(),
          model: result.model,
          requestedModel,
          modelRoute,
          input: text,
          reply,
          context,
          taskClass: modelRoute.taskClass,
          images: imageBlocks.map((block) => ({ name: block.name, mimeType: block.mimeType })),
          finishReason: result.finishReason,
          stats: runStats,
          steps: Array.isArray(steps) ? steps : [],
          usage: result.usage || null,
          toolAudit: Array.isArray(result.toolAudit) ? result.toolAudit : [],
          subagents: Array.isArray(result.subagents) ? result.subagents : [],
          workflows: Array.isArray(result.workflows) ? result.workflows : [],
          events: Array.isArray(result.events) ? result.events : [],
          notifications: Array.isArray(result.notifications) ? result.notifications : [],
        })
      } catch (traceError) {
        console.error('[jg-server] trace persist failed:', traceError?.message || traceError)
      }
      activeRuns.delete(conv.id)
      finishChatRunTask(chatTask, {
        steps: Array.isArray(steps) ? steps.length : 0,
        artifacts: workspaceChanges.length + (Array.isArray(result.deliverables) ? result.deliverables.length : 0),
        reply,
      })
      logAudit(user, 'chat.message', conv.id, `allow(harness=${result.model})`, net)
      for (const tool of (result.toolAudit || [])) {
        logAudit(user, 'harness.tool', tool.tool, `${tool.status}(${tool.callId || '—'}) ${tool.detail}`.slice(0, 900), net)
      }
      return json(res, 200, {
        ok: true, conversation: conv, reply, steps, subagents: result.subagents || [], workflows: result.workflows || [], todos: result.todos || [], jobs: result.jobs || [], deliverables: result.deliverables || [], usage: result.usage || null, citations,
        taskMode, resolvedMode: mode, modeReason: route.reason,
        workspaceChanges,
        model: { name: result.model, latencyMs: result.latencyMs, usage: null, harness: true },
      })
    } catch (error) {
      if (conv.cancelRequested) {
        conv.status = 'done'
        activeRuns.delete(conv.id)
        cancelChatRunTask(chatTask, '用户停止本轮执行')
        return json(res, 200, { ok: true, cancelled: true, conversation: conv })
      }
      conv.status = 'failed'
      activeRuns.delete(conv.id)
      failChatRunTask(chatTask, error?.message || error)
      logAudit(user, 'chat.message', conv.id, `deny(${error.code || 'HARNESS_ERROR'})`, net)
      if (error instanceof HarnessError) {
        return json(res, error.status, { error: error.message, code: error.code, detail: error.detail })
      }
      if (error instanceof ModelError) {
        return json(res, error.status, { error: error.message, code: error.code, detail: error.detail })
      }
      return json(res, 502, { error: `模型调用失败：${error?.message || error}`, code: 'MODEL_ERROR' })
    } finally {
      if (chatSlotHeld) releaseChatRunSlot()
    }
  },
  'GET /api/chat/pending': (req, res) => {
    const user = roleOf(req)
    const conversationId = new URL(req.url, 'http://127.0.0.1').searchParams.get('conversationId') || ''
    const conv = conversations.find((c) => c.id === conversationId)
    if (conv && !conversationAllowed(user, conv)) return json(res, 403, { error: '无权访问该会话', code: 'CONVERSATION_FORBIDDEN' })
    const item = [...pendingInteractions.values()].find((p) => p.conversationId === conversationId)
    if (!item) return json(res, 200, { item: null })
    json(res, 200, {
      item: { id: item.id, kind: item.kind, createdAt: item.createdAt, ...item.payload },
    })
  },
  'GET /api/chat/task': (req, res) => {
    const user = roleOf(req)
    const conversationId = new URL(req.url, 'http://127.0.0.1').searchParams.get('conversationId') || ''
    const conv = conversations.find((c) => c.id === conversationId)
    if (conv && !conversationAllowed(user, conv)) return json(res, 403, { error: '无权访问该会话', code: 'CONVERSATION_FORBIDDEN' })
    const task = liveTasks.find((t) => t.kind === 'chat-run' && t.conversationId === conversationId)
    if (!task) return json(res, 200, { task: null })
    json(res, 200, {
      task: {
        id: task.id,
        state: task.state,
        progress: task.progress,
        progressText: task.progressText || '',
        activityDetail: task.activityDetail || '',
        activityAt: task.activityAt || 0,
        recentActivities: (task.recentActivities || []).slice(-6),
        createdAt: task.createdAt,
      },
    })
  },
  'POST /api/chat/approval': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const requestedId = String(body.id || '')
    const pending = pendingInteractions.get(requestedId)
    if (!pending) return json(res, 404, { error: '审批请求已结束或不存在' })
    const conv = conversations.find((c) => c.id === pending.conversationId)
    if (conv && !conversationAllowed(user, conv)) return json(res, 403, { error: '无权处理该会话的审批', code: 'CONVERSATION_FORBIDDEN' })
    const outcome = ['allowed-once', 'rejected', 'cancelled'].includes(body.outcome) ? body.outcome : 'cancelled'
    const item = settlePendingInteraction(requestedId, { outcome }, { approver: user.name })
    if (!item) return json(res, 404, { error: '审批请求已结束或不存在' })
    const detail = `${item.payload?.toolName || '工具'} ${item.payload?.summary || item.payload?.reason || ''}`.trim()
    logAudit(user, 'chat.approval', item.conversationId, `${outcome} ${detail}`.slice(0, 900), net)
    json(res, 200, { ok: true, outcome })
  },
  'POST /api/chat/answer': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const pending = pendingInteractions.get(String(body.id || ''))
    if (!pending) return json(res, 404, { error: '提问请求已结束或不存在' })
    const conv = conversations.find((c) => c.id === pending.conversationId)
    if (conv && !conversationAllowed(user, conv)) return json(res, 403, { error: '无权回答该会话的问题', code: 'CONVERSATION_FORBIDDEN' })
    const answers = Array.isArray(body.answers)
      ? body.answers.map((a) => ({
        id: String(a.id || ''),
        selected: Array.isArray(a.selected) ? a.selected.map((s) => String(s)) : [],
        ...(a.custom ? { custom: String(a.custom) } : {}),
      }))
      : []
    const item = settlePendingInteraction(String(body.id || ''), answers.length ? { answers } : { cancelled: true })
    if (!item) return json(res, 404, { error: '提问请求已结束或不存在' })
    json(res, 200, { ok: true })
  },
  'POST /api/chat/cancel': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const conv = conversations.find((c) => c.id === body.conversationId)
    if (conv && !conversationAllowed(user, conv)) return json(res, 403, { error: '无权停止该会话', code: 'CONVERSATION_FORBIDDEN' })
    const task = conv?.taskRunId ? liveTasks.find((t) => t.id === conv.taskRunId) : null
    try {
      cancelPendingInteractions(body.conversationId)
      if (!conv) return json(res, 404, { error: '会话不存在', code: 'CONVERSATION_NOT_FOUND' })
      conv.cancelRequested = true
      let native = false
      let closedRuntime = false
      if (activeRuns.has(conv.id)) {
        try {
          const result = await cancelRun(conv.id)
          native = Boolean(result?.native)
          closedRuntime = Boolean(result?.runtimeClosed)
        } catch (cancelError) {
          if (cancelError?.code !== 'SESSION_NOT_RUNNING') throw cancelError
        }
      }
      if (task && task.state !== 'done') cancelChatRunTask(task, '用户停止本轮执行')
      conv.status = 'done'
      activeRuns.delete(conv.id)
      conv.messages.push({
        role: 'assistant',
        text: native ? '已停止本轮 Harness 执行，其他会话不受影响。' : closedRuntime ? '已停止本轮执行；该会话的 Harness 运行时已关闭，其他会话不受影响。' : '已停止本轮生成。',
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5),
        steps: [{ tool: '停止执行', detail: native ? 'DSH session/cancel · 仅取消当前会话回合' : closedRuntime ? '关闭该会话独占运行时' : '任务未在执行，已直接取消', status: 'warn', ms: 0 }],
      })
      logAudit(user, 'chat.cancel', conv.id, native ? 'allow(native-session-cancel)' : closedRuntime ? 'allow(conversation-runtime-close)' : 'allow(queue-cancel)', net)
      return json(res, 200, {
        ok: true, conversation: conv, native, runtimeClosed: closedRuntime,
        note: native ? '已调用 DSH 原生 session/cancel，仅停止当前会话回合，不关闭运行时。' : closedRuntime ? 'DSH SDK 未暴露 session/cancel；已关闭该会话独占的 Harness 运行时，其他会话不受影响。' : '已取消当前任务，未发现正在执行的 DSH 回合。',
      })
    } catch (error) {
      return json(res, error?.status || 502, {
        error: `停止执行失败：${error?.message || error}`,
        code: error?.code || 'SESSION_CANCEL_FAILED',
      })
    }
  },
  'POST /api/chat/confirm': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const conv = conversations.find((c) => c.id === body.conversationId)
    const task = {
      id: `T-${Date.now()}`, title: '生成周报草稿（已确认写入）', state: 'running', progress: 12,
      target: 'AI 工作台 · 写文件', started: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5), createdAt: Date.now(),
    }
    liveTasks.unshift(task)
    const msg = {
      role: 'assistant',
      text: '已生成周报草稿并写入工作区「规划一所周报_2026-11-07.md」，同时登记为任务。写操作已二次确认，操作记录可在审计中查。',
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5),
      steps: [
        { tool: '写文件', detail: '工作区写入 · 已确认', status: 'ok', ms: 900 },
        { tool: '任务登记', detail: task.id, status: 'ok', ms: 400 },
      ],
    }
    if (conv) conv.messages.push(msg)
    logAudit(user, 'file.write', '规划一所周报_2026-11-07.md', 'allow(confirmed)', net)
    json(res, 200, { ok: true, message: msg, task })
  },
  'GET /api/automations': (req, res) => {
    const user = roleOf(req)
    const items = liveAutomations.filter((a) => String(a.userId || '') === String(user.id || ''))
    json(res, 200, { items: [...items, ...harnessSchedules()] })
  },
  'POST /api/automations': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const prompt = String(body.prompt || '').trim()
    if (!prompt) return json(res, 400, { error: '执行内容不能为空' })
    const schedule = String(body.schedule || '每天 08:30').trim()
    // 无人值守任务在创建时就必须声明权限范围；运行时只执行这个范围，超出即停止。
    const permission = String(body.permission || '')
    if (!['read-only', 'workspace-write'].includes(permission)) {
      return json(res, 400, { error: '请先选择任务权限：只读或工作区可写' })
    }
    const item = {
      id: `AU-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
      name: String(body.name || '未命名定时任务').trim() || '未命名定时任务',
      schedule,
      scheduleRule: parseAutomationSchedule(schedule),
      status: 'active',
      last: '—',
      next: '待首次执行',
      owner: user.name,
      userId: String(user.id || ''),
      prompt,
      permission,
      permissionDeclaredAt: Date.now(),
      deliver: String(body.deliver || '工作台 · 定时任务结果'),
      model: '系统默认模型',
      createdAt: Date.now(),
    }
    scheduleAutomationNext(item, Date.now())
    liveAutomations.unshift(item)
    persistPersistentState()
    logAudit(user, 'automation.create', item.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item })
  },
  'POST /api/automations/pause': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.id || '')
    const entry = mutateHarnessSchedule(id, 'pause')
    if (entry) {
      logAudit(user, 'automation.pause', id, entry.status === 'active' ? 'enable' : 'pause', netOf(req))
      return json(res, 200, { ok: true, item: { id, status: entry.status === 'active' ? 'active' : 'paused' } })
    }
    const a = liveAutomations.find((x) => x.id === id && String(x.userId || '') === String(user.id || ''))
    if (!a) return json(res, 404, { error: '不存在该定时任务' })
    a.status = a.status === 'active' ? 'paused' : 'active'
    if (a.status === 'active') scheduleAutomationNext(a, Date.now())
    else a.next = '—'
    persistPersistentState()
    logAudit(user, 'automation.pause', id, a.status === 'active' ? 'enable' : 'pause', netOf(req))
    json(res, 200, { ok: true, item: a })
  },
  'POST /api/automations/delete': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const id = String(body.id || '')
    const entry = mutateHarnessSchedule(id, 'delete')
    if (entry) {
      logAudit(user, 'automation.delete', id, 'allow', netOf(req))
      return json(res, 200, { ok: true })
    }
    const index = liveAutomations.findIndex((x) => x.id === id && String(x.userId || '') === String(user.id || ''))
    if (index < 0) return json(res, 404, { error: '不存在该定时任务' })
    liveAutomations.splice(index, 1)
    persistPersistentState()
    logAudit(user, 'automation.delete', id, 'allow', netOf(req))
    json(res, 200, { ok: true })
  },
  'POST /api/automations/run': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const a = liveAutomations.find((x) => x.id === String(body.id || '') && String(x.userId || '') === String(user.id || ''))
    if (!a) return json(res, 404, { error: '不存在' })
    const result = await runAutomation(a, 'manual')
    if (!result.ok) return json(res, result.code === 'RUNNING' ? 409 : 500, { error: result.error, task: result.task })
    logAudit(user, 'automation.run', a.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item: a, task: result.task })
  },
  'GET /api/console': (req, res) => {
    const user = roleOf(req)
    const installed = installedSkillPlugins()
    const home = accountRuntimeHome(user)
    const runtime = runtimeOverview(home)
    const currentNetwork = networks[netOf(req)] || networks.inet
    const modelConf = liveModelConfig.get(user.id) || {}
    const gatewayEndpoint = maskGatewayEndpoint(modelConf.endpoint || 'https://ai.jg.local/v1')
    const gatewayProvider = modelConf.provider || '统一模型网关'
    const gatewayModel = modelConf.defaultModel || (currentNetwork.models[0] || {}).label || '—'
    const gatewayKeySaved = Boolean(modelConf.apiKey || modelConf.key)
    const capabilityCount = platformCapabilities(home).filter((p) => p.enabled).length
    const skillCount = installed.filter((p) => p.kind === 'personal').length
    const listedMarket = liveMarket.filter((m) => m.listed !== false && !(m.kind === 'skill' && marketSkillGlobalBaseline(m.id)))
    const listedCount = listedMarket.length
    const pluginMarketCount = listedMarket.filter((m) => m.kind === 'bundle' || m.kind === 'plugin').length
    const skillMarketCount = listedCount - pluginMarketCount
    const pendingCount = pluginSubs.filter((s) => s.status === 'pending').length
    const totalCaps = platformCapabilities(home).length
    const sections = {
      ...consoleSections,
      overview: {
        ...consoleSections.overview,
        meta: '运行概况只展示当前运行时实际计数；未接入监控的指标不展示',
        kpis: [
          { k: '平台服务', v: `${capabilityCount} / ${totalCaps}`, note: '运行时实际启用的公共能力', tone: 'ok' },
          { k: '已安装技能', v: `${skillCount}`, note: '当前账号实际安装的个人技能', tone: '' },
          { k: '插件市场', v: `${pluginMarketCount} / ${skillMarketCount}`, note: '公开插件 / 技能实际数量', tone: '' },
          { k: '数据资源', v: `${liveResources.length}`, note: '数据中心实际 Resource 数量', tone: '' },
          { k: '业务应用', v: `${liveApps.length}`, note: '应用注册接口实际数量', tone: '' },
          { k: '待审核', v: `${pendingCount}`, note: pendingCount ? '插件市场待审核提交' : '暂无待审核提交', tone: pendingCount ? 'warn' : 'ok' },
        ],
        blocks: pendingCount ? [{
          type: 'rows',
          title: '待处理事项',
          items: [[`插件审核 ${pendingCount} 项`, '员工提交的插件 / 技能', '插件市场', '待审核']],
        }] : [],
      },
      ai: {
        ...consoleSections.ai,
        kpis: consoleSections.ai.kpis.map((k) => (k.k === '公共能力 / 技能'
          ? { ...k, v: `${capabilityCount} / ${skillCount}`, note: `${capabilityCount} 项公共能力 · 市场 ${pluginMarketCount} 个插件 / ${skillMarketCount} 个技能 · 待审核 ${pendingCount}`, tone: pendingCount ? 'warn' : 'ok' }
          : k)),
      },
      data: {
        ...consoleSections.data,
        kpis: [
          { k: '数据资源', v: `${liveResources.length}`, note: '数据中心实际 Resource 数量', tone: '' },
        ],
        blocks: [],
      },
      apps: {
        ...consoleSections.apps,
        kpis: [
          { k: '业务应用', v: `${liveApps.length}`, note: '应用注册接口实际数量', tone: '' },
        ],
        blocks: [],
      },
      org: { ...consoleSections.org, kpis: [], blocks: [] },
      ops: { ...consoleSections.ops, kpis: [], blocks: [] },
      security: (() => {
        const decisions = latestApprovalDecisions(50)
        const pending = decisions.filter((d) => d.decision === 'pending').length
        const highRisk = decisions.filter((d) => d.risk === 'high').length
        const rejected = decisions.filter((d) => /reject|deny/i.test(d.decision || '')).length
        const passed = decisions.filter((d) => /allowed/i.test(d.decision || '')).length
        const expired = decisions.filter((d) => /expire/i.test(d.decision || '')).length
        return {
          ...consoleSections.security,
          meta: '审批决策来自 SQLite approval_decisions；PTC 嵌套调用只回传工具名与升级原因，摘要会明确标注',
          kpis: [
            { k: '审批决策', v: `${decisions.length}`, note: '最近 50 条真实记录', tone: decisions.length ? 'ok' : '' },
            { k: '待处理', v: `${pending}`, note: pending ? '等待人工决定' : '当前无待处理', tone: pending ? 'warn' : 'ok' },
            { k: '高风险', v: `${highRisk}`, note: '按升级原因判定', tone: highRisk ? 'warn' : 'ok' },
            { k: '已拒绝', v: `${rejected}`, note: '拒绝或策略拦截', tone: rejected ? 'bad' : 'ok' },
            { k: '已通过', v: `${passed}`, note: '人工或策略放行', tone: passed ? 'ok' : '' },
            { k: '已过期', v: `${expired}`, note: '重启或超时未决定', tone: expired ? 'warn' : 'ok' },
          ],
          blocks: [],
        }
      })(),
      service: { ...consoleSections.service, kpis: [], blocks: [] },
      settings: {
        ...consoleSections.settings,
        meta: '基础配置写入全局运行时设置；客户端版本与环境配置只读展示。保存后对新会话生效，已有对话不回溯。',
        writable: canManage(user),
        basic: { ...runtimeSettings },
        version: [
          { label: '产品版本', value: `v${productVersion}`, note: '客户端 package.json' },
          { label: '前端版本', value: `v${frontendVersion}`, note: 'public/index.html 实际加载版本' },
          { label: 'Electron', value: electronVersion, note: '桌面客户端外壳' },
          { label: 'Node.js', value: process.version, note: '本地服务运行时' },
          { label: 'DSH 运行时', value: runtime.dshVersion, note: 'dsh-runtime 实际版本' },
          { label: '服务端口', value: String(port), note: '当前监听端口' },
        ],
        environment: [
          { label: '当前网络', value: currentNetwork.label, note: currentNetwork.note || currentNetwork.desc },
          { label: '可用网络', value: networkOrder.map((id) => networks[id]?.label || id).join(' / '), note: '网络之间独立认证、独立审计' },
          { label: '模型网关', value: gatewayProvider, note: `${gatewayEndpoint} · ${gatewayModel}` },
          { label: 'API Key', value: gatewayKeySaved ? '已保存（服务端托管）' : '未保存', note: '页面不回显密钥' },
          { label: '数据库', value: join(dataDirPath(), 'jg.sqlite'), note: 'SQLite 持久化文件' },
          { label: '运行时快照', value: runtime.dumpPath || runtime.configPath || '—', note: 'DSH 配置快照路径' },
        ],
        networks: networkOrder.map((id) => ({
          id,
          label: networks[id]?.label || id,
          current: id === currentNetwork.id,
          note: networks[id]?.desc || '',
        })),
        kpis: [
          { k: '基础配置', v: canManage(user) ? '3 项可写' : '只读', note: '运行时设置' },
          { k: '产品版本', v: `v${productVersion}`, note: '客户端与前端' },
          { k: '当前环境', v: currentNetwork.label, note: '端口与运行时' },
        ],
        blocks: [],
      },
    }
      json(res, 200, {
        roles: consoleRoles,
        nav: consoleNav,
        modules: consoleModules,
        sections,
        scopes: consoleScopeOptions,
      })
    },
    'GET /api/tickets': (req, res) => {
    const user = roleOf(req)
    json(res, 200, { items: liveTickets, canManage: canManage(user) })
  },
  'POST /api/tickets': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅运维与管理角色可创建工单' })
    const body = JSON.parse(req.__body || '{}')
    const item = {
      id: `W-2026-${100 + liveTickets.length + 1}`, type: body.type || '入职', subject: body.subject || '未填写',
      net: body.net || networks[netOf(req)].label, owner: '未分派', status: '待分派',
      due: '今天 18:00', created: new Date().toLocaleString('zh-CN', { hour12: false }).slice(5, 16).replace('/', '-'),
      history: [{ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5), text: '人工创建工单' }],
    }
    liveTickets.unshift(item)
    logAudit(user, 'ticket.create', item.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item })
  },
  'POST /api/tickets/action': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅运维与管理角色可处置工单' })
    const body = JSON.parse(req.__body || '{}')
    const t = liveTickets.find((x) => x.id === body.id)
    if (!t) return json(res, 404, { error: '工单不存在' })
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
    if (body.action === 'assign') { t.owner = '运维 · 周工'; t.status = '处理中'; t.history.push({ time: now, text: '已分派给运维 · 周工' }) }
    if (body.action === 'done') { t.status = '待复核'; t.history.push({ time: now, text: '处理完成，提交复核（权限已按新岗位重算）' }) }
    if (body.action === 'verify') { t.status = '已闭环'; t.history.push({ time: now, text: '复核通过，工单闭环并留痕' }) }
    logAudit(user, `ticket.${body.action}`, t.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item: t })
  },
  'GET /api/feedback': (req, res) => {
    const user = roleOf(req)
    json(res, 200, { items: liveFeedback, canManage: canManage(user) })
  },
  'POST /api/feedback': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = {
      id: `F-${Date.now().toString().slice(-4)}`, kind: body.kind || '建议', subject: body.subject || '未填写',
      app: body.app || '九规智能中枢 客户端', task: body.task || '', status: '待受理',
      actor: user.name, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5),
    }
    liveFeedback.unshift(item)
    notifications.unshift({ id: `N-${Date.now()}`, kind: 'warn', title: '收到新反馈', body: `${user.name}：${item.subject}`, time: '刚刚', nav: 'admin' })
    logAudit(user, 'feedback.create', item.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item })
  },
  'GET /api/cloud': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const systems = liveCloud.map((s) => {
      let state = 'usable'
      let reason = ''
      if (s.net !== net) { state = 'offnet'; reason = `仅${networks[s.net].label}实例可连` }
      else if (s.status === '维护中') { state = 'down'; reason = '系统维护中，暂不开放新会话' }
      else if (s.level === 'secret' && !(net === 'secret' && user.scopes.includes('secret'))) { state = 'locked'; reason = '当前角色无涉密授权' }
      else if (!user.scopes.includes('all-org') && !s.scopes.some((x) => user.scopes.includes(x))) {
        state = 'locked'
        reason = s.approval === 'dept' ? '需部门负责人审批后开通' : '当前角色无该系统授权'
      }
      const cred = cloudCredentials.find((c) => c.id === s.credId) || {}
      return { ...s, state, reason, credential: { account: cred.account, algo: cred.algo, rotated: cred.rotated, export: cred.export, inject: cred.inject } }
    })
    json(res, 200, {
      systems,
      sessions: cloudLog,
      policy: cloudPolicy,
      instance: {
        network: networks[net].label,
        region: net === 'secret' ? '涉密内网 · 机房 A' : net === 'gov' ? '政务网 · 政务云' : '互联网 · 企业云',
        kernel: 'Chromium 开源内核（容器化，远程画面流）',
        isolation: '一会话一容器，会话结束即销毁',
        ttl: '15 分钟',
      },
      user: { name: user.name, unit: user.unit },
    })
  },

  'GET /api/drive': (req, res, url) => {
    const user = roleOf(req)
    const want = url?.searchParams?.get('space') || 'CL-DEPT'
    const space = liveClouds.find((c) => c.id === want) || liveClouds[0]
    json(res, 200, {
      quota: {
        total: space.total, used: space.used, unit: 'GB', dept: space.name, members: space.members,
        spaceId: space.id, status: space.status, policy: space.note,
        user: user.name,
        scopePolicy: space.note,
      },
      spaces: liveClouds.map((c) => ({ ...c })),
      space: { ...space },
      items: liveDrive.filter((it) => (it.space || 'CL-DEPT') === space.id)
        .map((it) => ({ ...it, typeLabel: typeLabelOf(it), isShared: isSharedItem(it), editable: canEditItem(user, it) })),
      formats: supportedFormats,
      canManage: canManage(user),
    })
  },
  'POST /api/drive/apply': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const name = String(body.name || '').trim()
    if (name.length < 2) return json(res, 400, { error: '请填写专班名称' })
    if (liveClouds.some((c) => c.name === name)) return json(res, 409, { error: '该专班云已存在' })
    liveClouds.push({
      id: 'CL-TEAM-' + (liveClouds.length + 1), name, kind: 'team', title: '专班云',
      status: 'pending', members: 1, total: 512, used: 0, note: '申请已提交，待数据管理员审批',
    })
    logAudit(user, 'drive.apply', name, '申请专班工作云', netOf(req))
    json(res, 200, { ok: true, spaces: liveClouds.map((c) => ({ ...c })) })
  },
  'GET /api/drive/item': (req, res, url) => {
    const user = roleOf(req)
    const item = liveDrive.find((d) => d.id === url.searchParams.get('id'))
    if (!item) return json(res, 404, { error: '文件不存在' })
    const doc = collabOf(item)
    if (!liveComments.has(item.id)) liveComments.set(item.id, [])
    const blocks = blocksOfDoc(item.id, doc)
    json(res, 200, {
      item: { ...item, typeLabel: typeLabelOf(item), isShared: isSharedItem(item), editable: canEditItem(user, item) },
      content: doc,
      canEdit: canEditItem(user, item),
      history: doc.history,
      blocks,
      comments: liveComments.get(item.id),
      rev: revOfDoc(item.id, doc),
      presence: presenceOfDoc(item.id),
      members: liveMembers.map((m) => ({ name: m.name, unit: m.unit, role: m.role })),
    })
  },
  'POST /api/drive/delete': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.id)
    if (!item) return json(res, 404, { error: '文件不存在或已删除' })
    if (!(canManage(user) || canEditItem(user, item))) return json(res, 403, { error: '没有删除该文件的权限' })
    const idx = liveDrive.indexOf(item)
    if (idx >= 0) liveDrive.splice(idx, 1)
    logAudit(user, 'drive.delete', item.name, item.space || 'CL-DEPT', net)
    json(res, 200, { ok: true, id: item.id, name: item.name })
  },
  'POST /api/drive/update': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    if (!canEditItem(user, item)) return json(res, 403, { error: '仅创建者与共享者可在线编辑' })
    const doc = collabOf(item)
    const restore = Number(body.restoreVersion || 0)
    let restored = null
    if (restore) {
      const target = doc.history.find((h) => h.v === restore && h.snapshot)
      if (!target) return json(res, 400, { error: '该版本无快照，无法恢复' })
      restored = target.snapshot
      if (restored.body !== undefined) doc.body = restored.body
      if (restored.table !== undefined) doc.table = restored.table
      if (restored.slides !== undefined) doc.slides = restored.slides
    }
    if (!restore && Number(body.baseRev) && Number(body.baseRev) !== revOfDoc(item.id, doc)) {
      return json(res, 409, {
        error: 'conflict',
        rev: revOfDoc(item.id, doc),
        by: doc.history[0]?.by || '他人',
        time: doc.history[0]?.time || '',
        hint: '他人已保存新版本，你的编辑内容仍在本地，请先对比再保存',
      })
    }
    if (!restore && body.content && typeof body.content === 'object') {
      if (typeof body.content.body === 'string') doc.body = body.content.body
      if (Array.isArray(body.content.table)) doc.table = body.content.table
      if (Array.isArray(body.content.slides)) doc.slides = body.content.slides
    }
    if (body.blockPerms && typeof body.blockPerms === 'object') {
      liveBlockPerms.set(item.id, { ...(liveBlockPerms.get(item.id) || {}), ...body.blockPerms })
    }
    const v = Math.max(...doc.history.map((h) => h.v)) + 1
    const summary = restore ? `恢复至 v${restore}` : (String(body.summary || '').trim() || '在线编辑并保存')
    const snapshot = { body: doc.body, table: doc.table, slides: doc.slides }
    doc.history.unshift({ v, by: user.name, time: stamp(), summary, snapshot })
    item.updated = stamp()
    item.tags = [...new Set([...(item.tags || []), '在线协作'])]
    logAudit(user, 'drive.update', item.id, `allow v${v}`, netOf(req))
    liveRev.set(item.id, v)
    const presence = presenceOfDoc(item.id)
    if (!presence.some((x) => x.name === user.name)) presence.push({ name: user.name, at: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5), para: '—', state: '刚刚保存' })
    json(res, 200, { ok: true, item: { ...item, typeLabel: typeLabelOf(item), isShared: isSharedItem(item) }, content: doc, history: doc.history, version: v, rev: v, blocks: blocksOfDoc(item.id, doc) })
  },
  'POST /api/drive/comment': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    if (!canEditItem(user, item)) return json(res, 403, { error: '仅共享者可评论' })
    const doc = collabOf(item)
    const blockId = String(body.blockId || '')
    const text = String(body.text || '').trim()
    if (!text) return json(res, 400, { error: '评论内容不能为空' })
    if (!liveComments.has(item.id)) liveComments.set(item.id, [])
    const cm = {
      id: `CM-${String(Date.now()).slice(-6)}`,
      blockId: blockId || blocksOfDoc(item.id, doc)[0]?.id || 'b1',
      author: user.name,
      at: stamp(),
      text,
      mentions: Array.isArray(body.mentions) ? body.mentions : [],
      resolved: false,
    }
    liveComments.get(item.id).unshift(cm)
    logAudit(user, 'drive.comment', `${item.id}/${cm.blockId}`, 'allow', netOf(req))
    json(res, 200, { ok: true, comment: cm, comments: liveComments.get(item.id) })
  },
  'POST /api/drive/comment-resolve': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    const list = liveComments.get(item.id) || []
    const cm = list.find((x) => x.id === body.commentId)
    if (!cm) return json(res, 404, { error: '评论不存在' })
    cm.resolved = !!body.resolved
    json(res, 200, { ok: true, comments: list })
  },
  'POST /api/drive/block-perm': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    if (item.owner !== user.name) return json(res, 403, { error: '仅创建者可设置段落权限' })
    const blockId = String(body.blockId || '')
    const perm = ['edit', 'comment', 'read'].includes(body.perm) ? body.perm : 'edit'
    liveBlockPerms.set(item.id, { ...(liveBlockPerms.get(item.id) || {}), [blockId]: perm })
    logAudit(user, 'drive.blockperm', `${item.id}/${blockId}`, `set ${perm}`, netOf(req))
    const doc = collabOf(item)
    json(res, 200, { ok: true, blocks: blocksOfDoc(item.id, doc) })
  },
  'GET /api/drive/presence': (req, res, url) => {
    const id = url.searchParams.get('id')
    const item = liveDrive.find((d) => d.id === id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    const doc = collabOf(item)
    json(res, 200, { rev: revOfDoc(id, doc), presence: presenceOfDoc(id), comments: (liveComments.get(id) || []).length, updated: item.updated })
  },
  'GET /api/drive/diff': (req, res, url) => {
    const id = url.searchParams.get('id')
    const item = liveDrive.find((d) => d.id === id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    const doc = collabOf(item)
    const from = Number(url.searchParams.get('from') || 0)
    const to = Number(url.searchParams.get('to') || 0)
    const fh = doc.history.find((h) => h.v === from)
    const th = doc.history.find((h) => h.v === to)
    if (!fh || !th) return json(res, 404, { error: '版本不存在' })
    const a = linesOfContent(fh.snapshot || {})
    const b = linesOfContent(th.snapshot || {})
    const rows = diffLines(a, b)
    json(res, 200, { from, to, rows, added: rows.filter((r) => r.type === 'add').length, removed: rows.filter((r) => r.type === 'del').length })
  },
  'GET /api/notices': (req, res) => {
    json(res, 200, {
      items: liveNotices,
      unread: liveNotices.filter((n) => n.unread).length,
      categories: ['全部', '通知', '公告', '文章'],
      canPublish: canManage(roleOf(req)),
    })
  },
  'POST /api/notices/read': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    liveNotices.forEach((n) => { if (body.id === 'all' || n.id === body.id) n.unread = false })
    json(res, 200, { ok: true })
  },
  'POST /api/notices/publish': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '通知公告由部门负责人及以上发布' })
    const body = JSON.parse(req.__body || '{}')
    const title = String(body.title || '').trim()
    const text = String(body.body || '').trim()
    if (!title || !text) return json(res, 400, { error: '标题与正文不能为空' })
    const id = `NT-${String(Date.now()).slice(-4)}`
    const item = {
      id, title, category: body.category || '通知', dept: user.unit, author: user.name,
      time: stamp(), unread: true, pinned: !!body.pinned,
      summary: text.split('\n')[0].slice(0, 80), body: text.split('\n'),
    }
    liveNotices.unshift(item)
    logAudit(user, 'notices.publish', id, 'allow', netOf(req))
    json(res, 200, { ok: true, item })
  },
  'POST /api/drive/share': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.id)
    if (!item) return json(res, 404, { error: '文件不存在' })
    const to = String(body.to || '').trim()
    if (!to) return json(res, 400, { error: '请选择共享对象' })
    if (!item.shared.includes(to)) item.shared.push(to)
    item.scope = '项目内共享'
    const doc = collabOf(item)
    if (item.type !== 'pdf') {
      const v = Math.max(0, ...doc.history.map((h) => h.v)) + 1
      doc.history.unshift({ v, by: user.name, time: stamp(), summary: `共享给 ${to}，开启在线协作` })
    }
    logAudit(user, 'drive.share', item.id, `allow→${to}`, netOf(req))
    json(res, 200, { ok: true, item: { ...item, typeLabel: typeLabelOf(item), isShared: isSharedItem(item) } })
  },
  'GET /api/contacts': (req, res, url) => {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const list = contacts.filter((c) => (q ? `${c.name}${c.duty}${c.dept}${c.mail}`.toLowerCase().includes(q) : true))
    const depts = [...new Set(contacts.map((c) => c.dept))]
    json(res, 200, { items: list, depts, total: contacts.length })
  },
  'GET /api/im': (req, res) => json(res, 200, { items: liveIm }),
  'GET /api/im/files': (req, res) => {
    const items = []
    liveIm.forEach((t) => t.messages.forEach((m, i) => {
      if (!m.file) return
      const drive = liveDrive.find((d) => d.id === m.file.itemId)
      items.push({
        threadId: t.id, threadName: t.name, msgIndex: i, from: m.from, time: m.time,
        name: m.file.name, type: m.file.type, size: m.file.size, itemId: m.file.itemId,
        online: Boolean(drive?.online || m.file.online), owner: drive?.owner || '',
      })
    }))
    json(res, 200, { items })
  },
  'GET /api/im/search': (req, res, url) => {
    const q = String(url.searchParams.get('q') || '').trim()
    if (!q) return json(res, 200, { items: [], q })
    const items = []
    liveIm.forEach((t) => t.messages.forEach((m, i) => {
      const hitText = String(m.text || '').includes(q)
      const hitFile = Boolean(m.file && String(m.file.name || '').includes(q))
      if (!hitText && !hitFile) return
      items.push({ threadId: t.id, threadName: t.name, msgIndex: i, from: m.from, time: m.time, text: m.text || '', file: m.file || null })
    }))
    json(res, 200, { items, q })
  },
  'POST /api/im/attach': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const thread = liveIm.find((t) => t.id === body.id)
    const item = liveDrive.find((d) => d.id === body.itemId)
    if (!thread) return json(res, 404, { error: '会话不存在' })
    if (!item) return json(res, 404, { error: '文件不存在' })
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
    thread.messages.push({
      from: user.name, time,
      text: String(body.text || '').trim() || `发送了文件：${item.name}`,
      file: { itemId: item.id, name: item.name, type: item.type, size: item.size, online: Boolean(item.online) },
    })
    thread.time = time
    logAudit(user, 'im.attach', item.id, 'allow', net)
    json(res, 200, { ok: true, thread })
  }, 
  'POST /api/im/ai': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const thread = liveIm.find((t) => t.id === body.id)
    if (!thread) return json(res, 404, { error: '会话不存在' })
    const wanted = Array.isArray(body.files) ? body.files.map(String) : []
    const pool = thread.messages.filter((m) => m.file).map((m) => m.file)
    const picked = wanted.length ? pool.filter((f) => wanted.includes(f.name)) : pool.slice(-3)
    if (!picked.length) return json(res, 400, { error: '本会话还没有可分析的文件，先从「＋」发一份文件' })
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)
    const names = picked.map((f) => f.name)
    const question = String(body.question || '').trim()
    thread.messages.push({
      from: user.name, time,
      text: `请智能助手分析：${names.join('、')}${question ? '\n' + question : ''}`,
    })
    thread.messages.push({ from: '智能助手', text: buildImAnalysis(picked, user.name), ai: true, time })
    thread.unread = 0
    thread.time = time
    logAudit(user, 'im.ai', thread.id, `分析 ${names.length} 份文档`, netOf(req))
    json(res, 200, { ok: true, item: thread })
  },
  'POST /api/im/send': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const thread = liveIm.find((t) => t.id === body.id)
    const text = String(body.text || '').trim()
    if (!thread) return json(res, 404, { error: '会话不存在' })
    if (!text) return json(res, 400, { error: '消息不能为空' })
    const msg = { from: user.name, text, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5) }
    if (body.file && body.file.itemId) {
      msg.file = {
        itemId: String(body.file.itemId),
        name: String(body.file.name || ''),
        type: String(body.file.type || 'docx'),
        size: String(body.file.size || ''),
        online: Boolean(body.file.online),
      }
    }
    thread.messages.push(msg)
    thread.unread = 0
    thread.time = msg.time
    if (/@智能助手/.test(text) || body.ai) {
      const docs = thread.messages.filter((m) => m.file).map((m) => m.file).slice(-5)
      const aiText = buildImAnalysis(docs, user.name)
      thread.messages.push({ from: '智能助手', text: aiText, ai: true, time: msg.time })
      logAudit(user, 'im.ai', thread.id, '调用系统 AI 分析会话文档', netOf(req))
    }
    logAudit(user, 'im.send', thread.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item: thread, message: msg })
  },
  'POST /api/im/member': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const thread = liveIm.find((t) => t.id === body.id)
    if (!thread) return json(res, 404, { error: '会话不存在' })
    if (thread.kind !== 'group') return json(res, 400, { error: '单聊没有成员管理' })
    if (thread.autoMembers) {
      return json(res, 403, { error: `${thread.dept} 部门工作群的成员由人事资料自动匹配，需在人事系统调整任职关系` })
    }
    thread.roster = thread.roster || []
    if (body.action === 'add') {
      const c = contacts.find((x) => x.id === body.contactId) || { name: String(body.name || ''), duty: '', dept: '' }
      if (!c.name) return json(res, 400, { error: '请选择要加入的成员' })
      if (thread.roster.some((r) => r.name === c.name)) return json(res, 409, { error: `${c.name} 已在群内` })
      thread.roster.push({ name: c.name, duty: c.duty || '', dept: c.dept || '', source: 'manual' })
      thread.members = thread.roster.length
      logAudit(user, 'im.member.add', thread.id, `${c.name} 加入群聊`, netOf(req))
      return json(res, 200, { ok: true, item: thread })
    }
    if (body.action === 'remove') {
      const name = String(body.name || '')
      if (name === thread.owner) return json(res, 400, { error: '群主不能被移出，需先转让群主' })
      thread.roster = thread.roster.filter((r) => r.name !== name)
      thread.members = thread.roster.length
      logAudit(user, 'im.member.remove', thread.id, `${name} 移出群聊`, netOf(req))
      return json(res, 200, { ok: true, item: thread })
    }
    json(res, 400, { error: '未知操作' })
  },
  'POST /api/im/online': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveDrive.find((d) => d.id === body.itemId)
    if (!item) return json(res, 404, { error: '附件对应的文件不存在或已归档' })
    if (item.type === 'pdf' || item.type === 'atlas' || item.type === 'gdb' || item.type === 'dwg') {
      return json(res, 400, { error: '该类型不支持在线协同编辑，可转为在线文档的只有文档、表格与演示' })
    }
    const before = [...(item.shared || [])]
    const thread = liveIm.find((t) => t.id === body.threadId)
    const targetSpace = String(body.space || thread?.space || 'CL-DEPT')
    item.space = targetSpace
    item.shared = targetSpace === 'CL-PERSONAL' ? ['本人'] : ['all-org']
    item.online = true
    liveIm.forEach((t) => t.messages.forEach((m) => {
      if (m.file && m.file.itemId === item.id) m.file.online = true
    }))
    const doc = collabOf(item)
    if (!doc.history.some((h) => h.summary === '由聊天附件转为在线文档')) {
      doc.history.unshift({
        v: doc.history.length + 1,
        by: user.name,
        time: stamp(),
        summary: '由聊天附件转为在线文档',
        snapshot: { body: doc.body, table: doc.table, slides: doc.slides },
      })
    }
    logAudit(user, 'im.doc.online', item.id, 'allow', net)
    json(res, 200, { ok: true, item: { id: item.id, name: item.name, type: item.type, shared: item.shared, online: true, space: targetSpace, before } })
  },
  'POST /api/docs/create': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const format = String(body.format || '')
    if (!supportedFormats.includes(format)) return json(res, 400, { error: `不支持的格式：${format}` })
    const title = String(body.title || '').trim() || '未命名文档'
    const doc = buildDocument({
      format,
      title,
      body: body.body || '本文件由 九规智能中枢 企业版中枢按当前网络与授权数据生成。',
      table: body.table,
      slides: body.slides,
    })
    const id = `DOC-${Date.now().toString().slice(-6)}`
    const filename = `${title.replace(/[\\/:*?"<>|]/g, '_')}.${doc.ext}`
    const stored = putFile({
      id,
      name: filename,
      mime: doc.mime,
      buffer: doc.buffer,
      owner: user.name,
      net,
      note: 'AI 生成文档',
    })
    generatedDocs.set(id, { filename, mime: doc.mime, size: stored.size, fileId: stored.id })
    const item = {
      id, name: title, type: format, size: `${(stored.size / 1024).toFixed(0)} KB`, owner: user.name,
      dept: user.unit, updated: stamp(),
      shared: [], scope: '仅本人', tags: ['AI 生成'], url: `/api/docs/download?id=${id}`,
    }
    liveDrive.unshift(item)
    collabDocs.set(id, {
      kind: format === 'xlsx' ? 'sheet' : format === 'pptx' ? 'slide' : 'doc',
      body: body.body || '',
      table: Array.isArray(body.table) ? body.table : undefined,
      slides: Array.isArray(body.slides) ? body.slides : undefined,
      history: [{ v: 1, by: user.name, time: item.updated, summary: 'AI 生成' }],
    })
    logAudit(user, 'docs.create', `${filename}`, 'allow', net)
    json(res, 200, { ok: true, item, filename, url: item.url, bytes: doc.buffer.length, format })
  },
  'GET /api/docs/download': (req, res, url) => {
    const id = url.searchParams.get('id')
    const doc = generatedDocs.get(id) || getFile(id)
    const fileId = doc && (doc.fileId || doc.id || id)
    const buffer = fileId ? readFileBuffer(fileId) : null
    if (!doc || !buffer) return json(res, 404, { error: '文档不存在或已失效' })
    const filename = doc.filename || doc.name || 'document'
    res.writeHead(200, {
      'content-type': doc.mime || 'application/octet-stream',
      'content-length': buffer.length,
      'content-disposition': `attachment; filename="doc.${filename.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    })
    res.end(buffer)
  },
  'GET /api/formats/capabilities': (req, res) => {
    json(res, 200, {
      items: FORMAT_REGISTRY,
      note: '平台级数据格式基座：数据中心、智能笔记本、Agent 与 MCP 共用；不隶属于某个业务模块。',
    })
  },
  'POST /api/formats/inspect': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const inputFiles = Array.isArray(body.files) ? body.files.filter((item) => item?.id) : []
    const fileId = String(body.fileId || '')
    if (!fileId && !inputFiles.length) return json(res, 400, { error: '缺少数据文件' })
    try {
      if (inputFiles.length) {
        const packed = []
        for (const item of inputFiles) {
          packed.push({ path: String(item.path || item.name || 'data.bin'), buffer: readFileBuffer(String(item.id)) })
        }
        const result = await inspectGeoFiles(packed, String(body.name || '空间数据'))
        logAudit(user, 'format.inspect', `folder:${inputFiles.length}`, `${result.kind}:${result.features}`, netOf(req))
        return json(res, 200, { ok: true, format: 'gis', ...result })
      }
      const buffer = readFileBuffer(fileId)
      const format = detectDataFormat(String(body.name || ''), String(body.mime || ''), buffer)
      const result = await inspectDataFormat(buffer, String(body.name || '数据文件'), String(body.mime || ''))
      logAudit(user, 'format.inspect', `${fileId}:${format}`, `${result.kind || format}:${result.pageCount || result.features || 0}`, netOf(req))
      return json(res, 200, { ok: true, format, formatLabel: result.formatLabel, ...result })
    } catch (error) {
      return json(res, Number(error?.status) || 422, { error: '数据格式解析失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/formats/extract': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const fileId = String(body.fileId || '')
    if (!fileId) return json(res, 400, { error: '缺少数据文件' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 404, { error: '文件不存在或已过期' }) }
    try {
      const result = await extractDataFormat(buffer, String(body.name || ''), String(body.mime || ''))
      logAudit(user, 'format.extract', `${fileId}:${result.format}`, result.text ? `chars:${result.text.length}` : `features:${result.features || 0}`, netOf(req))
      return json(res, 200, { ok: true, ...result })
    } catch (error) {
      return json(res, Number(error?.status) || 422, { error: '数据内容提取失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/formats/export': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const format = String(body.format || '')
    const op = String(body.op || '')
    const name = String(body.name || '数据')
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(String).filter(Boolean) : []
    const fileId = String(body.fileId || '')
    const inputFiles = Array.isArray(body.files) ? body.files.filter((item) => item?.id) : []
    const target = String(body.target || '')
    if (!format || !op) return json(res, 400, { error: '缺少输出格式或操作' })
    let buffer = null
    let buffers = []
    let files = []
    try {
      if (inputFiles.length) {
        files = inputFiles.map((item) => ({ path: String(item.path || item.name || 'data.bin'), buffer: readFileBuffer(String(item.id)) }))
      } else if (format === 'pdf' && op === 'merge') {
        if (fileIds.length < 2) return json(res, 400, { error: '合并至少需要两个 PDF 文件' })
        for (const id of fileIds) buffers.push(readFileBuffer(id))
      } else {
        if (!fileId) return json(res, 400, { error: '缺少数据文件' })
        buffer = readFileBuffer(fileId)
      }
    } catch {
      return json(res, 400, { error: '文件不存在或已过期' })
    }
    try {
      const { outputs } = await exportDataFormat({ format, op, buffer, buffers, files, ranges: body.ranges, name, target })
      const filesOut = []
      for (const [index, output] of outputs.entries()) {
        const id = `FMT-${Date.now().toString().slice(-8)}-${index + 1}`
        const mime = output.mime || (output.format === 'pdf' ? 'application/pdf' : output.format === 'gis' ? 'application/geo+json' : 'application/dxf')
        const stored = putFile({ id, name: output.name, mime, buffer: output.buffer, owner: user.name, net, note: `format.export:${format}/${op}` })
        filesOut.push({ id: stored.id, name: output.name, size: stored.size, mime, label: output.label || '', url: `/api/files/download?id=${stored.id}` })
      }
      logAudit(user, 'format.export', `${format}/${op}`, `${fileIds.length || inputFiles.length || 1} in -> ${filesOut.length} out`, net)
      return json(res, 200, { ok: true, format, op, target, files: filesOut })
    } catch (error) {
      return json(res, Number(error?.status) || 422, { error: '数据格式输出失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/geo/inspect': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const fileId = String(body.fileId || '')
    if (!fileId) return json(res, 400, { error: '缺少 GIS/CAD 文件' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 400, { error: '文件不存在或已过期' }) }
    try {
      const result = inspectSpatial(buffer, String(body.name || 'spatial.json'))
      logAudit(user, 'geo.inspect', fileId, `${result.kind}:${result.features}`, netOf(req))
      return json(res, 200, { ok: true, ...result })
    } catch (error) {
      return json(res, 422, { error: 'GIS/CAD 解析失败', detail: String(error?.message || error) })
    }
  },
  'GET /api/pdf/view': (req, res, url) => {
    const fileId = String(url.searchParams.get('fileId') || '')
    if (!fileId) return json(res, 400, { error: '缺少 PDF 文件' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 404, { error: 'PDF 文件不存在或已过期' }) }
    if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') return json(res, 400, { error: '不是有效的 PDF 文件' })
    res.writeHead(200, {
      'content-type': 'application/pdf',
      'content-length': buffer.length,
      'content-disposition': 'inline; filename="preview.pdf"',
      'cache-control': 'no-store',
    })
    res.end(buffer)
  },
  'POST /api/pdf/inspect': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const fileId = String(body.fileId || '')
    if (!fileId) return json(res, 400, { error: '缺少 PDF 文件' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 400, { error: 'PDF 文件不存在或已过期' }) }
    if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') return json(res, 400, { error: '不是有效的 PDF 文件（缺少 %PDF- 文件头）' })
    try {
      const info = await inspectPdf(buffer)
      logAudit(user, 'pdf.inspect', fileId, 'allow', netOf(req))
      return json(res, 200, { ok: true, ...info })
    } catch (error) {
      return json(res, 422, { error: 'PDF 解析失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/pdf/extract': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const fileId = String(body.fileId || '')
    if (!fileId) return json(res, 400, { error: '缺少 PDF 文件' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 400, { error: 'PDF 文件不存在或已过期' }) }
    if (!buffer || buffer.subarray(0, 5).toString() !== '%PDF-') return json(res, 400, { error: '不是有效的 PDF 文件' })
    try {
      const result = extractPdfText(buffer)
      logAudit(user, 'pdf.extract', fileId, `chars:${result.text.length}`, netOf(req))
      return json(res, 200, { ok: true, ...result })
    } catch (error) {
      return json(res, 422, { error: 'PDF 文本提取失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/pdf/merge': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(String).filter(Boolean) : []
    if (fileIds.length < 2) return json(res, 400, { error: '合并至少需要两个 PDF 文件' })
    const buffers = []
    for (const id of fileIds) {
      try { buffers.push(readFileBuffer(id)) } catch { return json(res, 400, { error: `PDF 文件不存在或已过期：${id}` }) }
    }
    try {
      const output = await mergePdfs(buffers)
      const filename = `${String(body.name || '合并文档').replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '')}-合并.pdf`
      const id = `PDF-${Date.now().toString().slice(-8)}`
      const stored = putFile({ id, name: filename, mime: 'application/pdf', buffer: output, owner: user.name, net, note: 'PDF 合并' })
      logAudit(user, 'pdf.merge', `${fileIds.length} files -> ${filename}`, `allow(${output.length})`, net)
      return json(res, 200, { ok: true, file: { id: stored.id, name: filename, size: stored.size, url: `/api/files/download?id=${stored.id}` }, pages: (await inspectPdf(output)).pageCount })
    } catch (error) {
      return json(res, 422, { error: 'PDF 合并失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/pdf/split': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const fileId = String(body.fileId || '')
    if (!fileId) return json(res, 400, { error: '缺少 PDF 文件' })
    let buffer
    try { buffer = readFileBuffer(fileId) } catch { return json(res, 400, { error: 'PDF 文件不存在或已过期' }) }
    try {
      const outputs = await splitPdf(buffer, body.ranges)
      const base = String(body.name || '拆分文档').replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '')
      const files = []
      for (const item of outputs) {
        const filename = `${base}-${item.label}.pdf`
        const id = `PDF-${Date.now().toString().slice(-8)}-${files.length + 1}`
        const stored = putFile({ id, name: filename, mime: 'application/pdf', buffer: item.buffer, owner: user.name, net, note: 'PDF 拆分' })
        files.push({ id: stored.id, name: filename, size: stored.size, pages: item.label, url: `/api/files/download?id=${stored.id}` })
      }
      logAudit(user, 'pdf.split', `${fileId} -> ${files.length} files`, 'allow', net)
      return json(res, 200, { ok: true, files })
    } catch (error) {
      return json(res, 422, { error: 'PDF 拆分失败', detail: String(error?.message || error) })
    }
  },
  'POST /api/files/upload': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const buffer = req.__buffer
    if (!buffer || !buffer.length) return json(res, 400, { error: '上传内容为空；请以二进制请求体直接上传文件' })
    if (buffer.length > UPLOAD_LIMIT_BYTES) return json(res, 413, { error: `单个文件不能超过 ${Math.round(UPLOAD_LIMIT_BYTES / 1024 / 1024)} MB` })
    const kind = String(url.searchParams.get('kind') || 'chat').slice(0, 20)
    if (user.id === 'guest' && kind !== 'chat') return json(res, 403, { error: '外部访客不能上传企业资源或插件包' })
    let name = ''
    try { name = decodeURIComponent(String(url.searchParams.get('name') || '')) } catch { name = '' }
    name = name.trim() || `上传文件-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '')}.bin`
    const id = newFileId(kind === 'resource' ? 'RF' : kind === 'plugin' ? 'PKG' : 'ATT')
    const mime = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0] || 'application/octet-stream'
    try {
      const meta = putFile({
        id, name, mime, buffer, owner: user.name, net,
        note: `upload:${kind}`,
      })
      logAudit(user, `file.upload.${kind}`, `${id}:${name}`, `allow(${meta.size})`, net)
      return json(res, 200, {
        ok: true,
        file: { id: meta.id, name: meta.name, size: meta.size, sha256: meta.sha256, version: meta.version, mime: meta.mime },
      })
    } catch (error) {
      return json(res, 500, { error: `文件写入失败：${error?.message || error}` })
    }
  },
  'POST /api/images/generate': async (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const status = imageGenerationStatus(user, net)
    if (!status.enabled) return json(res, 403, { error: status.reason, code: 'IMAGE_DISABLED' })
    const body = JSON.parse(req.__body || '{}')
    const prompt = String(body.prompt || '').trim()
    if (!prompt) return json(res, 400, { error: '请先描述要生成的图像', code: 'IMAGE_PROMPT_REQUIRED' })
    if (prompt.length > 1200) return json(res, 400, { error: '提示词不能超过 1200 个字符', code: 'IMAGE_PROMPT_TOO_LONG' })
    const style = String(body.style || '写实').slice(0, 20)
    const ratio = IMAGE_RATIOS[String(body.ratio || '')] ? String(body.ratio) : '1:1'
    const [width, height] = IMAGE_RATIOS[ratio]
    const seed = Number.isInteger(Number(body.seed)) && Number(body.seed) > 0 ? Number(body.seed) : Math.floor(Math.random() * 2_147_483_647)
    const styleHint = IMAGE_STYLE_PROMPTS[style] || ''
    const cleanPrompt = normalizeImagePrompt(prompt)
    const translatedPrompt = await translateImagePrompt(user, cleanPrompt)
    const promptForService = translatedPrompt || cleanPrompt
    const fullPrompt = styleHint ? `${promptForService}, ${styleHint}` : promptForService
    const endpoint = IMAGE_GENERATION.endpoint.replace(/\/$/, '')
    const remote = new URL(`${endpoint}/${encodeURIComponent(fullPrompt)}`)
    remote.searchParams.set('width', String(width))
    remote.searchParams.set('height', String(height))
    remote.searchParams.set('model', IMAGE_GENERATION.model)
    remote.searchParams.set('seed', String(seed))
    remote.searchParams.set('nologo', 'true')
    remote.searchParams.set('safe', 'true')
    remote.searchParams.set('enhance', 'true')
    try {
      const response = await fetch(remote, { signal: AbortSignal.timeout(IMAGE_GENERATION.timeoutMs), redirect: 'follow' })
      if (!response.ok) throw new Error(`外部生图服务返回 HTTP ${response.status}`)
      const mime = String(response.headers.get('content-type') || '').split(';')[0].trim()
      if (!mime.startsWith('image/')) throw new Error(`外部生图服务返回了非图片内容：${mime || '未知类型'}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < 8 * 1024) throw new Error('外部生图服务返回的图片过小，可能生成失败')
      if (buffer.length > 24 * 1024 * 1024) throw new Error('外部生图服务返回的图片超过 24 MB')
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
      const id = newFileId('IMG')
      const name = `AI-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '')}-${seed}.${ext}`
      const meta = putFile({
        id, name, mime, buffer, owner: user.name, net,
        note: `imagegen:${IMAGE_GENERATION.provider}/${IMAGE_GENERATION.model};ratio=${ratio};style=${style};seed=${seed}`,
      })
      logAudit(user, 'image.generate', `${id}:${ratio}:${seed}`, `allow(${meta.size})`, net)
      return json(res, 200, {
        ok: true,
        image: {
          id: meta.id,
          name: meta.name,
          mime: meta.mime,
          size: meta.size,
          width,
          height,
          ratio,
          style,
          seed,
          prompt,
          provider: IMAGE_GENERATION.provider,
          model: IMAGE_GENERATION.model,
          url: `/api/images/file?id=${encodeURIComponent(meta.id)}`,
        },
      })
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      const message = timedOut ? '外部生图服务超时，请稍后重试' : String(error?.message || error)
      logAudit(user, 'image.generate', `${ratio}:${seed}`, 'deny', net)
      return json(res, 502, { ok: false, error: `真实生图失败：${message}`, code: 'IMAGE_PROVIDER_ERROR' })
    }
  },
  'GET /api/images/file': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const id = url.searchParams.get('id')
    if (!fileVisibleToUser(user, net, id)) return json(res, 403, { error: '该图像不在当前用户的授权范围内' })
    const meta = getFile(id)
    const buffer = readFileBuffer(id)
    if (!meta || !buffer) return json(res, 404, { error: '图像不存在或已失效' })
    res.writeHead(200, {
      'content-type': meta.mime || 'image/jpeg',
      'content-length': buffer.length,
      'content-disposition': `inline; filename="${encodeURIComponent(meta.name || 'image.jpg')}"`,
      'cache-control': 'private, max-age=3600',
    })
    res.end(buffer)
  },
  'GET /api/harness/file': (req, res, url) => {
    const user = roleOf(req)
    const requested = String(url.searchParams.get('path') || '')
    if (!requested) return json(res, 400, { error: '缺少文件路径' })
    const workspace = join(dataDirPath(), 'dsh-workspace')
    const full = normalize(requested)
    if (!existsSync(full)) return json(res, 404, { error: '交付文件不存在或已被移动' })
    const roots = [workspace]
    for (const project of liveProjects) {
      if (project.removed || !project.cwd || !projectVisibleTo(user, project)) continue
      roots.push(project.cwd)
    }
    let realFull
    try { realFull = realpathSync(full) } catch { return json(res, 404, { error: '交付文件不存在或已被移动' }) }
    const allowed = roots.some((rootDir) => {
      try { return pathInside(realFull, realpathSync(rootDir)) } catch { return false }
    })
    if (!allowed) return json(res, 403, { error: '该文件不在当前用户授权的工作区或项目目录内' })
    if (!existsSync(realFull)) return json(res, 404, { error: '交付文件不存在或已被移动' })
    let buffer
    try { buffer = readFileSync(realFull) } catch (error) { return json(res, 400, { error: `交付文件读取失败：${error?.message || error}` }) }
    const ext = extname(realFull).toLowerCase()
    const types = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
      '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
      '.json': 'application/json; charset=utf-8', '.zip': 'application/zip',
    }
    res.writeHead(200, {
      'content-type': types[ext] || 'application/octet-stream',
      'content-length': buffer.length,
      'content-disposition': contentDisposition(full.split(/[\\/]/).pop() || 'deliverable'),
      'cache-control': 'no-store',
    })
    logAudit(user, 'harness.file.open', full, 'allow', netOf(req))
    res.end(buffer)
  },
  'GET /api/files/download': (req, res, url) => {
    const user = roleOf(req)
    const net = netOf(req)
    const id = url.searchParams.get('id')
    if (!fileVisibleToUser(user, net, id)) return json(res, 403, { error: '该文件不在当前用户的授权范围内' })
    const meta = getFile(id)
    const buffer = readFileBuffer(id)
    if (!meta || !buffer) return json(res, 404, { error: '文件不存在或已失效' })
    res.writeHead(200, {
      'content-type': meta.mime || 'application/octet-stream',
      'content-length': buffer.length,
      'content-disposition': contentDisposition(meta.name),
      'cache-control': 'no-store',
    })
    res.end(buffer)
  },
  'POST /api/cloud/open': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const s = liveCloud.find((x) => x.id === body.systemId)
    if (!s) return json(res, 404, { error: '系统不存在' })
    let deny = ''
    if (s.net !== net) deny = `仅${networks[s.net].label}实例可连，当前为${networks[net].label}`
    else if (s.status === '维护中') deny = '系统维护中，暂不开放新会话'
    else if (s.level === 'secret' && !(net === 'secret' && user.scopes.includes('secret'))) deny = '当前角色无涉密授权'
    else if (!user.scopes.includes('all-org') && !s.scopes.some((x) => user.scopes.includes(x))) {
      deny = s.approval === 'dept' ? '需部门负责人审批后开通该政务系统' : '当前角色无该系统授权'
    }
    if (deny) {
      logAudit(user, 'cloud.open', s.id, 'deny', netOf(req))
      return json(res, 403, { error: deny, detail: { system: s.name, network: networks[s.net].label, approval: s.approval } })
    }
    const id = `CS-${Date.now().toString().slice(-6)}`
    const session = {
      id, systemId: s.id, user: user.name, started: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5),
      ttl: '剩余 15:00', state: 'active',
      watermark: `${user.name} · ${user.unit} · ${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`,
      record: `REC-${id.slice(-6)}`, ops: 0, note: '新会话，凭据已在服务端注入',
    }
    cloudLog.unshift(session)
    logAudit(user, 'cloud.open', s.id, 'allow', netOf(req))
    json(res, 200, {
      session,
      ticket: { token: `st-${Math.random().toString(36).slice(2, 10)}`, ttlSec: 900, boundTo: `${user.name}|${s.id}|${net}` },
      notice: '凭据仅在服务端注入，不回传客户端；会话结束容器即销毁。',
    })
  },
  'POST /api/cloud/close': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const s = cloudLog.find((x) => x.id === body.id)
    if (!s) return json(res, 404, { error: '会话不存在' })
    s.state = 'closed'
    s.ttl = '已结束'
    s.note = `会话由${user.name}主动结束，录屏已归档`
    logAudit(user, 'cloud.close', s.id, 'allow', netOf(req))
    json(res, 200, { ok: true, session: s })
  },
  'GET /api/monitor': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理角色可查看运维监控' })
    taskTick()
    json(res, 200, { ...monitor, tasks: liveTasks.filter((t) => t.state === 'failed').length })
  },
  'GET /api/knowledge': (req, res, url) => {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const items = knowledgeDocs.filter((d) => (q ? `${d.title}${d.summary}${d.dept}`.toLowerCase().includes(q) : true))
    json(res, 200, { items, total: knowledgeDocs.length, indexed: knowledgeDocs.filter((d) => d.indexed).length })
  },
  'GET /api/notifications': (req, res) => {
    const user = roleOf(req)
    const rs = readNotifications.get(user.name) || new Set()
    const items = notifications.map((n) => ({ ...n, unread: !rs.has(n.id) && n.unread !== false }))
    json(res, 200, { items, unread: items.filter((n) => n.unread).length })
  },
  'POST /api/notifications/read': (req, res) => {
    const user = roleOf(req)
    if (!readNotifications.has(user.name)) readNotifications.set(user.name, new Set())
    const rs = readNotifications.get(user.name)
    const body = JSON.parse(req.__body || '{}')
    if (body.id === 'all') notifications.forEach((n) => rs.add(n.id))
    else if (body.id) rs.add(body.id)
    json(res, 200, { ok: true })
  },
  'GET /api/notebooks': (req, res) => {
    const user = roleOf(req)
    const sharedRanked = sharedNotebooksByVotes()
    const featuredIds = notebookFeaturedIds()
    const rankOf = new Map(sharedRanked.map((n, i) => [n.id, i + 1]))
    const list = LIVE_NOTEBOOKS.map((n) => {
      const mine = n.owner === user.name
      const votes = Number(n.votes || 0)
      return {
        id: n.id, title: n.title, topic: n.topic, owner: n.owner, desc: n.desc, updated: n.updated,
        sourceCount: n.sources.length, noteCount: n.notes.length,
        displaySources: Math.min(NOTEBOOK_MAX_SOURCES, Number(n.sourceCountHint || 0) || n.sources.length),
        coverTone: n.coverTone || 0, coverIcon: n.coverIcon || 'doc',
        shared: !!n.shared, recommended: !!n.recommended, votes,
        pinned: !!n.pinned, collections: [...(n.collections || [])],
        sharedBy: n.sharedBy || n.owner,
        featuredRank: rankOf.get(n.id) || 0,
        featured: featuredIds.has(n.id),
        sync: n.sources.filter((x) => !x.kind && x.versionMode === 'follow' && x.resolvedVersionId !== latestVersionOf(x.resourceId)).length,
        mine,
      }
    })
    json(res, 200, {
      items: list,
      topics: notebookTopics,
      collections: NOTEBOOK_COLLECTIONS,
      sharedCount: sharedRanked.length,
      limits: { maxSources: NOTEBOOK_MAX_SOURCES, quotaBytes: NOTEBOOK_QUOTA_BYTES, usedBytes: notebookUsageBytes(user.name) },
      owner: user.name,
      principle: '笔记本只保存对数据中心 Resource 的引用，不复制文件、不改来源；引用默认跟随已发布最新版本，笔记与对话独立保存',
    })
  },
  'POST /api/notebooks': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const title = String(body.title || '').trim()
    if (!title) return json(res, 400, { error: '笔记本标题不能为空' })
    const nb = {
      id: `NB-${String(LIVE_NOTEBOOKS.length + 1).padStart(2, '0')}`,
      title, topic: String(body.topic || '未分类'), owner: user.name, role: user.id,
      desc: String(body.desc || '').trim(), securityDomain: netOf(req),
      createdAt: stamp(), updated: stamp(), sources: [], notes: [], chat: [],
      collections: [], pinned: false, shared: false, votes: 0, votedBy: [],
    }
    LIVE_NOTEBOOKS.unshift(nb)
    logAudit(user, 'notebook.create', nb.id, 'allow', netOf(req))
    json(res, 200, { ok: true, notebook: nb })
  },
  'POST /api/notebook/manage': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === body.id)
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    const op = String(body.op || '')
    if (op === 'rename') {
      const title = String(body.title || '').trim()
      if (!title) return json(res, 400, { error: '名称不能为空' })
      nb.title = title.slice(0, 80)
      nb.updated = stamp()
      logAudit(user, 'notebook.rename', nb.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, notebook: { id: nb.id, title: nb.title } })
    }
    if (op === 'pin') {
      nb.pinned = !!body.pinned
      nb.updated = stamp()
      logAudit(user, 'notebook.pin', nb.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, pinned: nb.pinned })
    }
    if (op === 'share') {
      nb.shared = !!body.shared
      if (nb.shared) nb.sharedBy = user.name
      nb.updated = stamp()
      logAudit(user, 'notebook.share', nb.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, shared: nb.shared, sharedBy: nb.sharedBy || nb.owner })
    }
    if (op === 'collections') {
      const incoming = Array.isArray(body.collections) ? body.collections : []
      nb.collections = [...new Set(incoming.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 8)
      nb.collections.forEach((c) => {
        if (!NOTEBOOK_COLLECTIONS.includes(c) && c.length <= 24) NOTEBOOK_COLLECTIONS.push(c)
      })
      nb.updated = stamp()
      logAudit(user, 'notebook.collection', nb.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, collections: nb.collections, all: NOTEBOOK_COLLECTIONS })
    }
    if (op === 'delete') {
      const idx = LIVE_NOTEBOOKS.findIndex((n) => n.id === nb.id)
      LIVE_NOTEBOOKS.splice(idx, 1)
      logAudit(user, 'notebook.delete', nb.id, 'allow', netOf(req))
      return json(res, 200, { ok: true, id: nb.id })
    }
    json(res, 400, { error: '不支持的操作' })
  },
  'POST /api/notebook/vote': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === body.id)
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    if (!Array.isArray(nb.votedBy)) nb.votedBy = []
    if (!nb.votes) nb.votes = 0
    if (nb.votedBy.includes(user.name)) return json(res, 409, { error: '你已经推荐过这本笔记本了' })
    nb.votedBy.push(user.name)
    nb.votes += 1
    logAudit(user, 'notebook.vote', nb.id, 'allow', netOf(req))
    json(res, 200, { ok: true, votes: nb.votes, title: nb.title, featured: notebookFeaturedIds().has(nb.id) })
  },
  'GET /api/notebook': (req, res, url) => {
    const user = roleOf(req)
    const id = url.searchParams.get('id')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === id) || LIVE_NOTEBOOKS[0]
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    const net = netOf(req)
    const sources = nb.sources.map((x) => {
      if (x.kind && x.kind !== 'resource') {
        return {
          resourceId: x.resourceId,
          kind: x.kind,
          name: x.name || x.resourceId,
          type: x.kind,
          format: x.format || '',
          security: '外部来源',
          owner: '本笔记本',
          versionMode: 'follow',
          resolvedVersionId: '—',
          latestVersion: '—',
          syncStatus: '外部来源 · 不参与版本同步',
          canSee: true,
          addedAt: x.addedAt,
          url: x.url || '',
          sizeBytes: Number(x.sizeBytes || 0),
        }
      }
      const r = liveResources.find((y) => y.id === x.resourceId)
      const latest = latestVersionOf(x.resourceId)
      const follow = x.versionMode === 'follow'
      return {
        resourceId: x.resourceId,
        name: r?.name || x.resourceId,
        type: r?.type, format: r?.format, security: r?.security, owner: r?.owner,
        versionMode: x.versionMode,
        resolvedVersionId: x.resolvedVersionId,
        latestVersion: latest,
        syncStatus: follow ? (x.resolvedVersionId === latest ? '跟随最新' : '有更新待同步') : (x.resolvedVersionId === latest ? '已钉住（当前最新）' : '已钉住'),
        canSee: r ? canSee(user, r, net) : false,
        addedAt: x.addedAt,
      }
    })
    const resList = liveResources
      .filter((r) => canSee(user, r, net))
      .map((r) => ({ id: r.id, name: r.name, type: r.type, format: r.format, security: r.security, updated: r.updated, version: latestVersionOf(r.id) }))
    json(res, 200, {
      notebook: { ...nb, sources },
      notes: nb.notes,
      chat: nb.chat,
      candidates: resList,
      limits: { maxSources: NOTEBOOK_MAX_SOURCES, quotaBytes: NOTEBOOK_QUOTA_BYTES, usedBytes: notebookUsageBytes(nb.owner) },
      principles: [
        '数据源唯一：只引用数据中心 Resource，不复制原始文件，不允许改来源内容',
        '动态引用：默认跟随已发布最新版本，检索与问答始终用最新资料',
        '笔记独立：个人撰写或 AI 生成并保存的笔记独立持久化，不随来源更新改写',
        '能力复用：复用数据中心的检索、解析与权限，以及 Harness 的模型与会话',
      ],
    })
  },
  'POST /api/notebook/source': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === body.id)
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    if (body.removeSource) {
      nb.sources = nb.sources.filter((x) => x.resourceId !== body.removeSource)
      nb.updated = stamp()
      logAudit(user, 'notebook.source.remove', body.removeSource, 'allow', netOf(req))
      return json(res, 200, { ok: true, sources: nb.sources })
    }
    if (nb.sources.length >= NOTEBOOK_MAX_SOURCES) {
      return json(res, 409, { error: `每本笔记本最多 ${NOTEBOOK_MAX_SOURCES} 个来源，请先移除不用的来源` })
    }
    if (body.source && body.source.name) {
      const s = body.source
      const kind = ['file', 'cloud'].includes(s.kind) ? s.kind : 'file'
      const rid = String(s.id || `${kind.toUpperCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`)
      if (nb.sources.some((x) => x.resourceId === rid)) return json(res, 409, { error: '该来源已在本笔记本中' })
      const sizeBytes = kind === 'file' ? Math.max(0, Number(s.sizeBytes) || 0) : 0
      if (kind === 'file') {
        const used = notebookUsageBytes(nb.owner)
        if (used + sizeBytes > NOTEBOOK_QUOTA_BYTES) {
          return json(res, 409, { error: `个人智能笔记本容量不足：已用 ${quotaSizeText(used)} / 15 GB，本次文件需要 ${quotaSizeText(sizeBytes)}。数据中心与云空间来源不占容量。` })
        }
      }
      nb.sources.push({
        resourceId: rid,
        kind,
        name: String(s.name).slice(0, 180),
        url: String(s.url || ''),
        format: String(s.format || ''),
        sizeBytes,
        versionMode: 'follow',
        resolvedVersionId: '—',
        addedAt: stamp(),
      })
      nb.updated = stamp()
      logAudit(user, 'notebook.source.add', rid, 'allow', netOf(req))
      return json(res, 200, { ok: true, sources: nb.sources, limits: { maxSources: NOTEBOOK_MAX_SOURCES, quotaBytes: NOTEBOOK_QUOTA_BYTES, usedBytes: notebookUsageBytes(nb.owner) } })
    }
    const r = liveResources.find((x) => x.id === body.resourceId)
    if (!r) return json(res, 404, { error: '资源不存在' })
    if (!canSee(user, r, netOf(req))) return json(res, 403, { error: '无权引用该资源，请先在数据中心申请授权' })
    if (nb.sources.some((x) => x.resourceId === r.id)) return json(res, 409, { error: '该资源已在笔记本中' })
    nb.sources.push({
      resourceId: r.id,
      versionMode: body.versionMode === 'pinned' ? 'pinned' : 'follow',
      resolvedVersionId: latestVersionOf(r.id),
      addedAt: stamp(),
    })
    nb.updated = stamp()
    logAudit(user, 'notebook.source.add', r.id, 'allow', netOf(req))
    json(res, 200, { ok: true, sources: nb.sources, limits: { maxSources: NOTEBOOK_MAX_SOURCES, quotaBytes: NOTEBOOK_QUOTA_BYTES, usedBytes: notebookUsageBytes(nb.owner) } })
  },
  'POST /api/notebook/sync': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === body.id)
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    let changed = 0
    nb.sources.forEach((x) => {
      if (x.kind && x.kind !== 'resource') return
      if (x.versionMode === 'follow') {
        const latest = latestVersionOf(x.resourceId)
        if (x.resolvedVersionId !== latest) { x.resolvedVersionId = latest; changed += 1 }
      }
    })
    nb.updated = stamp()
    json(res, 200, { ok: true, changed, sources: nb.sources })
  },
  'POST /api/notebook/note': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === body.id)
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    if (body.removeNote) {
      nb.notes = nb.notes.filter((x) => x.id !== body.removeNote)
      nb.updated = stamp()
      return json(res, 200, { ok: true, notes: nb.notes })
    }
    const note = body.note || {}
    const exist = nb.notes.find((x) => x.id === note.id)
    if (exist) {
      exist.title = String(note.title || exist.title)
      exist.content = String(note.content ?? exist.content)
      if (Array.isArray(note.citations)) exist.citations = note.citations
      if (note.kind) exist.kind = String(note.kind)
      exist.updatedAt = stamp()
      exist.author = user.name
    } else {
      nb.notes.unshift({
        id: `NN-${String(Date.now()).slice(-6)}`,
        title: String(note.title || '未命名笔记'),
        content: String(note.content || ''),
        kind: String(note.kind || 'chat'),
        author: user.name,
        updatedAt: stamp(),
        citations: Array.isArray(note.citations) ? note.citations : [],
      })
    }
    nb.updated = stamp()
    logAudit(user, 'notebook.note.save', nb.id, 'allow', netOf(req))
    json(res, 200, { ok: true, notes: nb.notes })
  },
  'POST /api/notebook/ask': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const nb = LIVE_NOTEBOOKS.find((n) => n.id === body.id)
    if (!nb) return json(res, 404, { error: '笔记本不存在' })
    const q = String(body.q || '').trim()
    if (!q) return json(res, 400, { error: '问题不能为空' })
    const net = netOf(req)
    const cites = []
    const parts = []
    nb.sources.forEach((x) => {
      if (x.kind && x.kind !== 'resource') {
        parts.push(`《${x.name}》${x.format ? `（${x.format}）` : ''}${x.url ? ` ${x.url}` : ''}`)
        return
      }
      const r = liveResources.find((y) => y.id === x.resourceId)
      if (!r || !canSee(user, r, net)) return
      const ver = x.versionMode === 'follow' ? latestVersionOf(r.id) : x.resolvedVersionId
      const meta = Object.entries(r.meta || {}).map(([k, v]) => `${k}=${v}`).join('，')
      parts.push(`《${r.name}》${ver}（${r.format}，${r.owner}）${r.desc || ''}${meta ? '；' + meta : ''}`)
      cites.push({ resourceId: r.id, versionId: ver, locator: r.type === 'document' ? '全文检索命中段落' : (r.type === 'bizdata' ? '字段 / 指标字典' : '元数据与空间范围') })
    })
    const hitNotes = nb.notes.filter((n) => `${n.title}${n.content}`.includes(q.slice(0, 4)))
    const answer = parts.length
      ? `按当前引用的 ${parts.length} 项来源（已按最新发布版本解析）作答：${q}。可用的依据是 ${parts.slice(0, 3).join('；')}。${hitNotes.length ? `并结合笔记本中的 ${hitNotes.length} 条个人笔记。` : ''}具体结论建议在正文与指标字典中逐条核对定位。`
      : '这个笔记本还没有引用资料。请先添加 Web、数据中心、云空间或本地来源，再提问——笔记本不会复制文件，只建立引用关系。'
    const msg = { role: 'ai', at: stamp(), text: answer, citations: cites }
    nb.chat.push({ role: 'user', at: stamp(), text: q })
    nb.chat.push(msg)
    nb.updated = stamp()
    logAudit(user, 'notebook.ask', nb.id, `allow ${nb.sources.length} sources`, net)
    json(res, 200, { ok: true, answer, citations: cites, chat: nb.chat })
  },
  'GET /api/academy': (req, res) => {
    const user = roleOf(req)
    json(res, 200, {
      items: liveAcademy,
      categories: [{ key: 'all', label: '全部' }, { key: 'classic', label: '经典项目' }, { key: 'video', label: '学习视频' }, { key: 'doc', label: '学习课件' }, { key: 'spec', label: '规范文件' }, { key: 'report', label: '调研报告' }],
      stats: { ...academyStats, user: user.name, dept: user.unit },
    })
  },
  'POST /api/academy/progress': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const item = liveAcademy.find((a) => a.id === body.id)
    if (!item) return json(res, 404, { error: '资源不存在' })
    item.progress = Math.max(0, Math.min(100, Number(body.progress || 0)))
    logAudit(user, 'academy.progress', item.id, `allow ${item.progress}%`, netOf(req))
    json(res, 200, { ok: true, item })
  },
  'GET /api/ai/tools': (req, res) => {
    json(res, 200, {
      items: aiTools,
      identity: '工具以“当前登录员工 + 当前网络”为调用身份，每次调用按模块授权判定并写审计',
    })
  },
  'POST /api/mcp/approval': async (req, res) => {
    const mcpToken = process.env.JG_MCP_TOKEN || ''
    if (!mcpToken || String(req.headers['x-jg-mcp-token'] || '') !== mcpToken) {
      return json(res, 403, { error: '仅允许本机 MCP 桥请求审批' })
    }
    const account = getAccount(process.env.JG_MCP_ACCOUNT || 'A-7788-01') || getAccountByRole('admin')
    const user = account ? userOfAccount(account) : null
    if (!user) return json(res, 403, { error: 'MCP 账号不可用' })
    const body = JSON.parse(req.__body || '{}')
    const tool = String(body.tool || '')
    const args = body.args && typeof body.args === 'object' ? body.args : {}
    if (!isExternalSideEffectTool(tool) && !isExternalSideEffectTool(`mcp__jg__${tool}`)) {
      recordApprovalDecision({
        tool: `mcp__jg__${tool}`,
        operation: 'read',
        summary: summarizeToolCall(`mcp__jg__${tool}`, args),
        decision: 'auto-allow',
        rule: 'mcp-non-side-effect',
        risk: 'low',
        actor: user.name,
        approver: 'policy:mcp',
        net: netOf(req),
      })
      return json(res, 200, { ok: true, outcome: 'allowed-once', note: '非外部副作用工具，无需审批' })
    }
    const active = [...activeRuns]
      .map((id) => conversations.find((c) => c.id === id))
      .filter((c) => c && (c.userId === user.id || !c.userId))
    if (!active.length) {
      return json(res, 409, { error: '当前没有正在执行的会话，MCP 写操作已拒绝；请在大厅发起任务后再调用。', code: 'NO_ACTIVE_RUN' })
    }
    if (active.length > 1) {
      return json(res, 409, { error: '当前有多个会话正在执行，无法确定审批归属，MCP 写操作已拒绝。', code: 'AMBIGUOUS_ACTIVE_RUN' })
    }
    const conv = active[0]
    const evaluation = describeToolApproval({
      toolNameResolved: `mcp__jg__${tool}`,
      toolArgs: JSON.stringify(args),
    })
    const decisionId = recordApprovalDecision({
      conversationId: conv.id,
      tool: `mcp__jg__${tool}`,
      operation: evaluation.operation,
      summary: evaluation.summary,
      decision: 'pending',
      rule: 'external-side-effect',
      risk: 'high',
      actor: user.name,
      approver: 'pending',
      net: netOf(req),
    })
    const details = approvalDetails({
      toolNameResolved: `mcp__jg__${tool}`,
      toolArgs: JSON.stringify(args),
      reason: 'MCP 外部副作用工具需要人工确认',
    }, { ...evaluation, decisionId })
    const result = await createPendingInteraction('approval', conv.id, { ...details, decisionId })
    const allowed = result?.outcome === 'allowed-once'
    logAudit(user, 'mcp.approval', conv.id, `${allowed ? 'allow' : String(result?.outcome || 'cancelled')} ${details.toolName} ${details.summary}`.slice(0, 900), netOf(req))
    if (!allowed) return json(res, 403, { error: '用户未批准该 MCP 外部副作用操作', outcome: result?.outcome || 'cancelled' })
    return json(res, 200, { ok: true, outcome: 'allowed-once' })
  },
  'POST /api/ai/invoke': async (req, res) => {
    const mcpToken = process.env.JG_MCP_TOKEN || ''
    const viaMcp = Boolean(mcpToken) && String(req.headers['x-jg-mcp-token'] || '') === mcpToken
    let user
    if (viaMcp) {
      const account = getAccount(process.env.JG_MCP_ACCOUNT || 'A-7788-01') || getAccountByRole('admin')
      user = account ? userOfAccount(account) : { ...roles.admin, id: 'mcp', accountId: 'mcp' }
    } else {
      user = roleOf(req)
    }
    const body = JSON.parse(req.__body || '{}')
    const name = String(body.tool || '')
    const args = body.args && typeof body.args === 'object' ? body.args : {}
    const tool = aiTools.find((t) => t.name === name)
    if (!tool) return json(res, 404, { error: '工具不存在', hint: '先调用 GET /api/ai/tools 获取可用工具' })
    const TOOL_MODULE = { 云空间: 'drive', 通知公告: 'notice', 教学园地: 'academy', 通讯录: 'contacts', 即时通讯: 'im', 任务: 'tasks', 智能笔记本: 'knowledge', 数据中心: 'datacenter' }
    // 平台基础服务不属于任何业务模块：只要当前账号已登录，就按服务自身的资源边界校验。
    const PLATFORM_BASE_TOOLS = new Set(['format_capabilities', 'format_inspect', 'format_extract', 'format_export', 'code_review', 'visual_create', 'visual_update', 'visual_get', 'visual_export', 'visual_save'])
    if (!PLATFORM_BASE_TOOLS.has(name) && !user.visibleModules.includes(TOOL_MODULE[tool.target] || 'tasks')) {
      logAudit(user, 'ai.invoke', name, 'deny(403)', netOf(req))
      return json(res, 403, { error: `当前角色无权调用「${tool.label}」` })
    }
    let result = null
    if (name.startsWith('visual_')) {
      try {
        const sessionId = String(req.headers['x-jg-conversation'] || body.conversationId || args.sessionId || '')
        result = invokeVisualTool(name, args, user, sessionId)
      } catch (error) {
        logAudit(user, 'ai.invoke', name, `deny(${error?.code || 'VISUAL_ERROR'})`, netOf(req))
        return json(res, Number(error?.status) || 422, { error: String(error?.message || error), code: error?.code || 'VISUAL_ERROR' })
      }
    } else if (name === 'drive_search') {
      const q = String(args.q || '').trim()
      const type = String(args.type || '').trim()
      const list = liveDrive
        .filter((d) => (q ? `${d.name}${(d.tags || []).join('')}${d.dept}`.includes(q) : true))
        .filter((d) => (type ? d.type === type : true))
        .map((d) => ({ id: d.id, name: d.name, type: d.type, typeLabel: typeLabelOf(d), dept: d.dept, owner: d.owner, shared: d.shared, scope: d.scope, family: ASSET_FAMILY[d.type] || DOC_LABELS[d.type] }))
      result = { count: list.length, items: list.slice(0, 8) }
    } else if (name === 'drive_read') {
      const item = liveDrive.find((d) => d.id === args.id) || liveDrive[0]
      const family = ASSET_FAMILY[item.type] || '文档'
      if (ASSET_FAMILY[item.type]) {
        result = {
          id: item.id, name: item.name, family,
          layers: ['用地边界', '道路中心线', '管线', '影像底图'], crs: 'CGCS2000 / 3-degree Gauss-Kruger CM 117E',
          extent: '114.98E–116.12E, 29.32N–29.98N', note: '原型返回元数据与图层清单；正式版由 GIS 服务按要素级授权返回',
        }
      } else {
        const doc = collabOf(item)
        result = { id: item.id, name: item.name, family, kind: doc.kind, content: doc.body || doc.table || doc.slides }
      }
    } else if (name === 'notice_list') {
      const q = String(args.q || '').trim()
      result = { count: liveNotices.filter((n) => (q ? `${n.title}${n.summary}`.includes(q) : true)).length, items: liveNotices.filter((n) => (q ? `${n.title}${n.summary}`.includes(q) : true)).slice(0, 5).map((n) => ({ id: n.id, title: n.title, category: n.category, dept: n.dept, time: n.time, summary: n.summary })) }
    } else if (name === 'academy_search') {
      const q = String(args.q || '').trim()
      const list = liveAcademy.filter((a) => (q ? `${a.title}${(a.tags || []).join('')}${a.summary}`.includes(q) : true))
      result = { count: list.length, items: list.slice(0, 6).map((a) => ({ id: a.id, title: a.title, fmt: a.fmt, kind: a.kind, duration: a.duration, pages: a.pages, dept: a.dept })) }
    } else if (name === 'contacts_find') {
      const q = String(args.q || '').trim().toLowerCase()
      const list = contacts.filter((c) => (q ? `${c.name}${c.duty}${c.dept}${c.tags.join('')}`.toLowerCase().includes(q) : true))
      result = { count: list.length, items: list.slice(0, 5).map((c) => ({ name: c.name, duty: c.duty, dept: c.dept, mail: c.mail })) }
    } else if (name === 'im_send') {
      const thread = liveIm.find((t) => t.id === args.id)
      if (!thread || !String(args.text || '').trim()) return json(res, 400, { error: '会话不存在或消息为空' })
      thread.messages.push({ from: user.name, text: String(args.text).trim(), time: new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5) })
      result = { ok: true, thread: thread.id, from: user.name }
    } else if (name === 'notice_read') {
      const n = liveNotices.find((x) => x.id === args.id) || liveNotices[0]
      result = { id: n.id, title: n.title, category: n.category, dept: n.dept, author: n.author, time: n.time, body: n.body }
    } else if (name === 'notebook_search') {
      const q = String(args.q || '').trim()
      const scope = args.notebook ? LIVE_NOTEBOOKS.filter((n) => n.id === args.notebook) : LIVE_NOTEBOOKS
      const items = []
      scope.slice(0, 3).forEach((n) => {
        n.sources.forEach((x) => {
          const r = liveResources.find((y) => y.id === x.resourceId)
          if (!r || !canSee(user, r, netOf(req))) return
          const hay = `${r.name}${r.desc}${q}`.toLowerCase()
          if (q && !hay.includes(q.toLowerCase())) return
          items.push({ notebook: n.id, resourceId: r.id, name: r.name, version: x.versionMode === 'follow' ? latestVersionOf(r.id) : x.resolvedVersionId, locator: '资源元数据 / 全文索引', summary: r.desc })
        })
      })
      result = { count: items.length, items: items.slice(0, 6), scope: scope.map((n) => ({ id: n.id, title: n.title, sources: n.sources.length })), note: '返回引用关系而非文件副本；检索复用数据中心全文索引' }
    } else if (name === 'resource_query') {
      const q = String(args.q || '').trim().toLowerCase()
      const list = liveResources.filter((r) => (q ? `${r.name}${(r.tags || []).join('')}`.toLowerCase().includes(q) : true))
      result = { count: list.length, items: list.slice(0, 5).map((r) => ({ id: r.id, name: r.name, security: r.security, scope: r.scope, extent: r.extent, updated: r.updated })) }
    } else if (name === 'format_capabilities') {
      result = { items: FORMAT_REGISTRY, note: 'PDF / GIS / CAD 是平台级格式基座，不是数据中心模块。' }
    } else if (name === 'format_inspect') {
      const fileId = String(args.fileId || '')
      if (!fileId) return json(res, 400, { error: '缺少数据文件 ID' })
      let buffer
      try { buffer = readFileBuffer(fileId) } catch { return json(res, 404, { error: '文件不存在或已过期' }) }
      try {
        const data = await inspectDataFormat(buffer, String(args.name || '数据文件'), String(args.mime || ''))
        result = { fileId, format: data.format, formatLabel: data.formatLabel, kind: data.kind, pageCount: data.pageCount, features: data.features, layers: data.layers, bbox: data.bbox, crs: data.crs, note: data.note || '' }
      } catch (error) {
        return json(res, Number(error?.status) || 422, { error: '数据格式解析失败', detail: String(error?.message || error) })
      }
    } else if (name === 'format_extract') {
      const fileId = String(args.fileId || '')
      if (!fileId) return json(res, 400, { error: '缺少数据文件 ID' })
      let buffer
      try { buffer = readFileBuffer(fileId) } catch { return json(res, 404, { error: '文件不存在或已过期' }) }
      try { result = await extractDataFormat(buffer, String(args.name || ''), String(args.mime || '')) } catch (error) { return json(res, Number(error?.status) || 422, { error: '数据内容提取失败', detail: String(error?.message || error) }) }
    } else if (name === 'format_export') {
      const format = String(args.format || '')
      const op = String(args.op || '')
      if (!format || !op) return json(res, 400, { error: '缺少输出格式或操作' })
      const fileIds = Array.isArray(args.fileIds) ? args.fileIds.map(String).filter(Boolean) : []
      let buffer = null
      let buffers = []
      try {
        if (format === 'pdf' && op === 'merge') {
          if (fileIds.length < 2) return json(res, 400, { error: '合并至少需要两个 PDF 文件' })
          for (const id of fileIds) buffers.push(readFileBuffer(id))
        } else {
          const fileId = String(args.fileId || '')
          if (!fileId) return json(res, 400, { error: '缺少数据文件 ID' })
          buffer = readFileBuffer(fileId)
        }
      } catch {
        return json(res, 400, { error: '文件不存在或已过期' })
      }
      const { outputs } = await exportDataFormat({ format, op, buffer, buffers, ranges: args.ranges, name: String(args.name || '数据') })
      const files = []
      for (const [index, output] of outputs.entries()) {
        const id = `FMT-${Date.now().toString().slice(-8)}-${index + 1}`
        const mime = output.format === 'pdf' ? 'application/pdf' : output.format === 'gis' ? 'application/geo+json' : 'application/dxf'
        const stored = putFile({ id, name: output.name, mime, buffer: output.buffer, owner: user.name, net: netOf(req), note: `format.export:${format}/${op}` })
        files.push({ id: stored.id, name: output.name, size: stored.size, mime, label: output.label || '', url: `/api/files/download?id=${stored.id}` })
      }
      result = { format, op, files }
    } else if (name === 'code_review') {
      const projectId = String(args.projectId || '')
      if (!projectId) return json(res, 400, { error: '缺少项目 ID' })
      const project = liveProjects.find((p) => p.id === projectId && !p.removed)
      if (!project || !projectVisibleTo(user, project)) return json(res, 403, { error: '当前身份无权审查该项目' })
      if (!project.cwd) return json(res, 400, { error: '该项目尚未绑定本地文件夹' })
      const run = await runHarnessService('code-review', { cwd: project.cwd, scope: args.scope, maxFiles: args.maxFiles })
      result = { project: { id: project.id, name: project.name, cwd: project.cwd }, ...run }
    } else if (name === 'task_create') {
      const title = String(args.title || '').trim() || 'AI 创建的待办'
      result = { ok: true, id: `T-AI${String(Date.now()).slice(-5)}`, title, state: '待分配' }
    }
    logAudit(user, 'ai.invoke', name, 'allow', netOf(req))
    json(res, 200, { ok: true, tool: name, actor: `${user.name}（${user.unit}）`, result })
  },
  'POST /api/logout': (req, res) => {
    const session = sessionOf(req)
    if (session) deleteSession(session.id)
    res.setHeader('set-cookie', [
      clearSessionCookie(),
      'jg_role=; Path=/; Max-Age=0; SameSite=Lax',
    ])
    json(res, 200, { ok: true })
  },
  'GET /api/org': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理角色可查看组织与授权' })
    json(res, 200, {
      units: orgUnits,
      members: liveMembers.map((m) => ({ ...m, duties: liveDuties.get(m.role) || [] })),
      dutyCatalog,
      roleDuties: Object.fromEntries([...liveDuties.entries()].map(([k, v]) => [k, v])),
      changes: audit.filter((a) => String(a.action || '').startsWith('org.duty') || String(a.action || '').startsWith('resource.grant')).slice(0, 12),
    })
  },
  'POST /api/org/duty': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理角色可授予职能' })
    const body = JSON.parse(req.__body || '{}')
    const member = liveMembers.find((m) => m.id === body.memberId || m.role === body.memberRole)
    const targetRole = body.memberRole || member?.role
    if (!targetRole || !roles[targetRole]) return json(res, 400, { error: '成员不在可授予范围（演示角色限定）' })
    const duty = String(body.duty || '')
    if (!dutyCatalog.some((d) => d.code === duty)) return json(res, 400, { error: '未知职能' })
    const list = liveDuties.get(targetRole) || []
    const allow = body.allow !== false
    const next = allow ? [...new Set([...list, duty])] : list.filter((d) => d !== duty)
    liveDuties.set(targetRole, next)
    logAudit(user, allow ? 'org.duty.grant' : 'org.duty.revoke', `${targetRole}:${duty}`, 'allow', netOf(req))
    json(res, 200, { ok: true, role: targetRole, duties: next })
  },
  'GET /api/messages': (req, res) => {
    const user = roleOf(req)
    json(res, 200, {
      items: liveMessages,
      unread: liveMessages.filter((m) => m.unread).length,
      canManage: canManage(user),
    })
  },
  'POST /api/messages/read': (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    if (body.all) liveMessages.forEach((m) => { m.unread = false })
    else {
      const m = liveMessages.find((x) => x.id === body.id)
      if (m) m.unread = false
    }
    json(res, 200, { ok: true, unread: liveMessages.filter((m) => m.unread).length })
  },
  'GET /api/resource/versions': (req, res, url) => {
    const id = url.searchParams.get('id')
    const versions = liveVersions[id] || [
      { v: 'V1.0', date: '2026-05-06', note: '首次登记并建立索引', by: '数据中心', state: '当前' },
    ]
    json(res, 200, { id, items: versions, grants: liveGrants[id] || [] })
  },
  'POST /api/resource/version': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user) && !dutiesOf(user).includes('dataAdmin')) return json(res, 403, { error: '版本与生命周期由数据管理员维护' })
    const body = JSON.parse(req.__body || '{}')
    const id = body.id
    const list = liveVersions[id] || (liveVersions[id] = [{ v: 'V1.0', date: '2026-05-06', note: '首次登记并建立索引', by: '数据中心', state: '当前' }])
    const act = body.action || 'publish'
    if (act === 'publish') {
      const n = list.filter((x) => x.v.startsWith('V')).length
      list.forEach((x) => { x.state = x.state === '当前' ? '历史' : x.state })
      list.unshift({ v: `V${n + 1}.0`, date: new Date().toISOString().slice(0, 10), note: body.note || '上传新版本并重建索引', by: `${user.name}（${user.unit}）`, state: '当前' })
    } else if (act === 'archive') {
      list[0].state = '已归档'
    } else if (act === 'restore') {
      list.forEach((x) => { if (x.state === '已归档') x.state = '当前' })
    }
    logAudit(user, `resource.version.${act}`, id, 'allow', netOf(req))
    json(res, 200, { ok: true, id, items: liveVersions[id], message: act === 'publish' ? '已上传新版本，原文件与派生关系保留' : act === 'archive' ? '已归档，可按授权恢复' : '已恢复为当前版本' })
  },
  'POST /api/resource/grant': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user) && !dutiesOf(user).includes('dataAdmin')) return json(res, 403, { error: '资源授权由数据管理员维护' })
    const body = JSON.parse(req.__body || '{}')
    const id = body.id
    const rights = Array.isArray(body.rights) ? body.rights : ['查看']
    liveGrants[id] = liveGrants[id] || []
    liveGrants[id] = liveGrants[id].filter((g) => !(g.target === body.target && g.type === body.type))
    if (rights.length) liveGrants[id].push({ target: body.target, type: body.type, rights, by: user.name, at: new Date().toISOString().slice(0, 16).replace('T', ' ') })
    logAudit(user, 'resource.grant', `${id}:${body.target}`, 'allow', netOf(req))
    json(res, 200, { ok: true, id, grants: liveGrants[id] })
  },
  'GET /api/dataservices': (req, res) => json(res, 200, { items: liveDataServices, base: 'http://datacenter.jg.local/api' }),
  'GET /api/model/config': (req, res) => {
    const user = roleOf(req)
    const conf = liveModelConfig.get(user.id) || { provider: '统一模型网关', endpoint: 'https://ai.jg.local/v1', key: 'sk-••••••••••••4f2a', defaultModel: (networks[netOf(req)].models[0] || {}).label || '—', testedAt: '2026-11-06 18:20', latency: '—' }
    const { apiKey, ...safe } = conf
    json(res, 200, { ...safe, apiKeySaved: !!apiKey, providers: ['统一模型网关', 'OpenAI 兼容端点', '个人自建服务'], ownApiRequired: user.id === 'guest' })
  },
  'POST /api/model/config': (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    const prev = liveModelConfig.get(user.id) || { provider: '统一模型网关', endpoint: 'https://ai.jg.local/v1', key: 'sk-••••••••••••4f2a', defaultModel: '—' }
    const next = { ...prev, provider: body.provider || prev.provider, endpoint: body.endpoint || prev.endpoint, defaultModel: body.defaultModel || prev.defaultModel }
    if (body.clear) {
      delete next.apiKey
      delete next.key
    } else if (body.key && !String(body.key).includes('•')) {
      next.apiKey = String(body.key).trim()
      next.key = `${String(body.key).slice(0, 3)}••••••••${String(body.key).slice(-4)}`
    }
    liveModelConfig.set(user.id, next)
    if (user.accountId) {
      updateAccountSecret(user.accountId, {
        apiKey: next.apiKey || '',
        apiProvider: next.provider || '',
        apiEndpoint: next.endpoint || '',
        apiModel: next.defaultModel || '',
      })
    }
    logAudit(user, 'model.config', `${next.provider}`, 'allow', netOf(req))
    json(res, 200, { ok: true, config: { ...next, apiKey: next.apiKey ? '已保存' : '' }, message: '配置已保存到服务端凭证库（个人 Key 仅本人可见）' })
  },
  'POST /api/model/test': async (req, res) => {
    const user = roleOf(req)
    const body = JSON.parse(req.__body || '{}')
    if (!String(body.endpoint || '').startsWith('http')) return json(res, 400, { error: '端点需以 http(s) 开头' })
    const cfg = resolveModelConfig({ userConfig: liveModelConfig.get(user.id) || {}, request: { ownApiKey: body.ownApiKey, baseUrl: body.endpoint, modelName: body.defaultModel } })
    if (cfg.source === 'none') return json(res, 503, { error: '未配置模型密钥，无法测试连接', code: 'MODEL_KEY_MISSING' })
    try {
      const probe = await chatCompletion({
        messages: [{ role: 'user', content: '只回复“连接正常”四个字。' }],
        model: cfg.model, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, timeoutMs: 30000,
      })
      const latency = `${probe.latencyMs} ms`
      const prev = liveModelConfig.get(user.id) || {}
      liveModelConfig.set(user.id, { ...prev, testedAt: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16), latency })
      logAudit(user, 'model.test', body.provider || cfg.baseUrl, 'allow', netOf(req))
      return json(res, 200, { ok: true, latency, message: `连接正常 · ${latency} · ${probe.model} 可用`, reply: probe.content })
    } catch (error) {
      logAudit(user, 'model.test', body.provider || cfg.baseUrl, `deny(${error.code || 'MODEL_ERROR'})`, netOf(req))
      return json(res, error instanceof ModelError ? error.status : 502, { error: error.message, code: error.code || 'MODEL_ERROR' })
    }
  },
  'GET /api/tool-ledger': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '工具台账仅管理角色可见' })
    json(res, 200, { items: liveToolLedger, total: liveToolLedger.length, highRisk: liveToolLedger.filter((t) => t.risk === '高').length })
  },
  'POST /api/tool-ledger': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理角色可调整工具策略' })
    const body = JSON.parse(req.__body || '{}')
    const t = liveToolLedger.find((x) => x.id === body.id)
    if (!t) return json(res, 404, { error: '工具不存在' })
    if (body.confirm !== undefined) t.confirm = !!body.confirm
    logAudit(user, 'tool.policy', `${t.id}:confirm=${t.confirm}`, 'allow', netOf(req))
    json(res, 200, { ok: true, item: t })
  },
  'GET /api/security': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '安全后台仅安全管理员可见' })
    const denies = audit.filter((a) => String(a.result || '').includes('deny')).slice(0, 5)
    json(res, 200, {
      policy: modelPolicy,
      anomalies: accessAnomalies,
      denies,
      reviews: [
        { id: 'RV-01', name: '规划一所 · 资源授权复核', at: '2026-11-06', owner: '刘洋', result: '通过', note: '12 项资源，2 项回收' },
        { id: 'RV-02', name: '外部访客 · 模块授权复核', at: '2026-11-05', owner: '钱工', result: '通过', note: '云空间授权已收回' },
      ],
    })
  },
  'POST /api/apps/version': (req, res) => {
    const user = roleOf(req)
    if (!canManage(user) && !dutiesOf(user).includes('appReviewer')) return json(res, 403, { error: '仅应用审核员可维护版本' })
    const body = JSON.parse(req.__body || '{}')
    const app = liveApps.find((a) => a.id === body.id)
    if (!app) return json(res, 404, { error: '应用不存在' })
    const act = body.action
    if (act === 'update') {
      app.version = body.version || app.version
      app.history = [{ version: app.version, date: new Date().toISOString().slice(0, 10), note: body.note || '更新版本' }, ...(app.history || [])]
    } else if (act === 'rollback') {
      const prev = (app.history || [])[1]
      if (prev) app.version = prev.version
    } else if (act === 'disable') {
      app.status = 'draft'
    } else if (act === 'alert') {
      app.alert = `启动成功率 ${88 + (Date.now() % 8)}% · 低于阈值`
    }
    logAudit(user, `app.version.${act}`, app.id, 'allow', netOf(req))
    json(res, 200, { ok: true, item: app, message: act === 'rollback' ? `已回滚至 v${app.version}` : act === 'disable' ? '已下架，保留数据与使用部门通知' : act === 'alert' ? app.alert : '版本已更新' })
  },
  'GET /api/audit': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const netLabel = (networks[net] && networks[net].label) || net
    // 管理角色看全量；普通角色只看本人在当前网络下的记录，避免跨角色读取审计。
    const items = canManage(user)
      ? audit
      : audit.filter((item) => item.actor === user.name && item.net === netLabel)
    return json(res, 200, { items: items.slice(0, 12) })
  },
  'GET /api/approval-decisions': (req, res, url) => {
    const user = roleOf(req)
    if (!canManage(user)) return json(res, 403, { error: '仅管理角色可查看审批决策' })
    const limit = Math.max(1, Math.min(Number(url?.searchParams?.get('limit') || 50) || 50, 200))
    return json(res, 200, { items: latestApprovalDecisions(limit) })
  },
  'POST /api/attempt': (req, res) => {
    const user = roleOf(req)
    const net = netOf(req)
    const body = JSON.parse(req.__body || '{}')
    const resource = liveResources.find((r) => r.id === body.id) || liveResources.find((r) => !canSee(user, r, net)) || liveResources[0]
    if (canSee(user, resource, net)) {
      return json(res, 200, { ok: true, message: '当前角色与网络对此资源有授权，请更换角色或网络再试。' })
    }
    logAudit(user, 'resource.read', resource.id, 'deny(403)', net)
    json(res, 403, {
      error: '越权访问已被拦截',
      detail: `资源「${resource.name}」不在当前网络（${networks[net].label}）与角色的授权范围内；目录、详情、下载链接三处一致判定。`,
      evidence: {
        resource: resource.id,
        security: resource.security,
        requiredScope: resource.scope.filter((s) => !user.scopes.includes(s)).slice(0, 3).join(' / '),
        net: networks[net].label,
        actor: `${user.name}（${user.duty}）`,
      },
    })
  },
  'POST /api/tts': async (req, res) => {
    const body = JSON.parse(req.__body || '{}')
    const text = String(body.text || '').trim()
    if (!text) return json(res, 400, { error: '没有可朗读的文本' })
    if (text.length > 6000) return json(res, 400, { error: '单次朗读文本不能超过 6000 字' })
    try {
      const result = await localTtsFile(text)
      return json(res, 200, {
        ok: true,
        engine: 'piper',
        voice: 'zh_CN-huayan-medium',
        cached: result.cached,
        chars: text.length,
        url: `/api/tts/audio?name=${encodeURIComponent(result.name)}`,
      })
    } catch (error) {
      if (error?.code === 'TTS_NOT_READY') {
        return json(res, 503, { error: error.message, code: 'TTS_NOT_READY' })
      }
      return json(res, 500, { error: String(error?.message || error), code: 'TTS_FAILED' })
    }
  },
  'GET /api/tts/audio': async (req, res, url) => {
    const name = String(url?.searchParams?.get('name') || '')
    if (!/^[a-f0-9]{24}\.wav$/.test(name)) return json(res, 400, { error: '语音文件名无效' })
    const file = join(PIPER_CACHE_DIR, name)
    try {
      const data = await readFile(file)
      res.writeHead(200, {
        'content-type': 'audio/wav',
        'content-length': data.length,
        'cache-control': 'private, max-age=3600',
      })
      return res.end(data)
    } catch {
      return json(res, 404, { error: '语音文件不存在或已过期' })
    }
  },
}

function recoverConversationFromTrace(user, c) {
  const messages = c.messages || []
  if (messages.length !== 1 || messages[0].role !== 'user' || c.status === 'running') return false
  const home = typeof user === 'string' ? userAgentHome(user) : userAgentHome(user.id)
  const traces = listTraces(home, c.id)
  const latest = traces[0]
  if (!latest) return false
  const trace = readTrace(home, c.id, latest.id)
  if (!trace) return false
  // 轨迹必须对应本轮用户输入；否则可能把上一轮的旧回答误贴到新提问上。
  const traceInput = String(trace.input || '').trim()
  const userText = String(messages[0].text || '').trim()
  if (!traceInput || traceInput !== userText) return false
  const finalEvent = [...(trace.events || [])].reverse().find((e) => {
    if (e.type !== 'assistant/message') return false
    const content = e.data?.message?.content || []
    return content.some((part) => part.type === 'text' && String(part.text || '').trim())
  })
  if (!finalEvent) return false
  const text = (finalEvent.data.message.content || [])
    .filter((part) => part.type === 'text')
    .map((part) => String(part.text || ''))
    .join('')
    .trim()
  if (!text) return false
  const titleEvent = [...(trace.events || [])].reverse().find((e) => {
    const title = String(e.data?.title || '').trim()
    return e.type === 'session/title' && title && !title.startsWith('当前用户')
  })
  const title = String(titleEvent?.data?.title || '').trim()
  const ended = Number(trace.endedAt || latest.at || Date.now())
  const time = new Date(ended).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
  c.messages.push({
    role: 'assistant',
    text,
    time,
    steps: (trace.steps || []).map((s) => ({ tool: s.tool, detail: s.detail, status: s.status, ms: s.ms })),
    traceId: trace.traceId,
  })
  c.title = title || c.title
  c.time = time || c.time
  c.status = 'done'
  c.turns = Math.max(1, Number(c.turns) || 1)
  c.dshSessionId = trace.dshSessionId || c.dshSessionId || ''
  return true
}

function recoverPersistedConversations() {
  let changed = false
  for (const c of conversations) {
    if (!c || !Array.isArray(c.messages)) continue
    if (c.status === 'running') {
      // 新进程启动后不可能还有真正在跑的会话；若回答已先落库就收口为完成，否则标为失败。
      c.status = c.messages.some((m) => m.role === 'assistant' && String(m.text || '').trim()) ? 'done' : 'failed'
      changed = true
    }
    if (c.userId && recoverConversationFromTrace(String(c.userId), c)) changed = true
  }
  if (changed) persistPersistentState()
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'jg-server', storage: 'sqlite', time: new Date().toISOString() })
  }

  if (url.pathname.startsWith('/api/')) {
    const key = `${req.method} ${url.pathname}`
    const handler = api[key]
    if (!handler) return json(res, 404, { error: `no route ${key}` })

    // 保留登录前的三个入口：读取引导、选网络、选角色；其余 API 必须先有服务端会话。
    const publicApi = new Set(['GET /api/captcha', 'GET /api/bootstrap', 'POST /api/login', 'POST /api/network', 'POST /api/logout'])
    const mcpToken = process.env.JG_MCP_TOKEN || ''
    const viaMcp = Boolean(mcpToken) && String(req.headers['x-jg-mcp-token'] || '') === mcpToken
    if (!publicApi.has(key) && !viaMcp && !sessionOf(req)) {
      return json(res, 401, { error: '未登录或会话已过期，请重新选择身份', code: 'AUTH_REQUIRED' })
    }
    if (!publicApi.has(key) && !viaMcp && key !== 'POST /api/account/password') {
      const account = sessionOf(req)?.accountId ? getAccount(sessionOf(req).accountId) : null
      if (account?.mustChangePassword) {
        return json(res, 403, { error: '首次登录需先修改初始密码', code: 'PASSWORD_CHANGE_REQUIRED' })
      }
    }

    const blockedModule = viaMcp ? null : guestBlock(roleOf(req), key)
    if (blockedModule) {
      return json(res, 403, {
        error: '外部访客仅可浏览模块框架，读取企业数据需管理员按模块授权',
        guestBlocked: true,
        module: blockedModule,
      })
    }

    if (req.method === 'POST') {
      if (url.pathname === '/api/files/upload') {
        const chunks = []
        let total = 0
        for await (const chunk of req) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          total += buf.length
          if (total > UPLOAD_LIMIT_BYTES) {
            res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
            return res.end(JSON.stringify({ error: `单个文件不能超过 ${Math.round(UPLOAD_LIMIT_BYTES / 1024 / 1024)} MB` }))
          }
          chunks.push(buf)
        }
        req.__buffer = Buffer.concat(chunks, total)
        req.__body = ''
      } else {
        let raw = ''
        for await (const chunk of req) raw += chunk
        req.__body = raw
      }
    }
    try {
      const result = await handler(req, res, url)
      if (req.method === 'POST') persistPersistentState()
      return result
    } catch (err) {
      if (!res.headersSent) return json(res, 500, { error: String(err) })
      return undefined
    }
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const file = join(publicDir, rel === '' ? 'index.html' : rel)
  if (!file.startsWith(publicDir + sep)) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    const data = await readFile(file)
    res.writeHead(200, {
      'content-type': mime[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(data)
  } catch {
    const fallback = await readFile(join(publicDir, 'index.html'))
    res.writeHead(200, { 'content-type': mime['.html'] })
    res.end(fallback)
  }
})

server.listen(port, '127.0.0.1', () => {
  cleanupSessions()
  ensureNativeSessionSearch()
  refreshRuntimeConfigDump()
  console.log(`[jg-hub] http://127.0.0.1:${port}`)
  console.log(`[jg-server] sqlite: ${dataDirPath()}`)
  try {
    const first = backupNow('启动备份')
    console.log(`[jg-server] backup: ${first.path}`)
  } catch (err) {
    console.error('[jg-server] backup failed:', err && err.message ? err.message : err)
  }
  // P0-2：本地库按 10 分钟做一致性快照，满足 RPO ≤ 15 分钟；备份目录只保留最近 14 份。
  const backupTimer = setInterval(() => {
    try {
      backupNow('定时备份')
    } catch (err) {
      console.error('[jg-server] backup failed:', err && err.message ? err.message : err)
    }
  }, 10 * 60 * 1000)
  if (typeof backupTimer.unref === 'function') backupTimer.unref()
})

process.on('exit', () => closeStore())
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    try { await closeHarness() } catch {}
    try { closeStore() } catch {}
    process.exit(0)
  })
}
process.on('uncaughtException', (error) => {
  console.error('[jg-server] uncaughtException:', error && error.stack ? error.stack : error)
})
process.on('unhandledRejection', (error) => {
  console.error('[jg-server] unhandledRejection:', error && error.stack ? error.stack : error)
})
