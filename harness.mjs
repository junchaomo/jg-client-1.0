/**
 * DeepSeek Harness 运行时适配层
 * 通过官方 SDK 在独立子进程中启动 dsh 的 sdk profile，把真实的 agent
 * 会话、工具调用、技能与子代理能力接到现有九规智能中枢后端。
 * 本文件不改变任何前端页面；只负责把 /api/chat 的请求交给 Harness。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dataDirPath } from './db.mjs'

const root = fileURLToPath(new URL('./', import.meta.url))
const runtimeRoot = process.env.JG_DSH_RUNTIME || join(root, 'dsh-runtime')
const sdkEntry = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh-sdk-client', 'lib', 'index.js')
export const dshBin = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const baseHome = process.env.JG_DSH_HOME || join(dataDirPath(), 'dsh-home')
const workspace = process.env.JG_DSH_WORKSPACE || join(dataDirPath(), 'dsh-workspace')

export class HarnessError extends Error {
  constructor(message, { code = 'HARNESS_ERROR', status = 502, detail = null } = {}) {
    super(message)
    this.name = 'HarnessError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

let sdkPromise = null
// 每个沙箱根目录一个 Harness 进程：Work 用项目目录，Chat 用当前用户的托管根目录。
const active = new Map()
const MAX_ACTIVE_HARNESSES = 6

function keyOf({ apiKey, baseUrl, model, reasoningEffort, agentsHome, dshHome }) {
  return createHash('sha256').update(`${apiKey}|${baseUrl}|${model}|${reasoningEffort || ''}|${agentsHome || ''}|${dshHome || ''}`).digest('hex')
}

function runtimeEntryKey(cfg, cwd, scope = '') {
  const base = `${keyOf(cfg)}|${sandboxRootFor(cwd).toLowerCase()}`
  return scope ? `${base}|${String(scope)}` : base
}

function sandboxRootFor(cwd) {
  const target = String(cwd || '').trim()
  if (!target) return workspace
  const chatBase = join(dataDirPath(), 'dsh-workspaces', 'chat')
  const normalized = target.replace(/\\/g, '/')
  const chatBaseNormalized = chatBase.replace(/\\/g, '/')
  if (normalized.toLowerCase().startsWith(chatBaseNormalized.toLowerCase() + '/')) {
    // Chat：每个会话独占一个 Harness 运行时，取消时只关闭该会话的运行时，
    // 不波及其他会话；会话目录仍是真实执行 cwd。
    const rest = normalized.slice(chatBaseNormalized.length + 1).split('/').filter(Boolean)
    if (rest.length >= 2) return target
    return join(chatBase, rest[0] || 'default')
  }
  return target
}

function acquire(entry) {
  const next = entry.queue.then(() => undefined, () => undefined)
  let release
  entry.queue = new Promise((resolve) => { release = resolve })
  return next.then(() => () => release())
}

async function getHarness(cfg, handlers = null, cwd = '', runtimeScope = '') {
  const sandboxRoot = sandboxRootFor(cwd)
  const userHome = cfg.dshHome || baseHome
  const key = runtimeEntryKey(cfg, cwd, runtimeScope)
  if (active.has(key)) {
    const entry = active.get(key)
    entry.handlers = handlers
    entry.usedAt = Date.now()
    return entry.harness
  }
  if (active.size >= MAX_ACTIVE_HARNESSES) {
    // 只回收空闲运行时；正在跑 run 的条目如果被淘汰，会把用户正在执行的任务直接杀掉。
    const idle = [...active.entries()]
      .filter(([, entry]) => !entry.runs?.size)
      .sort((a, b) => a[1].usedAt - b[1].usedAt)[0]
    if (idle) {
      active.delete(idle[0])
      try { await idle[1].harness.close() } catch {}
    }
  }
  mkdirSync(userHome, { recursive: true })
  mkdirSync(sandboxRoot, { recursive: true })
  const { DeepSeekHarness } = await loadSdk()
  const env = { ...process.env, DEEPSEEK_API_KEY: cfg.apiKey }
  // 企业默认不外发遥测：DSH_TELEMETRY_DISABLED 任一值都会让启动器停用 OTel 行；
  // 同时把模式设为 DISABLED，避免 FEEDBACK_ONLY 默认指向公网 collector。
  if (env.DSH_TELEMETRY_DISABLED === undefined) env.DSH_TELEMETRY_DISABLED = '1'
  if (!env.DSH_TELEMETRY_MODE) env.DSH_TELEMETRY_MODE = 'DISABLED'
  if (cfg.baseUrl && cfg.baseUrl !== 'https://api.deepseek.com') env.DEEPSEEK_BASE_URL = cfg.baseUrl
  if (!env.JG_MCP_URL && env.PORT) env.JG_MCP_URL = `http://127.0.0.1:${env.PORT}`
  if (!env.JG_MCP_SCRIPT) env.JG_MCP_SCRIPT = join(root, 'mcp-jg.mjs')
  if (!env.JG_DSH_NODE) env.JG_DSH_NODE = process.execPath
  if (cfg.conversationId) env.JG_MCP_CONVERSATION = String(cfg.conversationId)
  if (cfg.agentsHome) {
    // 每个账号独立的 agent 配置根，skill-filesystem 会扫描其 skills 子目录；
    // 这样市场里按账号安装的技能只对该账号的运行时可见。
    mkdirSync(join(cfg.agentsHome, 'skills'), { recursive: true })
    env.DSH_AGENTS_HOME = cfg.agentsHome
  }
  if (!env.JG_MCP_DEBUG) env.JG_MCP_DEBUG = join(userHome, 'mcp-debug.log')
  const harness = new DeepSeekHarness({
    dshBin,
    dshHome: userHome,
    cwd: sandboxRoot,
    provider: 'deepseek-official',
    model: cfg.model || 'deepseek-flash',
    ...(cfg.reasoningEffort ? { reasoningEffort: cfg.reasoningEffort } : {}),
    maxTokens: 8192,
    initializeTimeoutMs: 90000,
    requestTimeoutMs: Number(process.env.JG_DSH_TIMEOUT_MS || 240000),
    env,
    ...(handlers ? {
      approvalRequests: typeof handlers.onApproval === 'function',
      onUserQuestion: typeof handlers.onQuestion === 'function' ? handlers.onQuestion : undefined,
    } : {}),
  })
  const entry = { key, home: userHome, harness, handlers, usedAt: Date.now(), queue: Promise.resolve(), toolCalls: new Map(), runs: new Map() }
  if (handlers && typeof handlers.onApproval === 'function') {
    // 必须先启动 client 再注册审批回调，否则 SDK 会把审批失败关闭为 unavailable。
    harness.client.start()
    harness.client.onRequest(async (method, params) => {
      if (method !== 'approval/request') throw new Error(`Unsupported request: ${method}`)
      // 审批请求本身不带工具参数；从同一 callId 的 tool/call 通知里补齐资源与参数。
      const call = params?.callId ? entry.toolCalls.get(String(params.callId)) : null
      const enriched = call
        ? { ...params, toolArgs: call.arguments, toolNameResolved: call.name }
        : params
      return entry.handlers?.onApproval ? entry.handlers.onApproval(enriched) : { outcome: 'cancelled' }
    })
    // 监听同一运行时内的 session.event，缓存 tool/call 的 name + arguments，供审批卡展示。
    const subscription = harness.client.subscribe((n) => n.method === 'session.event')
    entry.subscription = subscription
    ;(async () => {
      try {
        for await (const notification of subscription) {
          const event = notification?.params?.event
          if (!event || !event.type) continue
          if (event.type === 'tool/call' && event.data?.callId) {
            entry.toolCalls.set(String(event.data.callId), {
              name: String(event.data.name || '工具调用'),
              arguments: String(event.data.arguments || ''),
            })
            if (entry.toolCalls.size > 200) {
              const oldest = entry.toolCalls.keys().next().value
              if (oldest) entry.toolCalls.delete(oldest)
            }
          } else if (event.type === 'tool/result' && event.data?.message?.source?.callId) {
            entry.toolCalls.delete(String(event.data.message.source.callId))
          } else if (event.type === 'turn/end') {
            entry.toolCalls.clear()
          }
          // 把本轮真实事件交给产品层，用于“正在执行”实时状态；不改变 DSH 行为。
          if (typeof entry.handlers?.onEvent === 'function') {
            try { entry.handlers.onEvent(event, String(notification?.params?.sessionId || '')) } catch {}
          }        }
      } catch {}
    })()
  }
  active.set(key, entry)
  return harness
}

async function loadSdk() {
  if (!existsSync(sdkEntry)) {
    throw new HarnessError(
      'DeepSeek Harness 运行时尚未安装：缺少 dsh-runtime。请先安装 @deepseek-ai/dsh 与 @deepseek-ai/dsh-sdk-client。',
      { code: 'HARNESS_UNAVAILABLE', status: 503, detail: { expected: sdkEntry } },
    )
  }
  if (!sdkPromise) sdkPromise = import(pathToFileURL(sdkEntry).href)
  try {
    return await sdkPromise
  } catch (error) {
    sdkPromise = null
    throw new HarnessError(`DeepSeek Harness SDK 加载失败：${error?.message || error}`, {
      code: 'HARNESS_UNAVAILABLE', status: 503, detail: { expected: sdkEntry },
    })
  }
}

function textOf(message) {
  if (!message?.content) return ''
  return message.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
}

function blocksText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
}

function clip(value, max = 180) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function normalizeTodos(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => ({
      content: String(item?.content || '').trim(),
      status: ['pending', 'in_progress', 'completed'].includes(item?.status) ? item.status : 'pending',
    }))
    .filter((item) => item.content)
}

function todosOf(events) {
  let fromWrite = null
  let fromCall = null
  for (const event of (events || [])) {
    if (event?.type === 'todo/write') {
      fromWrite = normalizeTodos(event.data?.todos)
    } else if (event?.type === 'tool/call' && event.data?.name === 'todo_write') {
      try {
        const args = typeof event.data.arguments === 'string'
          ? JSON.parse(event.data.arguments)
          : event.data.arguments
        const todos = normalizeTodos(args?.todos)
        if (todos.length) fromCall = todos
      } catch {}
    }
  }
  return fromWrite || fromCall || []
}

function jobsOf(events) {
  const backgroundCalls = new Set()
  for (const event of (events || [])) {
    if (event?.type !== 'tool/call' || event.data?.name !== 'pwsh') continue
    let args = event.data.arguments
    if (typeof args === 'string') { try { args = JSON.parse(args) } catch { args = {} } }
    if (args && args.run_in_background === true) backgroundCalls.add(event.data.callId)
  }
  const byId = new Map()
  for (const event of (events || [])) {
    const data = event?.data
    if (!data) continue
    const callId = data.toolCall?.callId
    if (!backgroundCalls.has(callId)) continue
    if (event.type === 'job/registered' && data.jobId) {
      byId.set(data.jobId, {
        id: data.jobId,
        kind: data.kind || 'job',
        label: data.label || '',
        status: 'running',
        detail: '',
      })
    } else if (event.type === 'job/settled' && data.jobId) {
      const current = byId.get(data.jobId) || { id: data.jobId, kind: data.kind || 'job', label: data.label || '' }
      byId.set(data.jobId, {
        ...current,
        kind: data.kind || current.kind,
        label: data.label || current.label,
        status: data.status || 'completed',
        detail: data.detail || '',
      })
    }
  }
  if (byId.size) return [...byId.values()]
  const fallback = []
  for (const event of (events || [])) {
    if (event?.type !== 'tool/call' || event.data?.name !== 'pwsh') continue
    let args = event.data.arguments
    if (typeof args === 'string') { try { args = JSON.parse(args) } catch { args = {} } }
    if (!args || args.run_in_background !== true) continue
    fallback.push({
      id: event.data.callId || 'pwsh',
      kind: 'pwsh',
      label: args.description || args.command || '',
      status: '已启动',
      detail: '',
    })
  }
  return fallback
}

function deliverablesOf(events) {
  const files = []
  for (const event of (events || [])) {
    if (event?.type === 'deliverables/presented' && Array.isArray(event.data?.files)) {
      for (const file of event.data.files) {
        const path = String(file?.path || '').trim()
        if (!path) continue
        if (!files.some((f) => f.path === path)) {
          files.push({ path, description: String(file?.description || '') })
        }
      }
    }
  }
  return files
}

function parseToolPayload(text) {
  const value = String(text || '').trim()
  if (!value) return null
  try { return JSON.parse(value) } catch {}
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(value.slice(start, end + 1)) } catch { return null }
}

/** 从 Visual Engine 工具的 MCP 结果里取出可视化对象，交给产品消息层。 */
function visualsOf(events) {
  const rows = []
  const seen = new Set()
  const add = (visual) => {
    if (!visual || !visual.id) return
    const key = `${visual.id}:${visual.version || 1}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push(visual)
  }
  for (const event of (events || [])) {
    if (event?.type === 'tool/ptc-dispatch') {
      if (event.data?.isError) continue
      const payload = parseToolPayload(blocksText(event.data?.content) || String(event.data?.content || ''))
      if (!payload || payload.ok === false) continue
      const result = payload.result && typeof payload.result === 'object' ? payload.result : payload
      if (result.visual) add(result.visual)
      if (Array.isArray(result.visuals)) result.visuals.forEach(add)
      continue
    }
    if (event?.type !== 'tool/result' || event.data?.error) continue
    const payload = parseToolPayload(textOf(event.data?.message))
    if (!payload || payload.ok === false) continue
    const result = payload.result && typeof payload.result === 'object' ? payload.result : payload
    if (result.visual) add(result.visual)
    if (Array.isArray(result.visuals)) result.visuals.forEach(add)
  }
  return rows
}

function usageOf(events) {
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, calls: 0 }
  for (const event of (events || [])) {
    if (event?.type !== 'assistant/message') continue
    const item = event.data?.usage
    if (!item) continue
    usage.calls += 1
    for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens']) {
      const value = Number(item[key])
      if (Number.isFinite(value)) usage[key] += value
    }
  }
  if (!usage.calls) return null
  if (!usage.totalTokens) usage.totalTokens = usage.inputTokens + usage.outputTokens
  return usage
}

function titleOf(events) {
  let title = ''
  for (const event of (events || [])) {
    if (event?.type === 'session/title') {
      const value = String(event.data?.title || '').trim()
      if (value) title = value
    }
  }
  return title
}

function stepsOf(events, notifications, model, latencyMs) {
  const steps = [{ tool: '模型网关', detail: `${model} · ${latencyMs} ms · DeepSeek Harness`, status: 'ok', ms: Math.min(3000, latencyMs) }]
  const pending = new Map()
  const subagents = new Map()
  for (const event of events) {
    if (event?.type === 'tool/call') {
      const item = { tool: event.data?.name || '工具', detail: clip(event.data?.arguments), status: 'ok', ms: 0 }
      pending.set(event.data?.callId, item)
      steps.push(item)
    } else if (event?.type === 'tool/result') {
      const item = pending.get(event.data?.toolCallId)
      if (item) {
        const out = textOf(event.data?.message)
        if (out) item.detail = clip(out)
        if (event.data?.error) {
          item.status = 'fail'
          item.detail = clip(event.data.error.reason || event.data.error.code || out)
        }
      }
    } else if (event?.type === 'plan/mode') {
      steps.push({ tool: '计划模式', detail: event.data?.active ? '已进入，等待计划确认' : '已退出', status: 'ok', ms: 0 })
    } else if (event?.type === 'compaction/start') {
      steps.push({ tool: '上下文压缩', detail: '开始压缩历史上下文', status: 'ok', ms: 0 })
    } else if (event?.type === 'compaction/end') {
      steps.push({ tool: '上下文压缩', detail: '压缩完成', status: 'ok', ms: 0 })
    }
  }
  for (const n of (notifications || [])) {
    if (n?.method === 'subagent.started') {
      const item = { tool: '子代理', detail: `子会话 ${clip(n.params?.childSessionId, 80)} 启动`, status: 'ok', ms: 0, kind: 'subagent', childSessionId: n.params?.childSessionId }
      subagents.set(n.params?.childSessionId, item)
      steps.push(item)
    } else if (n?.method === 'subagent.finished') {
      const item = subagents.get(n.params?.childSessionId)
      if (item) {
        item.status = n.params?.status === 'error' ? 'fail' : 'ok'
        item.provider = n.params?.provider || '子代理'
        item.stopReason = n.params?.stopReason || ''
        item.output = blocksText(n.params?.lastAssistantMessage)
        item.detail = `${item.provider} · ${n.params?.status || 'ok'} · ${item.stopReason}`.trim()
      }
    }
  }
  return steps.slice(0, 80)
}

/** 只保留根会话及其后代子会话的通知，避免把同一运行时里其他会话的子代理算进来。 */
function relevantSubagentNotifications(rootId, notifications) {
  const children = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const n of (notifications || [])) {
      if (n?.method !== 'subagent.started') continue
      const parent = String(n.params?.parentSessionId || '')
      const child = String(n.params?.childSessionId || '')
      if (!child || children.has(child)) continue
      if (parent === rootId || children.has(parent)) {
        children.add(child)
        changed = true
      }
    }
  }
  return (notifications || []).filter((n) => children.has(String(n?.params?.childSessionId || '')))
}

/** 工作流阶段与节点：从 tool-workflow 的持久事件还原运行结构。 */
function workflowsOf(events) {
  const runs = new Map()
  const members = new Map()
  for (const event of (events || [])) {
    const data = event?.data || {}
    if (event?.type === 'tool-workflow/run-start') {
      runs.set(String(data.runId), { runId: String(data.runId), name: String(data.name || '工作流'), status: 'running', stopReason: '', members: [] })
    } else if (event?.type === 'tool-workflow/agent-start') {
      const run = runs.get(String(data.runId))
      if (!run) continue
      const member = {
        seq: Number(data.seq) || 0,
        label: String(data.label || `节点 ${data.seq || ''}`),
        phase: String(data.phase || '未分阶段'),
        childId: String(data.childId || ''),
        status: 'running',
      }
      run.members.push(member)
      members.set(`${data.runId}:${data.seq}`, member)
    } else if (event?.type === 'tool-workflow/agent-end') {
      const member = members.get(`${data.runId}:${data.seq}`)
      if (member) member.status = String(data.outcome || 'completed')
    } else if (event?.type === 'tool-workflow/run-end') {
      const run = runs.get(String(data.runId))
      if (run) {
        run.status = String(data.stopReason || 'completed')
        run.stopReason = String(data.stopReason || '')
      }
    }
  }
  return [...runs.values()].map((run) => ({
    ...run,
    members: run.members.slice().sort((a, b) => a.seq - b.seq),
  }))
}

/** 子代理运行摘要 + 子代理最终正文，独立于执行步骤，供消息块展示。 */
function subagentsOf(notifications, tasks = []) {
  const rows = new Map()
  for (const n of (notifications || [])) {
    if (n?.method === 'subagent.started') {
      const childSessionId = String(n.params?.childSessionId || '')
      if (!childSessionId) continue
      rows.set(childSessionId, {
        childSessionId,
        provider: '子代理',
        status: 'running',
        stopReason: '',
        output: '',
        name: '',
        task: '',
      })
    } else if (n?.method === 'subagent.finished') {
      const childSessionId = String(n.params?.childSessionId || '')
      if (!childSessionId) continue
      const row = rows.get(childSessionId) || { childSessionId, provider: '子代理', status: 'ok', stopReason: '', output: '', name: '', task: '' }
      row.provider = n.params?.provider || row.provider
      row.status = n.params?.status || row.status
      row.stopReason = n.params?.stopReason || ''
      row.output = blocksText(n.params?.lastAssistantMessage)
      rows.set(childSessionId, row)
    }
  }
  const list = [...rows.values()]
  list.forEach((row, index) => {
    const task = tasks[index]
    if (!task) return
    if (task.name) row.name = task.name
    if (task.task) row.task = task.task
  })
  return list
}

/** 从 run_code 审计中提取 spawn_teammate 的名称与任务说明，按启动顺序映射到子代理。 */
function subagentTasksOf(audit = []) {
  const rows = []
  for (const item of (audit || [])) {
    const detail = String(item?.detail || '')
    if (!/spawn_teammate|spawn_subagent|spawn_agent/i.test(detail)) continue
    let parsed = {}
    try { parsed = JSON.parse(detail) || {} } catch {}
    // audit detail 会在 800 字符处截断，截断后的 JSON 无法解析；
    // 因此对原始文本先还原转义引号，再按字段正则提取，避免任务板永远显示 spawn。
    const text = String(parsed.code || detail).replace(/\\n/g, '\n').replace(/\\"/g, '"')
    const name = text.match(/name\s*:\s*["'`]([^"'`]+)/)?.[1] || ''
    const task = text.match(/description\s*:\s*["'`]([^"'`]+)/)?.[1] || String(parsed.description || '')
    if (name || task) rows.push({ name, task })
  }
  return rows
}

function auditOf(events) {
  const pending = new Map()
  const rows = []
  for (const event of events || []) {
    if (event?.type === 'tool/call') {
      const row = {
        tool: event.data?.name || '工具',
        callId: event.data?.callId || '',
        detail: clip(event.data?.arguments, 800),
        status: 'ok',
      }
      pending.set(event.data?.callId, row)
      rows.push(row)
    } else if (event?.type === 'tool/result') {
      const row = pending.get(event.data?.toolCallId)
      if (row) {
        const out = textOf(event.data?.message)
        if (out) row.detail = `${row.detail}\n=> ${clip(out, 1200)}`.trim()
        if (event.data?.error) {
          row.status = 'fail'
          row.detail = `${row.detail}\n!! ${clip(event.data.error.reason || event.data.error.code || 'error', 300)}`.trim()
        }
      }
    }
  }
  return rows
}

function modelOf(events, fallback) {
  for (const event of events) {
    if (event?.type === 'request/context' && event.data?.model) return event.data.model
    if (event?.type === 'request/header' && event.data?.header?.config?.model) return event.data.header.config.model
  }
  return fallback
}

/**
 * 直接调用 DSH 运行时的 typert 服务（如 pluginManager/listPlugins）。
 * 用于插件运行时管理这类不经过模型轮次、但影响 profile 的控制面操作。
 */
export async function runtimeRequest(method, params = {}, cfg = {}) {
  const harness = await getHarness({
    apiKey: cfg.apiKey || 'runtime-admin',
    baseUrl: cfg.baseUrl || '',
    model: cfg.model || 'deepseek-flash',
    reasoningEffort: '',
  }, null, cfg.cwd || '')
  return harness.client.request(method, params)
}

/**
 * 在 DSH 会话中运行一轮 agent。已存在 dshSessionId 时续用同一会话，
 * 不存在时自动创建新会话并返回 id。
 */
export async function runAgent({ apiKey, baseUrl, model, text, sessionId, context, images, handlers, reasoningEffort, cwd, agentsHome = '', dshHome = '', executionPolicy = 'auto', permissionPreset = '', runKey = '', runtimeScope = '', maxToolCalls = 0, onStart = null, shouldCancel = null }) {
  if (!apiKey) throw new HarnessError('没有可用的模型密钥', { code: 'MODEL_KEY_MISSING', status: 503 })
  const effort = ['off', 'low', 'medium', 'high', 'max'].includes(String(reasoningEffort || '')) ? String(reasoningEffort) : ''
  const cfg = { apiKey, baseUrl, model, reasoningEffort: effort, agentsHome, dshHome, conversationId: String(runKey || '') }
  const budget = { limit: Math.max(0, Number(maxToolCalls) || 0), count: 0, exceeded: false }
  let harnessRef = null
  const guardedHandlers = handlers && budget.limit
    ? {
        ...handlers,
        onEvent: (event, sid) => {
          if (event?.type === 'tool/call') budget.count += 1
          if (!budget.exceeded && budget.count > budget.limit) {
            budget.exceeded = true
            try { harnessRef?.client?.request('session/cancel', { sessionId: String(sid || '') }) } catch {}
          }
          try { handlers.onEvent?.(event, sid) } catch {}
        },
      }
    : handlers
  const harness = await getHarness(cfg, guardedHandlers, cwd, runtimeScope)
  harnessRef = harness
  const entryKey = runtimeEntryKey(cfg, cwd, runtimeScope)
  const entry = active.get(entryKey)
  const release = entry ? await acquire(entry) : () => {}
  // 先占位，避免会话初始化期间被“回收空闲运行时”误判为空闲；拿到 SDK session 后再补 id。
  if (entry && runKey) entry.runs.set(String(runKey), { sessionId: '', startedAt: Date.now() })
  // 父会话 idle 时子代理可能还在跑；单独订阅运行时通知，补齐后续的 subagent.finished 正文。
  const backgroundNotifications = []
  const subagentSubscription = harness.client?.subscribe((n) => n.method === 'subagent.started' || n.method === 'subagent.finished')
  const subagentPump = subagentSubscription
    ? (async () => {
        try {
          for await (const notification of subagentSubscription) backgroundNotifications.push(notification)
        } catch {}
      })()
    : Promise.resolve()
  if (entry) {
    entry.toolCalls.clear()
  }
  let promptText = String(text || '')
  let planActivate = false
  // `/plan <message>` 在 SDK 命令路由里只做 steer，命令自身不开始模型轮次；
  // 这里先原生激活计划模式，再把正文作为普通请求提交，避免首轮卡住。
  const planCommand = /^\/plan\s+([\s\S]+)$/.exec(promptText.trim())
  if (planCommand && planCommand[1].trim() !== 'off') {
    planActivate = true
    promptText = planCommand[1].trim()
  }
  const command = /^\/[a-zA-Z][\w-]*(\s|$)/.test(promptText.trim())
  const body = command || !context ? promptText : `${context}\n\n---\n\n用户请求：${promptText}`
  const input = Array.isArray(images) && images.length
    ? [{ type: 'text', text: body }, ...images]
    : body
  const started = Date.now()
  let result
  const settleSubagents = async () => {
    const rootId = String(result?.sessionId || '')
    if (!rootId) return
    const current = () => relevantSubagentNotifications(rootId, [...backgroundNotifications, ...(result?.notifications || [])])
    const startedIds = new Set(current().filter((n) => n.method === 'subagent.started').map((n) => String(n.params?.childSessionId || '')))
    const deadline = Date.now() + 45000
    while (startedIds.size) {
      const finishedIds = new Set(current().filter((n) => n.method === 'subagent.finished').map((n) => String(n.params?.childSessionId || '')))
      if ([...startedIds].every((id) => finishedIds.has(id))) break
      if (Date.now() >= deadline) break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
  const resolvedPermissionPreset = permissionPreset || (executionPolicy === 'auto' ? 'workspace-write' : 'read-only')
  try {
    let session
    if (sessionId) {
      try {
        // resumeSession 会从 DSH_HOME 恢复历史；直接 run(sessionId) 只能复用当前进程内的会话。
        session = await harness.resumeSession(sessionId)
      } catch (resumeError) {
        // 当前进程已持有该会话时 resumeSession 会报 occupied，直接用内存会话续跑。
        session = harness.session(sessionId)
      }
    } else {
      session = harness.session()
    }
    // 通过 DSH 原生 Session Working Directory 绑定真实执行目录。
    if (cwd) await session.setWorkingDirectory(cwd)
    // DSH 原生权限预设：Auto 使用 workspace-write 沙箱，工作区内读写/测试/构建由沙箱直接放行；
    // 越界、外部写入和权限升级仍由 DSH 的 approval/request 升级到产品审批。手动模式保持 read-only。
    await session.run(`/permission ${resolvedPermissionPreset}`)
    if (planActivate) await session.run('/plan')
    // 记录本轮正在执行的 SDK 会话，供产品按会话调用原生 session/cancel。
    if (entry && runKey) entry.runs.set(String(runKey), { sessionId: String(session.id), startedAt: Date.now() })
    if (typeof onStart === 'function') onStart(String(session.id))
    if (typeof shouldCancel === 'function' && shouldCancel()) {
      throw new HarnessError('用户已停止本轮执行', { code: 'RUN_CANCELLED', status: 409 })
    }
    result = await session.run(input)
    await settleSubagents()
  } catch (error) {
    if (budget.exceeded) throw new HarnessError(`本轮工具调用超过预算 ${budget.limit} 步，已停止执行。请缩小任务范围或提高预算后重试。`, { code: 'STEP_BUDGET_EXCEEDED', status: 409 })
    // 用户已停止本轮：不再因为“会话不存在”之类的错误自动新建会话重试。
    if (error?.code === 'RUN_CANCELLED' || (typeof shouldCancel === 'function' && shouldCancel())) {
      throw error?.code === 'RUN_CANCELLED'
        ? error
        : new HarnessError('用户已停止本轮执行', { code: 'RUN_CANCELLED', status: 409 })
    }
    if (sessionId) {
      // 会话可能已被清理或来自旧 DSH_HOME；退回新会话，不丢当前输入。
      try {
        const session = harness.session()
        if (cwd) await session.setWorkingDirectory(cwd)
        await session.run(`/permission ${resolvedPermissionPreset}`)
        if (planActivate) await session.run('/plan')
        if (entry && runKey) entry.runs.set(String(runKey), { sessionId: String(session.id), startedAt: Date.now() })
        if (typeof onStart === 'function') onStart(String(session.id))
        result = await session.run(input)
        await settleSubagents()
      } catch (retryError) {
        throw wrap(retryError)
      }
    } else {
      throw wrap(error)
    }
  } finally {
    if (entry && runKey) entry.runs.delete(String(runKey))
    try { subagentSubscription?.close?.() } catch {}
    try { await subagentPump } catch {}
    release()
  }
  const latencyMs = Date.now() - started
  if (budget.exceeded) throw new HarnessError(`本轮工具调用超过预算 ${budget.limit} 步，已停止执行。请缩小任务范围或提高预算后重试。`, { code: 'STEP_BUDGET_EXCEEDED', status: 409 })
  const actualModel = modelOf(result.events || [], model)
  const reply = (result.finalResponse || '').trim() || '任务已完成。'
  const subagentNotifs = relevantSubagentNotifications(String(result.sessionId || ''), [...backgroundNotifications, ...(result.notifications || [])])
  const audit = auditOf(result.events || [])
  return {
    reply,
    sessionId: result.sessionId,
    model: actualModel,
    latencyMs,
    steps: stepsOf(result.events || [], result.notifications || [], actualModel, latencyMs),
    subagents: subagentsOf(subagentNotifs, subagentTasksOf(audit)),
    workflows: workflowsOf(result.events || []),
    todos: todosOf(result.events || []),
    usage: usageOf(result.events || []),
    title: titleOf(result.events || []),
    jobs: jobsOf(result.events || []),
    deliverables: deliverablesOf(result.events || []),
    visuals: visualsOf(result.events || []),
    toolAudit: audit,
    finishReason: result.finishReason,
    events: result.events || [],
    notifications: result.notifications || [],
  }
}

function wrap(error) {
  if (error instanceof HarnessError) return error
  const message = error?.message || String(error)
  const code = /credential|api key|401|unauthorized/i.test(message)
    ? 'MODEL_AUTH_FAILED'
    : /timeout/i.test(message) ? 'MODEL_TIMEOUT' : 'HARNESS_ERROR'
  return new HarnessError(`DeepSeek Harness 执行失败：${message}`, {
    code, status: code === 'MODEL_TIMEOUT' ? 504 : 502,
  })
}

/**
 * SDK 协议没有 job/kill；后台作业归属 Harness 进程，停止该沙箱根的运行时
 * 即可终止其全部后台作业。调用方必须先确认同目录没有其他会话在执行。
 */
export async function stopBackgroundRuntime(cwd) {
  const root = sandboxRootFor(cwd).toLowerCase()
  const targets = [...active.entries()].filter(([key]) => key.toLowerCase().endsWith(`|${root}`))
  if (!targets.length) throw new HarnessError('该项目当前没有活跃的 Harness 运行时', { code: 'JOB_NO_RUNTIME', status: 409 })
  for (const [key, entry] of targets) {
    active.delete(key)
    try { await entry.harness.close() } catch {}
  }
  return targets.length
}

export async function closeHarness() {
  const current = [...active.values()]
  active.clear()
  await Promise.all(current.map((entry) => entry.harness.close().catch(() => {})))
}

/** 只关闭某个账号的 DSH_HOME 对应的运行时，供该账号安装/卸载 Bundle 后重载。 */
export async function closeHarnessForHome(home) {
  const normalized = String(home || '').replace(/\\/g, '/').toLowerCase()
  const targets = [...active.entries()].filter(([, entry]) => String(entry.home || '').replace(/\\/g, '/').toLowerCase() === normalized)
  for (const [key, entry] of targets) {
    active.delete(key)
    try { await entry.harness.close() } catch {}
  }
  return targets.length
}

/**
 * 通过 DSH 原生 session/cancel 取消某一轮 Agent，不关闭运行时、不影响其他会话。
 * runKey 为产品侧会话 id；只有当前进程里正在执行才能拿到 SDK session id。
 */
export async function cancelRun(runKey) {
  // 按产品侧 runKey（会话 id）定位正在执行的运行时，而不是按 cwd 批量匹配；
  // Work 会话共享项目目录时也能只命中当前会话的运行时。
  const targets = [...active.entries()].filter(([, entry]) => entry.runs?.has(String(runKey)))
  for (const [key, entry] of targets) {
    const run = entry.runs?.get(String(runKey))
    if (!run) continue
    if (!run.sessionId) {
      // 会话还没完成初始化：没有可调用的原生 session/cancel，只能关闭该会话运行时。
      active.delete(key)
      try { await entry.harness.close() } catch {}
      return { accepted: true, native: false, runtimeClosed: true, sessionId: '' }
    }
    try {
      await entry.harness.client.request('session/cancel', { sessionId: run.sessionId })
      return { accepted: true, native: true, sessionId: run.sessionId }
    } catch (error) {
      // 当前 SDK 运行时没有暴露 session/cancel；关闭该会话独占的运行时，
      // 让 session.run 立即结束，而不是等模型自己跑完。
      if (/unknown .* method|not supported|session\/cancel/i.test(error?.message || '')) {
        active.delete(key)
        try { await entry.harness.close() } catch {}
        return { accepted: true, native: false, runtimeClosed: true, sessionId: run.sessionId }
      }
      throw new HarnessError(`DSH 会话取消失败：${error?.message || error}`, { code: 'SESSION_CANCEL_FAILED', status: 502 })
    }
  }
  throw new HarnessError('当前会话没有正在执行的 DSH 回合', { code: 'SESSION_NOT_RUNNING', status: 409 })
}
