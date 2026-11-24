import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.JG_DATA_DIR = mkdtempSync(join(tmpdir(), 'jg-memory-distill-'))
const memory = await import('../memory.mjs')
const db = await import('../db.mjs')
const { extractMemoryCandidates } = memory

test('项目内偏好归项目作用域', () => {
  const [c] = extractMemoryCandidates('本项目统一用中文命名，优先使用 Vue 3', { projectId: 'PRJ-1' })
  assert.equal(c.scope, 'project')
  assert.equal(c.scopeRef, 'PRJ-1')
  assert.equal(c.kind, 'preference')
})

test('身份事实强制全局', () => {
  const [c] = extractMemoryCandidates('我是九江市规划设计集团智数中心的负责人', { projectId: 'PRJ-1' })
  assert.equal(c.scope, 'global')
  assert.equal(c.kind, 'entity')
})

test('已定决策归类为 decision', () => {
  const [c] = extractMemoryCandidates('技术栈就按 Node + SQLite 定了', { projectId: 'PRJ-1' })
  assert.equal(c.kind, 'decision')
  assert.equal(c.scope, 'project')
})

test('一次性任务且无强信号不沉淀', () => {
  assert.equal(extractMemoryCandidates('这次先帮我查一下公告列表', { projectId: 'PRJ-1' }).length, 0)
})

test('敏感信息不沉淀', () => {
  assert.equal(extractMemoryCandidates('记住我的密码是 123456', { projectId: '' }).length, 0)
})

test('无稳定信号的普通问答不沉淀', () => {
  assert.equal(extractMemoryCandidates('这个函数报错了怎么调', { projectId: '' }).length, 0)
})

test('明确要求记住的一次性任务也不进入长期记忆', () => {
  assert.equal(extractMemoryCandidates('记住：本次只输出 80 段测试内容，完成后不要再调用工具', { projectId: '' }).length, 0)
})

test('长期工具偏好中夹带操作步骤时整条放弃而不是污染记忆库', () => {
  assert.equal(extractMemoryCandidates('以后优先使用 write 工具。第一步创建测试文件，第二步完整输出 80 段内容', { projectId: '' }).length, 0)
})

test('规则提炼只采信用户原话，不从助手答复反推用户偏好', () => {
  const user = { id: 'u-assistant-reply', name: '测试用户' }
  const items = memory.distillTurnMemory({
    user,
    text: '帮我起草一份周报',
    reply: '以后都使用一页纸汇报，先结论后数据，这是您的偏好。',
  })
  assert.deepEqual(items, [])
  assert.equal(memory.memoryStats(user).count, 0)
})

test('同义的自动偏好保守去重，且仍保留可召回内容', () => {
  const user = { id: 'u-auto-dedupe', name: '测试用户' }
  memory.autoCaptureMemory({ user, text: '以后写文件优先用 write 工具，不使用 pwsh。' })
  memory.autoCaptureMemory({ user, text: '以后写文件必须优先用 write 工具，不使用 pwsh。' })
  const items = memory.listMemoryItems({ user })
  assert.equal(items.length, 1)
  assert.match(items[0].text, /write 工具/)
})

test('规则捕获、模型工具和模型提炼合并同一轮的同义偏好', async () => {
  const user = { id: 'u-cross-entry-dedupe', name: '测试用户' }
  memory.autoCaptureMemory({ user, text: '以后写报告优先用 Amber6138 作为标题关键词。' })
  memory.distillModelMemory({ user, candidate: { text: '写报告时标题优先使用「Amber6138」作为关键词', kind: 'preference', scope: 'global' } })
  const toolResult = await memory.writeMemory({ user, args: { content: '写报告时优先使用 Amber6138 作为标题关键词。', kind: 'preference', scope: 'global', dedupe: true } })
  assert.equal(toolResult.deduplicated, true)
  const items = memory.listMemoryItems({ user })
  assert.equal(items.length, 1)
  assert.match(items[0].text, /Amber6138/)
})

test('英文或数字锚点不同的相似决策不会被错误合并', () => {
  const user = { id: 'u-distinct-decisions', name: '测试用户' }
  memory.autoCaptureMemory({ user, text: '以后写报告优先用 Amber6138 作为标题关键词。' })
  memory.autoCaptureMemory({ user, text: '以后写报告优先用 Amber6139 作为标题关键词。' })
  assert.equal(memory.memoryStats(user).count, 2)
})

test('明确变更时新记忆替代同主题旧记忆并保留替代链', async () => {
  const user = { id: 'u-supersede', name: '测试用户' }
  const oldItem = memory.autoCaptureMemory({ user, text: '记住：以后写报告优先用 Amber6138 作为标题关键词。' })
  const newItem = memory.autoCaptureMemory({ user, text: '记住：以后写报告标题关键词改为 Amber7241。' })
  assert.notEqual(newItem.id, oldItem.id)
  const oldRow = db.getMemory(user.id, oldItem.id)
  assert.equal(oldRow.status, 'superseded')
  assert.equal(oldRow.supersededBy, newItem.id)
  assert.ok(oldRow.supersededAt > 0)
  const active = memory.listMemoryItems({ user })
  assert.equal(active.length, 1)
  assert.match(active[0].text, /Amber7241/)
  const context = await memory.memoryContextForTurn({ user, text: '报告标题关键词是什么', includeRules: false })
  assert.match(context, /Amber7241/)
  assert.doesNotMatch(context, /Amber6138/)
})

