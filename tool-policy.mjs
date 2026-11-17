/**
 * 本轮工具可见性策略。
 *
 * Chat 与 Work 都只做“本轮可见工具”收窄，不改变工具实现和权限：
 * - Chat：核心读写/检索/格式工具，按意图追加视觉与日程；
 * - Work：核心工具 + 按任务类型追加代码、插件、视觉、日程、业务 MCP 工具组。
 *
 * 这里只返回 DSH 插件使用的策略字符串，真正的 tools.restrict() 在
 * plugins/jg-tool-router 的 agent/pre-step 中执行。
 */

export const CHAT_CORE_TOOLS = [
  'read', 'read_image', 'write', 'edit', 'apply_patch', 'glob', 'grep',
  'present', 'ask_user_question', 'todo_write', 'skill', 'working_directory', 'pwsh',
  'session_search',
  'web_fetch',
  'mcp__jg__drive_read', 'mcp__jg__drive_search',
  'mcp__jg__format_capabilities', 'mcp__jg__format_export', 'mcp__jg__format_extract', 'mcp__jg__format_inspect',
  'mcp__jg__resource_query', 'mcp__jg__task_create',
]

export const CHAT_VISUAL_TOOLS = [
  'mcp__jg__visual_create', 'mcp__jg__visual_get', 'mcp__jg__visual_update', 'mcp__jg__visual_save', 'mcp__jg__visual_export',
]

export const CHAT_SCHEDULE_TOOLS = ['schedule_create', 'schedule_edit', 'schedule_list', 'schedule_view']

/**
 * Work 核心工具：无论任务类型都必须可见。
 * 覆盖文件读写、命令执行、检索、格式处理、资源查询、任务创建、目标与工作流。
 */
export const WORK_CORE_TOOLS = [
  'read', 'read_image', 'write', 'edit', 'apply_patch', 'glob', 'grep',
  'present', 'ask_user_question', 'todo_write', 'skill', 'working_directory', 'pwsh',
  'session_search', 'web_fetch', 'workflow', 'create_goal', 'update_goal',
  'mcp__jg__drive_read', 'mcp__jg__drive_search',
  'mcp__jg__format_capabilities', 'mcp__jg__format_export', 'mcp__jg__format_extract', 'mcp__jg__format_inspect',
  'mcp__jg__resource_query', 'mcp__jg__task_create',
]

export const WORK_CODE_TOOLS = [
  'create_worktree', 'job_kill', 'job_output', 'plugin_manager',
  'terminal_close', 'terminal_open', 'terminal_read', 'terminal_send', 'terminal_signal',
]

export const WORK_VISUAL_TOOLS = [
  'mcp__jg__visual_create', 'mcp__jg__visual_get', 'mcp__jg__visual_update', 'mcp__jg__visual_save', 'mcp__jg__visual_export',
]

export const WORK_SCHEDULE_TOOLS = ['schedule_create', 'schedule_edit', 'schedule_list', 'schedule_view']
export const WORK_SCHEDULE_READ_TOOLS = ['schedule_list', 'schedule_view']

export const WORK_APP_TOOLS = ['mcp__jg__app_call']
export const WORK_REVIEW_TOOLS = ['mcp__jg__code_review']
export const WORK_CONTACT_TOOLS = ['mcp__jg__contacts_find']
export const WORK_ACADEMY_TOOLS = ['mcp__jg__academy_search']
export const WORK_NOTICE_TOOLS = ['mcp__jg__notice_list', 'mcp__jg__notice_read']
export const WORK_NOTEBOOK_TOOLS = ['mcp__jg__notebook_search']
export const WORK_IM_TOOLS = ['mcp__jg__im_send']
export const WORK_TRACE_TOOLS = ['session_event_read', 'session_event_search', 'session_event_trace', 'session_trace']
export const WORK_MCP_RESOURCE_TOOLS = ['list_mcp_resource_templates', 'list_mcp_resources', 'read_mcp_resource']

