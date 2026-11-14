/**
 * 审批卡元数据
 *
 * 是否自动放行由 DSH 原生权限预设决定：
 * - Auto：workspace-write 沙箱，工作区内读写/测试/构建直接执行；越界、外部写入和权限升级由 DSH 发 approval/request。
 * - 手动：read-only 沙箱，需要写入或执行时由 DSH 发 approval/request。
 *
 * 本文件不决定 allow/deny，只把一次工具调用翻译成操作类型、风险级别和参数摘要，
 * 供审批卡展示与 approval_decisions 审计落库使用。
 */
import { isAbsolute, join, normalize } from 'node:path'

const READ_TOOL = [
  /^(read|read_file|fs_read|read_text|cat|list|ls|dir|glob|grep|search|find|stat|tree|view|inspect|fetch)$/i,
  /(?:^|__)(?:drive_search|drive_read|notice_list|notice_read|academy_search|contacts_find|resource_query|notebook_search|session_search|session_query|web_search|web_fetch|search|read|list|find|query)$/i,
]

const LOW_RISK_TOOL = [
  /^(present|present_files|todo|todo_write|update_plan|write_todos|goal|time|skill|user_question|ask_user|file_reference|deliverable)$/i,
]

const WRITE_TOOL = [
  /^(write|write_file|fs_write|edit|edit_file|apply_patch|create|create_file|mkdir|touch|append|save|put)$/i,
]

const DELETE_TOOL = [
  /(?:^|[_-])(delete|remove|unlink|trash|rm)(?:$|[_-])/i,
]

const MOVE_TOOL = [
  /(?:^|[_-])(move|rename|mv|copy|cp)(?:$|[_-])/i,
]

const EXEC_TOOL = [
  /^(bash|sh|shell|pwsh|powershell|exec|run|command|terminal|job|process)$/i,
]

function clip(value, max = 300) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function parseArgs(raw) {
  if (raw && typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw || '{}')) || {}
  } catch {
    return {}
  }
}

function targetFromArgs(args = {}) {
  return String(
    args.path || args.file_path || args.filePath || args.cwd ||
    args.directory || args.dir || args.target || ''
  )
}

function commandFromArgs(args = {}) {
  return [args.command, args.cmd, args.script].filter(Boolean).map(String).join('\n')
}

function absoluteTarget(target, cwd) {
  const raw = String(target || '').trim()
  if (!raw) return ''
  if (isAbsolute(raw)) return normalize(raw)
  if (!cwd) return ''
  return normalize(join(String(cwd), raw))
}

export function classifyOperation(tool, args = {}) {
  const name = String(tool || '')
  const parsed = parseArgs(args)
  if (commandFromArgs(parsed)) return 'execute'
  if (DELETE_TOOL.some((re) => re.test(name))) return 'delete'
  if (MOVE_TOOL.some((re) => re.test(name))) return 'move'
  if (EXEC_TOOL.some((re) => re.test(name))) return 'execute'
  if (WRITE_TOOL.some((re) => re.test(name))) return 'write'
  if (READ_TOOL.some((re) => re.test(name))) return 'read'
  if (LOW_RISK_TOOL.some((re) => re.test(name))) return 'read'
  if (parsed.old_string !== undefined || parsed.new_string !== undefined) return 'edit'
  if (parsed.content !== undefined && targetFromArgs(parsed)) return 'write'
  if (parsed.source && parsed.destination) return 'move'
  return 'unknown'
}

export function summarizeToolCall(tool, args = {}) {
  const parsed = parseArgs(args)
  const target = targetFromArgs(parsed)
  const command = commandFromArgs(parsed)
  const text = String(parsed.text || parsed.message || '')
  const title = String(parsed.title || '')
  const query = String(parsed.q || parsed.query || parsed.search || '')
  const url = String(parsed.url || parsed.uri || '')
  const parts = []
  if (target) parts.push(`目标：${clip(target, 180)}`)
  if (command) parts.push(`命令：${clip(command, 220)}`)
  if (text && !command) parts.push(`内容：${clip(text, 160)}`)
  if (title) parts.push(`标题：${clip(title, 120)}`)
  if (query) parts.push(`查询：${clip(query, 100)}`)
  if (url) parts.push(`地址：${clip(url, 180)}`)
  if (parsed.content !== undefined) parts.push(`写入 ${String(parsed.content).length} 字符`)
  if (parsed.old_string !== undefined || parsed.new_string !== undefined) {
    parts.push(`替换 ${String(parsed.old_string || '').length} → ${String(parsed.new_string || '').length} 字符`)
  }
  if (parsed.source && parsed.destination) {
    parts.push(`从 ${clip(parsed.source, 100)} 到 ${clip(parsed.destination, 100)}`)
  }
  if (!parts.length) parts.push(`${String(tool || '工具调用')} 未提供可展示参数`)
  return parts.join('；')
}

/**
 * 生成审批卡和审计所需的风险元数据，不做 allow/deny 判断。
 * 风险级别只用于展示与事后审计：读 low；写入/编辑/未知 medium；删除/移动/命令/外部写 high。
 */
export function describeToolCall({ tool, args, cwd = '', isExternalSideEffect = false }) {
  const name = String(tool || '')
  const parsed = parseArgs(args)
  const operation = isExternalSideEffect ? 'external-write' : classifyOperation(name, parsed)
  const target = absoluteTarget(targetFromArgs(parsed), cwd)
  const command = commandFromArgs(parsed)
  const summary = summarizeToolCall(name, parsed)

  let risk = 'medium'
  if (!name || isExternalSideEffect || operation === 'delete' || operation === 'move' || operation === 'execute' || operation === 'external-write') {
    risk = 'high'
  } else if (operation === 'read') {
    risk = 'low'
  }

  return { operation, risk, target, command, summary }
}
