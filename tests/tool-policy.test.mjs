import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_CORE_TOOLS, CHAT_VISUAL_TOOLS, CHAT_SCHEDULE_TOOLS,
  WORK_CORE_TOOLS, WORK_CODE_TOOLS, WORK_VISUAL_TOOLS, WORK_SCHEDULE_TOOLS, WORK_SCHEDULE_READ_TOOLS,
  runCodeLimitForTurn, toolPolicyForTurn, mergeToolPolicies, toolPolicyNames, workToolProfiles,
} from '../tool-policy.mjs'

function allowed(policy) {
  const match = /^allow=(.*)$/.exec(policy)
  assert.ok(match, `expected allow policy, got ${policy}`)
  return new Set(match[1].split(',').filter(Boolean))
}

test('Chat keeps the existing core allowlist and adds intent tools', () => {
  const core = allowed(toolPolicyForTurn({ taskMode: 'chat', mode: 'chat', text: '看下这个文件', webSearch: false }))
  for (const tool of CHAT_CORE_TOOLS) assert.ok(core.has(tool), `missing ${tool}`)
  assert.ok(!core.has('mcp__jg__visual_create'))
  assert.ok(!core.has('schedule_create'))

  const withVisual = allowed(toolPolicyForTurn({ taskMode: 'chat', mode: 'chat', text: '画一张流程图' }))
  for (const tool of CHAT_VISUAL_TOOLS) assert.ok(withVisual.has(tool), `missing ${tool}`)

  const withSchedule = allowed(toolPolicyForTurn({ taskMode: 'chat', mode: 'chat', text: '每天早上提醒我' }))
  for (const tool of CHAT_SCHEDULE_TOOLS) assert.ok(withSchedule.has(tool), `missing ${tool}`)
})

test('Work read-only inspection uses core tools only', () => {
  const policy = toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: 'PRJ-X',
    text: '只读检查当前项目目录结构，统计 .py 文件数量，并列出前 5 个文件名；不要修改任何文件。',
    webSearch: false,
  })
  const tools = allowed(policy)
  for (const tool of WORK_CORE_TOOLS) assert.ok(tools.has(tool), `missing ${tool}`)
  for (const tool of WORK_CODE_TOOLS) assert.ok(!tools.has(tool), `unexpected code tool ${tool}`)
  for (const tool of WORK_VISUAL_TOOLS) assert.ok(!tools.has(tool), `unexpected visual tool ${tool}`)
  for (const tool of WORK_SCHEDULE_TOOLS) assert.ok(!tools.has(tool), `unexpected schedule tool ${tool}`)
  assert.ok(!tools.has('mcp__jg__contacts_find'))
  assert.ok(!tools.has('session_event_read'))
})

test('Work code and plugin intents add terminal and job tools, not visual tools', () => {
  const policy = toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: '',
    text: '写一个脚本并运行测试，再把插件打包上传市场。',
    webSearch: false,
  })
  const tools = allowed(policy)
  for (const tool of WORK_CODE_TOOLS) assert.ok(tools.has(tool), `missing ${tool}`)
  assert.ok(tools.has('plugin_manager'))
  for (const tool of WORK_VISUAL_TOOLS) assert.ok(!tools.has(tool), `unexpected visual tool ${tool}`)
})

test('Work document intent has format tools but no visual tools', () => {
  const tools = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: '',
    text: '把这份 Excel 数据整理成一份 Word 报告并导出 PDF。',
  }))
  assert.ok(tools.has('mcp__jg__format_export'))
  assert.ok(tools.has('mcp__jg__format_extract'))
  assert.ok(tools.has('mcp__jg__format_inspect'))
  assert.ok(!tools.has('mcp__jg__visual_create'))
})

test('Work visual/schedule and business intents add only their domains', () => {
  const visual = allowed(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '画一张架构图' }))
  for (const tool of WORK_VISUAL_TOOLS) assert.ok(visual.has(tool), `missing ${tool}`)
  assert.ok(!visual.has('schedule_create'))

  const schedule = allowed(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '每周一提醒我检查数据' }))
  for (const tool of WORK_SCHEDULE_TOOLS) assert.ok(schedule.has(tool), `missing ${tool}`)
  assert.ok(!schedule.has('mcp__jg__visual_create'))

  const contacts = allowed(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '帮我找一下联系人张三的邮箱' }))
  assert.ok(contacts.has('mcp__jg__contacts_find'))
  assert.ok(!contacts.has('mcp__jg__visual_create'))
})

test('Work read-only schedule only exposes list/view tools', () => {
  const tools = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: 'PRJ-X',
    text: '只读查看我明天的日程，不要创建、修改或删除任何日程；只需告诉我是否有安排。',
  }))
  for (const tool of WORK_SCHEDULE_READ_TOOLS) assert.ok(tools.has(tool), `missing ${tool}`)
  assert.ok(!tools.has('schedule_create'), '只读日程不应追加创建工具')
  assert.ok(!tools.has('schedule_edit'), '只读日程不应追加编辑工具')
})