const WORK_CODE_RE = /写[^。\n]{0,12}(代码|脚本|函数|程序|工具|插件)|改[^。\n]{0,12}(代码|脚本|函数|程序)|创建[^。\n]{0,12}(脚本|程序|插件|工具)|生成[^。\n]{0,12}(代码|脚本|程序|插件)|运行|执行|编译|构建|部署|安装|调试|测试|重构|打包|发布(?:代码|脚本|程序|插件|版本)|上传(?:代码|脚本|程序|插件)|worktree|工作树|npm|pnpm|node\b|python\b|pip\b|git\b|pwsh|powershell|apply_patch|代码|脚本|插件/i
const WORK_CODE_WRITE_RE = /修改|修复|编写|创建|生成|运行|执行|编译|构建|部署|安装|调试|测试|重构|打包|发布|上传|删除|替换|写入|保存/i
const WORK_READONLY_RE = /只读|不要修改|不修改|仅检查|检查|查看|说明|职责|入口|结构|分析|审查|review|diff/i
const NEGATED_ACTION_RE = /(?:不要|不|无需|禁止)(?:修改|修复|编写|创建|生成|运行|执行|编译|构建|部署|安装|调试|测试|重构|打包|发布|上传|删除|替换|写入|保存)/g
const WORK_DOC_RE = /文档|报告|PPT|Word|Excel|表格|CSV|Markdown|PDF|幻灯片|排版|导出|格式转换|公文|汇报/i
const WORK_DATA_RE = /数据|统计|汇总|分析|清洗|合并|拆分|日志|GIS|shp|gdb|地理|空间|图层|地图|坐标|爬取|抓取/i
const WORK_VISUAL_RE = /画图|画个|图表|流程图|架构图|关系图|统计图|示意图|可视化|信息图|海报|视觉|配图|mermaid|echarts|svg/i
const WORK_SCHEDULE_RE = /日程|提醒|定时|每天|每周|每月|每年|预约|schedule/i
const WORK_SCHEDULE_WRITE_RE = /创建|新建|安排|添加|修改|编辑|调整|删除|取消|提醒我|定时|每天|每周|每月|每年|预约/i
const SCHEDULE_READ_QUERY_RE = /是否有安排|有什么安排|有哪些安排|有没有安排|有无安排|日程安排/g
const NEGATED_SCHEDULE_ACTION_RE = /(?:不要|不|无需|禁止)(?:创建|新建|安排|添加|修改|编辑|调整|删除|取消|提醒|定时|预约)(?:[、,，或和]?\s*(?:创建|新建|安排|添加|修改|编辑|调整|删除|取消|提醒|定时|预约))*/g
const WORK_PLUGIN_RE = /插件|市场|worktree|工作树|打包|发布(?:插件|版本)|上传(?:插件|版本)/i
const WORK_APP_RE = /小程序|应用(?:包|市场|接入|详情|能力)|能力包|能力清单|manifest|发布(?:应用|小程序)|上传(?:应用|小程序)/i
const WORK_REVIEW_RE = /代码审查|审查|review|MR\b|PR\b|diff/i
const WORK_CONTACT_RE = /联系人|通讯录|找人|联系方式|同事/i
const WORK_ACADEMY_RE = /培训|课程|学院|学习|考试/i
const WORK_NOTICE_RE = /公告|通知/i
const WORK_NOTEBOOK_RE = /笔记本|笔记|notebook/i
const WORK_IM_RE = /发送|发消息|群聊|通知某人/i
const WORK_TRACE_RE = /会话记录|会话检索|事件追踪|trace|会话日志|历史会话/i
const WORK_MCP_RESOURCE_RE = /MCP|资源模板|资源列表|mcp resource/i

function matches(pattern, text) {
  return pattern.test(String(text || ''))
}

function addTools(target, tools) {
  for (const tool of tools) target.add(tool)
}

/**
 * Work 任务类型 → 工具组。未命中的域不暴露，命中才追加。
 * 这样普通“读目录/统计文件”只带核心工具，代码/插件/视觉/日程等再按需追加。
 * 只读代码检查若没有写、运行、测试等动作，不追加终端/工作树/插件管理组。
 */
export function workToolProfiles(text, { webSearch = false, images = [] } = {}) {
  const profiles = new Set(['core'])
  const writeText = String(text || '').replace(NEGATED_ACTION_RE, '')
  const codeInspect = matches(WORK_READONLY_RE, text) && !matches(WORK_CODE_WRITE_RE, writeText)
  if (matches(WORK_CODE_RE, text) && !codeInspect) profiles.add('code')
  if (matches(WORK_DOC_RE, text)) profiles.add('doc')
  if (matches(WORK_DATA_RE, text)) profiles.add('data')
  if (matches(WORK_VISUAL_RE, text) || (Array.isArray(images) && images.length > 0)) profiles.add('visual')
  if (matches(WORK_SCHEDULE_RE, text)) {
    profiles.add('schedule')
    const scheduleText = String(text || '').replace(NEGATED_SCHEDULE_ACTION_RE, '').replace(SCHEDULE_READ_QUERY_RE, '')
    if (matches(WORK_SCHEDULE_WRITE_RE, scheduleText)) profiles.add('schedule-write')
  }
  if (matches(WORK_PLUGIN_RE, text)) profiles.add('plugin')
  if (matches(WORK_APP_RE, text)) profiles.add('app')
  if (matches(WORK_REVIEW_RE, text)) profiles.add('review')
  if (matches(WORK_CONTACT_RE, text)) profiles.add('contacts')
  if (matches(WORK_ACADEMY_RE, text)) profiles.add('academy')
  if (matches(WORK_NOTICE_RE, text)) profiles.add('notice')
  if (matches(WORK_NOTEBOOK_RE, text)) profiles.add('notebook')
  if (matches(WORK_IM_RE, text)) profiles.add('im')
  if (matches(WORK_TRACE_RE, text)) profiles.add('trace')
  if (matches(WORK_MCP_RESOURCE_RE, text)) profiles.add('mcp-resource')
  if (webSearch) profiles.add('web-search')
  return profiles
}

