import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRunStats } from '../trace.mjs'

const notice = (bytes) => `(Omitted ${bytes} bytes. Full formatted result stored at: C:\\temp\\result.txt. Use read with offset/limit, or grep this path to search within it.)`

test('runStats 统计工具结果外置、省略字节与压缩事件', () => {
  const stats = buildRunStats({
    startedAt: 1,
    endedAt: 2,
    model: 'deepseek-chat',
    contextText: 'ctx',
    steps: [],
    usage: { calls: 1, inputTokens: 10, outputTokens: 2, totalTokens: 12 },
    events: [
      { type: 'tool/result', data: { message: { content: [{ type: 'text', text: `head ${notice(12000)}` }] } } },
      { type: 'tool/ptc-dispatch', data: { content: [{ type: 'text', text: `sub ${notice(3000)}` }] } },
      { type: 'compaction/prune', data: {} },
      { type: 'compaction/summary', data: {} },
      { type: 'tool/result', data: { message: { content: [{ type: 'text', text: 'small result' }] } } },
    ],
  })

  assert.equal(stats.spillCalls, 2)
  assert.equal(stats.spillOmittedBytes, 15000)
  assert.equal(stats.prunedResults, 1)
  assert.equal(stats.compactions, 1)
})

test('runStats 没有外置通知时保持 0，不估算', () => {
  const stats = buildRunStats({
    startedAt: 1,
    endedAt: 2,
    model: 'deepseek-chat',
    contextText: 'ctx',
    steps: [],
    usage: { calls: 1, inputTokens: 10, outputTokens: 2, totalTokens: 12 },
    events: [
      { type: 'tool/result', data: { message: { content: [{ type: 'text', text: 'small result' }] } } },
    ],
  })

  assert.equal(stats.spillCalls, 0)
  assert.equal(stats.spillOmittedBytes, 0)
  assert.equal(stats.prunedResults, 0)
  assert.equal(stats.compactions, 0)
})
