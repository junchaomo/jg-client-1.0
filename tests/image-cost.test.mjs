/**
 * 图像成本汇总：只认落库金额，未记录/未计价分别计数，不估算补齐。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeImageCost } from '../image-cost.mjs'

test('按落库成本求和，未记录与未计价单列', () => {
  const rows = [
    { modelId: 'seedream-5.5', model: 'doubao-seedream-5-5', params: JSON.stringify({ width: 2048, cost: { priced: true, cny: 0.23, credits: 23 } }) },
    { modelId: 'qwen-image', model: 'qwen-image-3.0-pro', params: JSON.stringify({ region: {}, cost: { priced: true, cny: 0.0625, credits: 6.25 } }) },
    { modelId: 'seedream-5.5', model: 'doubao-seedream-5-5', params: JSON.stringify({ width: 1024 }) },
    { modelId: 'qwen-image', model: 'qwen-image-3.0-pro', params: JSON.stringify({ cost: { priced: false, cny: null, credits: null } }) },
  ]
  const summary = summarizeImageCost(rows)
  assert.equal(summary.revisions, 4)
  assert.equal(summary.recorded, 2)
  assert.equal(summary.unrecorded, 1)
  assert.equal(summary.unpriced, 1)
  assert.equal(summary.costCny, 0.2925)
  assert.equal(summary.costCredits, 29.25)
  assert.equal(summary.coverage, 0.5)
  const seedream = summary.models.find((m) => m.modelId === 'seedream-5.5')
  assert.equal(seedream.revisions, 2)
  assert.equal(seedream.recorded, 1)
  assert.equal(seedream.unrecorded, 1)
  assert.equal(seedream.costCny, 0.23)
  assert.equal(summary.models[0].modelId, 'seedream-5.5')
})

test('空数据与坏 JSON 不抛错', () => {
  const empty = summarizeImageCost([])
  assert.equal(empty.revisions, 0)
  assert.equal(empty.coverage, 0)
  const broken = summarizeImageCost([{ modelId: 'x', params: '{bad json' }])
  assert.equal(broken.unrecorded, 1)
  assert.equal(broken.costCny, 0)
})

test('本地画布操作不计费也不拉低覆盖率', () => {
  const rows = [
    { modelId: 'canvas-annotate', model: 'canvas-annotate', params: '{}' },
    { modelId: 'canvas-resize', model: 'canvas-resize', params: '{}' },
    { modelId: 'remove-image-background', model: 'remove-image-background', params: '{}' },
    { modelId: 'seedream-5.5', model: 's', params: JSON.stringify({ cost: { priced: true, cny: 0.5, credits: 50 } }) },
  ]
  const summary = summarizeImageCost(rows)
  assert.equal(summary.local, 3)
  assert.equal(summary.recorded, 1)
  assert.equal(summary.coverage, 1)
  assert.equal(summary.costCny, 0.5)
})