export function wantsVisualTools(text) {
  return matches(WORK_VISUAL_RE, text)
}

export function wantsScheduleTools(text) {
  return matches(WORK_SCHEDULE_RE, text)
}

/**
 * 只读代码检查的 run_code 硬预算；其他任务返回 0（不限制）。
 * 只读代码通常 2 次足够，3 次留出一次纠错/补读余量。
 */
export function runCodeLimitForTurn({ taskMode, mode, text, activePreset, deepThink } = {}) {
  if (activePreset || deepThink) return 0
  if (taskMode === 'chat' || mode === 'chat') return 0
  if (!matches(WORK_CODE_RE, text)) return 0
  const writeText = String(text || '').replace(NEGATED_ACTION_RE, '')
  return matches(WORK_READONLY_RE, text) && !matches(WORK_CODE_WRITE_RE, writeText) ? 3 : 0
}

/**
 * 返回本轮工具可见性策略（allow=... / denyPrefix=...）；只做“本轮可见工具”收窄。
 * 普通问答走 direct 时不会调用这里；只有进入 Harness 的轮次生效。
 */
export function toolPolicyForTurn({ taskMode, mode, projectId, text, webSearch, activePreset, deepThink, images }) {
  if (activePreset || deepThink) return ''
  const visual = wantsVisualTools(text) || (Array.isArray(images) && images.length > 0)
  const schedule = wantsScheduleTools(text)
  if (taskMode === 'chat' || mode === 'chat') {
    const allow = [...CHAT_CORE_TOOLS]
    if (webSearch) allow.push('web_search')
    if (visual) allow.push(...CHAT_VISUAL_TOOLS)
    if (schedule) allow.push(...CHAT_SCHEDULE_TOOLS)
    return `allow=${[...new Set(allow)].join(',')}`
  }

  const profiles = workToolProfiles(text, { webSearch, images })
  const allow = new Set(WORK_CORE_TOOLS)
  if (profiles.has('code') || profiles.has('plugin')) addTools(allow, WORK_CODE_TOOLS)
  if (profiles.has('visual')) addTools(allow, WORK_VISUAL_TOOLS)
  if (profiles.has('schedule')) addTools(allow, profiles.has('schedule-write') ? WORK_SCHEDULE_TOOLS : WORK_SCHEDULE_READ_TOOLS)
  if (profiles.has('app')) addTools(allow, WORK_APP_TOOLS)
  if (profiles.has('review')) addTools(allow, WORK_REVIEW_TOOLS)
  if (profiles.has('contacts')) addTools(allow, WORK_CONTACT_TOOLS)
  if (profiles.has('academy')) addTools(allow, WORK_ACADEMY_TOOLS)
  if (profiles.has('notice')) addTools(allow, WORK_NOTICE_TOOLS)
  if (profiles.has('notebook')) addTools(allow, WORK_NOTEBOOK_TOOLS)
  if (profiles.has('im')) addTools(allow, WORK_IM_TOOLS)
  if (profiles.has('trace')) addTools(allow, WORK_TRACE_TOOLS)
  if (profiles.has('mcp-resource')) addTools(allow, WORK_MCP_RESOURCE_TOOLS)
  if (profiles.has('web-search')) allow.add('web_search')
  return `allow=${[...allow].join(',')}`
}

/**
 * 解析 allow= 策略中的工具名，保持原始顺序。
 * 非 allow 策略返回空数组，调用方应直接使用新策略。
 */
export function toolPolicyNames(policy = '') {
  const match = /^allow=(.*)$/.exec(String(policy || ''))
  return match ? match[1].split(',').filter(Boolean) : []
}

/**
 * 会话级工具前缀稳定器：始终采用本轮候选策略的规范顺序。
 *
 * `toolPolicyForTurn` 已按“核心工具固定顺序 + 动态工具追加”生成 allow 列表；
 * 因此这里不再用上一轮工具顺序重排，否则从窄工具面切回宽工具面时会把核心
 * 工具顺序打乱，反而破坏缓存前缀。本轮策略为空时返回空，表示全量工具面。
 */
export function mergeToolPolicies(_previous = '', next = '') {
  return next || ''
}


