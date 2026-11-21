import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jg-workspace-memory-'))
process.env.JG_DATA_DIR = dir

const db = await import('../db.mjs')
const memory = await import('../memory.mjs')

const user = { id: 'u-memory', name: '测试用户' }
const projectId = 'PRJ-MEM-01'

db.upsertMemory({
  userId: user.id,
  kind: 'fact',
  scope: 'project',
  scopeRef: projectId,
  text: '项目交付物统一放入 deliverables 目录。',
})
db.upsertMemory({
  userId: user.id,
  kind: 'preference',
  scope: 'global',
  scopeRef: '',
  text: '回答优先使用中文。',
})

const projectItems = memory.listMemoryItems({ user, projectId })
assert.equal(projectItems.length, 2)
assert.equal(projectItems.some((x) => x.scopeRef === projectId), true)

const forgotten = memory.forgetMemory({ user, query: 'deliverables', projectId })
assert.equal(forgotten.archived, true)
const remaining = memory.listMemoryItems({ user, projectId })
assert.equal(remaining.length, 1)
assert.equal(remaining[0].scope, 'global')

