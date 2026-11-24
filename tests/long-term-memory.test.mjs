import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.JG_DATA_DIR = mkdtempSync(join(tmpdir(), 'jg-long-term-memory-'))
process.env.JG_MEMORY_EMBEDDING_KEY = ''
process.env.DASHSCOPE_API_KEY = ''
process.env.QWEN_IMAGE_API_KEY = ''

const db = await import('../db.mjs')
const memory = await import('../memory.mjs')

const user = { id: 'u-long-memory', name: '长期记忆测试' }
const otherUser = { id: 'u-other', name: '其他用户' }
const projectId = 'PRJ-LONG-MEMORY'

function seed() {
  db.upsertMemory({
    userId: user.id,
    kind: 'preference',
    scope: 'global',
    text: '回答优先使用中文。',
  })
  db.upsertMemory({
    userId: user.id,
    kind: 'decision',
    scope: 'project',
    scopeRef: projectId,
    text: '本项目交付物统一放在 deliverables 目录。',
  })
}

test('个人记忆库无作用域参数时返回全部 active 记忆', () => {
  seed()
  const items = memory.listMemoryItems({ user })
  assert.equal(items.length, 2)
  assert.equal(items.filter((item) => item.scope === 'global').length, 1)
  assert.equal(items.filter((item) => item.scope === 'project').length, 1)
  assert.equal(items.length, memory.memoryStats(user).count)
})

test('memory_search 将项目上下文传入召回并能命中项目记忆', async () => {
  const items = await memory.searchMemory({ user, query: 'deliverables 目录', projectId })
  assert.equal(items.length, 1)
  assert.equal(items[0].scope, 'project')
  assert.equal(items[0].scopeRef, projectId)
  assert.match(items[0].text, /deliverables/)
})

test('个人记忆检索无作用域参数时可查项目记忆，但不跨用户', async () => {
  db.upsertMemory({ userId: otherUser.id, scope: 'global', text: '其他用户的 deliverables 私有记忆。' })
  const items = await memory.searchMemory({ user, query: 'deliverables 目录' })
  assert.equal(items.length, 1)
  assert.equal(items[0].userId, user.id)
  assert.equal(items[0].scopeRef, projectId)
})

test('自动召回把项目记忆注入本轮上下文并记录真实使用', async () => {
  const before = memory.listMemoryItems({ user, projectId }).find((item) => item.scope === 'project')
  const context = await memory.memoryContextForTurn({
    user,
    text: 'deliverables 目录的交付约定是什么',
    projectId,
    includeRules: false,
  })
  assert.match(context, /deliverables/)
  const after = db.getMemory(user.id, before.id)
  assert.equal(after.useCount, before.useCount + 1)
  assert.ok(after.lastUsedAt > 0)
})

test('按 ID 能读取并归档本人记忆，且不能操作其他用户记忆', () => {
  const { item } = db.upsertMemory({ userId: user.id, scope: 'global', text: '按 ID 删除的测试记忆。' })
  assert.equal(db.getMemory(user.id, item.id)?.id, item.id)
  assert.equal(db.getMemory(otherUser.id, item.id), null)
  const forgotten = memory.forgetMemory({ user, id: item.id })
  assert.equal(forgotten.archived, true)
  assert.equal(db.getMemory(user.id, item.id)?.status, 'archived')
})

test('其他项目上下文不会注入本项目记忆', async () => {
  const context = await memory.memoryContextForTurn({
    user,
    text: 'deliverables 目录的交付约定是什么',
    projectId: 'PRJ-OTHER',
    includeRules: false,
  })
  assert.doesNotMatch(context, /deliverables/)
})
