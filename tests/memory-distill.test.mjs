import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.JG_DATA_DIR = mkdtempSync(join(tmpdir(), 'jg-memory-distill-'))
const { extractMemoryCandidates } = await import('../memory.mjs')

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