test('Work document upload/publish does not expand code tools', () => {
  const image = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: '',
    text: '把这张图片上传到项目目录，并附在报告里。',
  }))
  assert.ok(!image.has('terminal_open'), '图片上传不应追加终端工具')
  assert.ok(!image.has('plugin_manager'), '图片上传不应追加插件工具')

  const doc = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: '',
    text: '把这份文档发布到知识库。',
  }))
  assert.ok(!doc.has('terminal_open'), '文档发布不应追加终端工具')
  assert.ok(!doc.has('plugin_manager'), '文档发布不应追加插件工具')

  const plugin = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: '',
    text: '把这个插件上传到市场。',
  }))
  assert.ok(plugin.has('terminal_open'), '插件上传仍应追加代码工具')
  assert.ok(plugin.has('plugin_manager'), '插件上传仍应追加插件工具')
})

test('Work code file names containing app do not expand mini-app tools', () => {
  const tools = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: 'PRJ-X',
    text: '只读检查 web_app.py 与 traffic_counter.py 的职责分工，不修改文件。',
  }))
  assert.ok(tools.has('read'))
  assert.ok(!tools.has('mcp__jg__app_call'), '普通代码文件名不应追加应用工具')

  const app = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: 'PRJ-X',
    text: '把这个小程序接入应用市场。',
  }))
  assert.ok(app.has('mcp__jg__app_call'), '真实应用意图仍应追加应用工具')
})

test('Work read-only code inspection stays on core tools', () => {
  const tools = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: 'PRJ-X',
    text: '只读检查 web_app.py 的代码入口，不修改文件，只说明职责。',
  }))
  assert.ok(tools.has('read'))
  assert.ok(tools.has('grep'))
  assert.ok(!tools.has('terminal_open'), '只读代码检查不应追加终端工具')
  assert.ok(!tools.has('create_worktree'), '只读代码检查不应追加工作树工具')
  assert.ok(!tools.has('mcp__jg__app_call'), '普通文件名不应追加应用工具')
})

test('Work code review adds review tool without terminal tools', () => {
  const tools = allowed(toolPolicyForTurn({
    taskMode: 'work', mode: 'work', projectId: 'PRJ-X',
    text: '审查这次 diff 的代码风险。',
  }))
  assert.ok(tools.has('mcp__jg__code_review'))
  assert.ok(!tools.has('terminal_open'), '代码审查不应追加终端工具')
  assert.ok(!tools.has('create_worktree'), '代码审查不应追加工作树工具')
})

test('web search is only visible when explicitly enabled', () => {
  assert.ok(!allowed(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '查资料', webSearch: false })).has('web_search'))
  assert.ok(allowed(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '查资料', webSearch: true })).has('web_search'))
})

test('presets and deep think keep the full tool surface', () => {
  assert.equal(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '写代码', activePreset: { id: 'p' } }), '')
  assert.equal(toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '写代码', deepThink: true }), '')
})

test('profiles are additive and do not duplicate tools in the policy', () => {
  const profiles = workToolProfiles('写脚本并画流程图，每周提醒我，再查一下插件市场', { webSearch: true })
  assert.deepEqual([...profiles].sort(), ['code', 'core', 'plugin', 'schedule', 'schedule-write', 'visual', 'web-search'].sort())
  const policy = toolPolicyForTurn({ taskMode: 'work', mode: 'work', text: '写脚本并画流程图，每周提醒我' })
  const names = policy.slice('allow='.length).split(',')
  assert.equal(names.length, new Set(names).size)
})

test('session tool policy uses the canonical candidate order and drops stale tools', () => {
  assert.deepEqual(toolPolicyNames('allow=a,b,c'), ['a', 'b', 'c'])
  assert.deepEqual(toolPolicyNames('denyPrefix=x'), [])

  assert.equal(mergeToolPolicies('', 'allow=a,b'), 'allow=a,b')
  assert.equal(mergeToolPolicies('allow=a,b', 'allow=b,c'), 'allow=b,c')
  assert.equal(mergeToolPolicies('allow=a,b,c', 'allow=a,c'), 'allow=a,c')
  assert.equal(mergeToolPolicies('allow=a,b', 'allow=a,b'), 'allow=a,b')
  assert.equal(mergeToolPolicies('allow=glob,read', 'allow=read,glob'), 'allow=read,glob', '不得用旧顺序重排核心工具')
  assert.equal(mergeToolPolicies('allow=a,b', 'allow='), 'allow=')
  assert.equal(mergeToolPolicies('allow=a,b', ''), '', 'preset/deepThink 要求全量工具面时应清空旧策略')
})

test('run_code hard budget applies only to read-only Work code inspection', () => {
  assert.equal(runCodeLimitForTurn({
    taskMode: 'work', mode: 'work',
    text: '只读检查 web_app.py 的代码入口，不修改任何文件，只回答启动入口和对应的函数名。',
  }), 3)
  assert.equal(runCodeLimitForTurn({
    taskMode: 'work', mode: 'work',
    text: '只读检查项目代码入口和关键模块，不修改文件；说明 web_app.py 与 traffic_counter.py 的职责分工。',
  }), 3)
  assert.equal(runCodeLimitForTurn({
    taskMode: 'work', mode: 'work',
    text: '修复 web_app.py 的启动入口并运行测试。',
  }), 0, '写代码/运行测试不应限制')
  assert.equal(runCodeLimitForTurn({
    taskMode: 'chat', mode: 'chat',
    text: '只读检查这份代码，不修改。',
  }), 0, 'Chat 不应受 Work 预算影响')
  assert.equal(runCodeLimitForTurn({
    taskMode: 'work', mode: 'work', activePreset: { id: 'p' },
    text: '只读检查代码入口，不修改。',
  }), 0, 'preset 保持全量工具面')
})