test('没有明确变更信号时不同取值并存，不擅自覆盖', () => {
  const user = { id: 'u-no-explicit-replace', name: '测试用户' }
  memory.autoCaptureMemory({ user, text: '记住：以后写报告优先用 Amber6138 作为标题关键词。' })
  memory.autoCaptureMemory({ user, text: '记住：以后写报告优先用 Amber9999 作为标题关键词。' })
  assert.equal(memory.memoryStats(user).count, 2)
})

test('明确变更也不会替代其他主题或其他作用域的记忆', () => {
  const globalUser = { id: 'u-scope-replace', name: '测试用户' }
  const oldGlobal = memory.autoCaptureMemory({ user: globalUser, text: '记住：以后写报告优先用 Amber6138 作为标题关键词。' })
  memory.autoCaptureMemory({ user: globalUser, text: '本项目写报告标题关键词改为 Amber7241。', projectId: 'PRJ-REPLACE' })
  assert.equal(db.getMemory(globalUser.id, oldGlobal.id).status, 'active')

  const topicUser = { id: 'u-topic-replace', name: '测试用户' }
  const oldTopic = memory.autoCaptureMemory({ user: topicUser, text: '记住：以后写报告优先用 Amber6138 作为标题关键词。' })
  memory.autoCaptureMemory({ user: topicUser, text: '记住：项目部署以后改用 Docker。' })
  assert.equal(db.getMemory(topicUser.id, oldTopic.id).status, 'active')
})

test('模型提炼继承用户原话中的明确更替信号', () => {
  const user = { id: 'u-model-supersede', name: '测试用户' }
  const oldItem = memory.autoCaptureMemory({ user, text: '记住：以后写报告优先用 Amber6138 作为标题关键词。' })
  const newItem = memory.distillModelMemory({
    user,
    candidate: { text: '写报告时标题关键词采用 Amber7241', kind: 'preference', scope: 'global' },
    sourceText: '记住：以后写报告标题关键词改为 Amber7241。',
  })
  assert.equal(db.getMemory(user.id, oldItem.id).supersededBy, newItem.id)
  assert.equal(memory.memoryStats(user).count, 1)
})

test('模型记忆工具显式 replace 同样生成替代链', async () => {
  const user = { id: 'u-tool-supersede', name: '测试用户' }
  const oldItem = memory.autoCaptureMemory({ user, text: '记住：以后写报告优先用 Amber6138 作为标题关键词。' })
  const result = await memory.writeMemory({ user, args: { content: '写报告标题关键词改为 Amber7241', kind: 'decision', scope: 'global', replace: true, dedupe: true } })
  assert.deepEqual(result.supersededIds, [oldItem.id])
  assert.equal(db.getMemory(user.id, oldItem.id).status, 'superseded')
})

test('不再使用某方案时旧偏好退出，而不是被近似去重保留', () => {
  const user = { id: 'u-negative-supersede', name: '测试用户' }
  const oldItem = memory.autoCaptureMemory({ user, text: '记住：以后写报告优先用 Markdown 作为格式。' })
  const newItem = memory.autoCaptureMemory({ user, text: '记住：以后写报告不再使用 Markdown。' })
  assert.equal(db.getMemory(user.id, oldItem.id).supersededBy, newItem.id)
  const active = memory.listMemoryItems({ user })
  assert.equal(active.length, 1)
  assert.match(active[0].text, /不再使用/)
})

test('模型提炼只对有稳定信息信号的用户原话触发', () => {
  assert.equal(memory.shouldAttemptMemoryDistill('帮我起草一份项目周报'), false)
  assert.equal(memory.shouldAttemptMemoryDistill('我更喜欢先结论后数据的汇报方式'), true)
  assert.equal(memory.shouldAttemptMemoryDistill('本次记住只输出 80 段内容'), false)
})

test('模型提炼候选过滤联调测试和任务步骤', () => {
  const user = { id: 'u-model-filter', name: '测试用户' }
  assert.equal(memory.distillModelMemory({ user, candidate: { text: '长期记忆联调测试偏好：标题使用测试代号', kind: 'preference', scope: 'global' } }), null)
  assert.equal(memory.distillModelMemory({ user, candidate: { text: '第一步创建文件，第二步完整输出 80 段', kind: 'preference', scope: 'global' } }), null)
  assert.equal(memory.memoryStats(user).count, 0)
})

test('模型提炼的项目作用域不能落到错误项目或空项目', () => {
  const user = { id: 'u-model-scope', name: '测试用户' }
  const noProject = memory.distillModelMemory({ user, candidate: { text: '项目交付统一使用 Markdown 格式', kind: 'decision', scope: 'project' } })
  assert.equal(noProject.scope, 'global')
  const inProject = memory.distillModelMemory({ user, candidate: { text: '项目交付统一使用 Markdown 格式', kind: 'decision', scope: 'project' }, projectId: 'PRJ-DISTILL' })
  assert.equal(inProject.scope, 'project')
  assert.equal(inProject.scopeRef, 'PRJ-DISTILL')
})
