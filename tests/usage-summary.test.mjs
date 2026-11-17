import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeUsage } from '../usage-summary.mjs'

function assistant(overrides = {}) {
  return {
    role: 'assistant',
    model: 'test-model',
    usageAt: Date.parse('2026-11-16T08:00:00.000Z'),
    usage: {
      calls: 2,
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      reasoningTokens: 3,
    },
    runStats: {
      taskClass: 'document',
      finishReason: 'completed',
      toolCalls: 1,
      toolFailures: 0,
      contextChars: 400,
      durationMs: 1200,
      spillCalls: 1,
      spillOmittedBytes: 2048,
      prunedResults: 2,
      compactions: 1,
    },
    steps: [
      { tool: '模型网关', status: 'ok' },
      { tool: 'doc_read', status: 'ok' },
    ],
    ...overrides,
  }
}

test('用量汇总：按任务、会话、工具归因并计算成功任务成本', () => {
  const conversations = [
    {
      id: 'c1',
      title: '文档会话',
      messages: [
        { role: 'user', text: 'read' },
        assistant(),
      ],
    },
    {
      id: 'c2',
      title: '失败会话',
      messages: [
        {
          ...assistant({
            usage: { calls: 1, inputTokens: 50, outputTokens: 10, totalTokens: 60, cacheReadTokens: 15, cacheWriteTokens: 0 },
            runStats: { taskClass: 'document', finishReason: 'max_tokens', toolCalls: 1, toolFailures: 1 },
            steps: [
              { tool: 'doc_read', status: 'fail' },
              { tool: 'skill_search', status: 'ok' },
            ],
          }),
        },
        {
          role: 'assistant',
          model: 'test-model',
          text: '没有真实 usage 的历史轮次',
          steps: [{ tool: '模型网关', status: 'ok' }],
          runStats: { taskClass: 'document', finishReason: 'completed', toolCalls: 0, toolFailures: 0 },
        },
      ],
    },
  ]
  const result = summarizeUsage(conversations)
  assert.equal(result.totals.requests, 3)
  assert.equal(result.totals.totalTokens, 180)
  assert.equal(result.totals.successfulTasks, 1)
  assert.equal(result.totals.failedTasks, 1)
  assert.equal(result.totals.unknownTasks, 0)
  assert.equal(result.totals.avgTokensPerSuccessfulTask, 120)
  assert.equal(result.totals.successfulModelTasks, 1)
  assert.equal(result.totals.avgTokensPerSuccessfulModelTask, 120)
  assert.equal(result.totals.cacheReadTokens, 25)
  assert.equal(result.totals.cacheWriteTokens, 5)
  assert.equal(result.totals.cacheHitRate, 0.139)
  assert.equal(result.totals.toolCalls, 2)
  assert.equal(result.totals.toolFailures, 1)
  assert.equal(result.totals.spillCalls, 1)
  assert.equal(result.totals.spillOmittedBytes, 2048)
  assert.equal(result.totals.prunedResults, 2)
  assert.equal(result.totals.compactions, 1)
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0].taskClass, 'document')
  assert.equal(result.tasks[0].successfulTasks, 1)
  assert.equal(result.tasks[0].failedTasks, 1)
  assert.equal(result.tasks[0].avgTokensPerSuccessfulTask, 120)
  assert.equal(result.sessions.length, 2)
  assert.equal(result.sessions.find((item) => item.conversationId === 'c2').usageMessages, 1)
  assert.equal(result.tools.find((item) => item.tool === 'doc_read').calls, 2)
  assert.equal(result.tools.find((item) => item.tool === 'doc_read').failures, 1)
  assert.equal(result.skills.length, 1)
  assert.equal(result.skills[0].tool, 'skill_search')
  assert.equal(result.coverage.assistantMessages, 3)
  assert.equal(result.coverage.usageMessages, 2)
  assert.equal(result.coverage.runStatsMessages, 3)
  assert.equal(result.records.length, 2)
})

test('用量汇总：没有真实 usage 时不估算、不伪造', () => {
  const result = summarizeUsage([{
    id: 'c0',
    title: '历史会话',
    messages: [{
      role: 'assistant',
      text: '历史回答',
      runStats: { taskClass: 'document', finishReason: 'completed', toolCalls: 1, toolFailures: 0 },
      steps: [{ tool: 'doc_read', status: 'ok' }],
    }],
  }])
  assert.equal(result.totals.totalTokens, 0)
  assert.equal(result.totals.requests, 0)
  assert.equal(result.totals.successfulTasks, 0)
  assert.equal(result.coverage.usageMessages, 0)
  assert.equal(result.coverage.runStatsMessages, 1)
  assert.equal(result.baseline.since, '')
})

test('用量汇总：使用真实 usageAt 与模型价目计算费用，未知模型不猜价', () => {
  const priced = summarizeUsage([{
    id: 'c-price',
    title: '计费会话',
    messages: [{
      role: 'assistant',
      model: 'deepseek-flash',
      usageAt: Date.parse('2026-11-16T10:00:00.000Z'), // 北京时间 18:00，空闲档
      usage: {
        calls: 1,
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 0,
      },
      runStats: { taskClass: 'work', finishReason: 'completed', toolCalls: 0, toolFailures: 0 },
      steps: [],
    }],
  }])
  assert.equal(priced.totals.costCny, 5.02)
  assert.equal(priced.totals.pricedRequests, 1)
  assert.equal(priced.totals.offPeakRequests, 1)
  assert.equal(priced.totals.unpricedRequests, 0)
  assert.equal(priced.models[0].costCny, 5.02)
  assert.equal(priced.tasks[0].costCny, 5.02)
  assert.equal(priced.sessions[0].costCny, 5.02)
  assert.equal(priced.records[0].pricingModel, 'deepseek-flash')
  assert.equal(priced.records[0].billingPeriod, 'off-peak')
  assert.equal(priced.pricing.currency, 'CNY')

  const unknown = summarizeUsage([{
    id: 'c-unknown',
    title: '未知模型',
    messages: [{
      role: 'assistant',
      model: 'test-model',
      usageAt: Date.parse('2026-11-16T10:00:00.000Z'),
      usage: { calls: 1, inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      runStats: { taskClass: 'work', finishReason: 'completed', toolCalls: 0, toolFailures: 0 },
      steps: [],
    }],
  }])
  assert.equal(unknown.totals.costCny, 0)
  assert.equal(unknown.totals.pricedRequests, 0)
  assert.equal(unknown.totals.unpricedRequests, 1)
  assert.equal(unknown.records[0].priced, false)
})

test('用量汇总：历史轮次缺失 taskClass 时按会话模式归组，不猜业务类型', () => {
  const result = summarizeUsage([{
    id: 'c3',
    title: '工作会话',
    mode: 'work',
    messages: [{
      role: 'assistant',
      model: 'test-model',
      usageAt: Date.parse('2026-11-16T09:00:00.000Z'),
      usage: { calls: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      runStats: { finishReason: 'completed', toolCalls: 0, toolFailures: 0 },
      steps: [],
    }],
  }])
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0].taskClass, 'work')
  assert.equal(result.totals.successfulTasks, 1)
  assert.equal(result.totals.avgTokensPerSuccessfulModelTask, 15)
})
