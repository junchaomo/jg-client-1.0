/**
 * AS 应用能力契约：只做声明解析与静态校验，不执行应用代码。
 * tools/resources 都是应用自己提供的 HTTP 能力描述；AS 只负责按账号代理调用。
 */
const TOOL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/
const METHODS = new Set(['GET', 'POST'])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePath(value) {
  const path = String(value || '').trim()
  if (!path || !path.startsWith('/') || path.includes('..') || path.includes('://')) return ''
  if (path.includes('?') || path.includes('#')) return ''
  return path
}

function normalizeEntry(raw, kind, index, issues, seen) {
  if (!isPlainObject(raw)) {
    issues.push(`${kind}[${index}] 不是对象`)
    return null
  }
  const before = issues.length
  const name = String(raw.name || '').trim()
  if (!TOOL_NAME_RE.test(name)) issues.push(`${kind}[${index}] name 非法`)
  if (!name || seen.has(name)) issues.push(`${kind}[${index}] name 重复或为空：${name}`)
  if (name) seen.add(name)
  const method = String(raw.method || 'GET').trim().toUpperCase()
  if (!METHODS.has(method)) issues.push(`${kind}[${index}] method 只支持 GET/POST：${method}`)
  const path = normalizePath(raw.path)
  if (!path) issues.push(`${kind}[${index}] path 必须是应用内绝对路径，且不能包含 .. / ? / #`)
  const inputSchema = raw.inputSchema == null ? { type: 'object', properties: {} } : raw.inputSchema
  if (!isPlainObject(inputSchema)) issues.push(`${kind}[${index}] inputSchema 必须是对象`)
  const timeoutMs = Number(raw.timeoutMs || 15000)
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) issues.push(`${kind}[${index}] timeoutMs 超出 1–60 秒`)
  if (issues.length > before) return null
  return {
    name,
    description: String(raw.description || '').trim(),
    method,
    path,
    inputSchema,
    outputSchema: isPlainObject(raw.outputSchema) ? raw.outputSchema : null,
    timeoutMs: Math.max(1000, Math.min(60000, timeoutMs)),
    sideEffect: raw.sideEffect === true,
  }
}

export function normalizeAppCapabilities(manifest) {
  const app = isPlainObject(manifest) ? manifest : {}
  const raw = app.capabilities
  const issues = []
  const tools = []
  const resources = []
  if (raw == null) {
    return { declared: false, tools, resources, issues, verdict: '未声明', note: 'app.json 未声明 capabilities；应用可运行，但暂不能被中枢 AI 调用' }
  }
  if (!isPlainObject(raw)) {
    issues.push('capabilities 必须是对象')
    return { declared: true, tools, resources, issues, verdict: '不通过', note: issues.join('；') }
  }
  const seenTools = new Set()
  const seenResources = new Set()
  if (raw.tools != null && !Array.isArray(raw.tools)) issues.push('capabilities.tools 必须是数组')
  if (raw.resources != null && !Array.isArray(raw.resources)) issues.push('capabilities.resources 必须是数组')
  for (const [index, item] of (Array.isArray(raw.tools) ? raw.tools : []).entries()) {
    const entry = normalizeEntry(item, 'tools', index, issues, seenTools)
    if (entry) tools.push(entry)
  }
  for (const [index, item] of (Array.isArray(raw.resources) ? raw.resources : []).entries()) {
    const entry = normalizeEntry(item, 'resources', index, issues, seenResources)
    if (entry) resources.push({ ...entry, method: 'GET' })
  }
  if (!tools.length && !resources.length) issues.push('capabilities 未声明任何 tools/resources')
  return {
    declared: true,
    tools,
    resources,
    issues,
    verdict: issues.length ? '不通过' : '通过',
    note: issues.length ? issues.join('；') : `已声明 ${tools.length} 个工具、${resources.length} 个资源`,
  }
}
