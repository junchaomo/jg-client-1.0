import test from 'node:test'
import assert from 'node:assert/strict'
import { IMAGE_LAUNCH_KEYS, LAUNCH_MODEL_KEYS, billingPeriodAt, priceImage, priceUsage, pricingSummary, resolvePriceModel } from '../pricing.mjs'

const at = (iso) => iso

test('DeepSeek 计费：北京时间峰谷边界与法定节假日', () => {
  assert.equal(billingPeriodAt(at('2026-11-16T01:00:00.000Z')).period, 'peak') // 09:00 北京
  assert.equal(billingPeriodAt(at('2026-11-16T03:59:00.000Z')).period, 'peak') // 11:59 北京
  assert.equal(billingPeriodAt(at('2026-11-16T04:00:00.000Z')).period, 'off-peak') // 12:00 北京
  assert.equal(billingPeriodAt(at('2026-11-16T06:00:00.000Z')).period, 'peak') // 14:00 北京
  assert.equal(billingPeriodAt(at('2026-11-16T09:59:00.000Z')).period, 'peak') // 17:59 北京
  assert.equal(billingPeriodAt(at('2026-11-16T10:00:00.000Z')).period, 'off-peak') // 18:00 北京
  assert.equal(billingPeriodAt(at('2026-11-21T02:00:00.000Z')).period, 'off-peak') // 周六
  assert.equal(billingPeriodAt(at('2026-10-01T02:00:00.000Z')).period, 'off-peak') // 国庆
  assert.equal(billingPeriodAt('').period, 'unknown')
})

test('DeepSeek 计费：Flash 与 Pro 的缓存命中/未命中/输出分别计价', () => {
  const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 }
  const flashOffPeak = priceUsage({ model: 'deepseek-flash', usage, at: at('2026-11-16T10:00:00.000Z') })
  assert.equal(flashOffPeak.priced, true)
  assert.equal(flashOffPeak.billingPeriod, 'off-peak')
  assert.equal(flashOffPeak.costCny, 5.02)
  assert.deepEqual(flashOffPeak.costBreakdownCny, { cacheHit: 0.02, cacheMiss: 1, write: 0, output: 4 })

  const flashPeak = priceUsage({ model: 'deepseek-flash', usage, at: at('2026-11-16T01:00:00.000Z') })
  assert.equal(flashPeak.costCny, 10.04)

  const proOffPeak = priceUsage({ model: 'deepseek-v4-pro', usage, at: at('2026-11-16T10:00:00.000Z') })
  assert.equal(proOffPeak.costCny, 5.02)
  assert.equal(proOffPeak.pricingModel, 'deepseek-flash')
  assert.equal(proOffPeak.requestedPricingModel, 'deepseek-v4-pro')
  assert.equal(proOffPeak.costCredits, 502)
})

test('积分制：100 积分 = 1 元，文本与图像同时返回积分', () => {
  assert.equal(priceUsage({
    model: 'glm-5.3-flash',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
  }).costCredits, 383) // 0.23 + 0.8 + 2.8 = 3.83 元
  assert.equal(priceImage({ model: 'qwen-image-3.0-pro', width: 1024, height: 1024 }).costCredits, 25)
})

test('最新模型目录：Qwen Max / Qwen Flash / Kimi K3 / GLM 5V 按官方价目', () => {
  const qwen4Max = priceUsage({ model: 'qwen4-max', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 } })
  assert.equal(qwen4Max.costCny, 10 + 30 + 0.5)
  assert.equal(qwen4Max.tier, 'max')

  const qwenMax = priceUsage({ model: 'qwen3.8-max', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 } })
  assert.equal(qwenMax.costCny, 12 + 36 + 1.5)
  assert.equal(qwenMax.tier, 'max')

  const qwenFlash = priceUsage({ model: 'qwen3.6-flash', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } })
  assert.equal(qwenFlash.pricingTier, '256K < 输入 ≤1M')
  assert.equal(qwenFlash.costCny, 4.8 + 28.8)

  const kimiK3 = priceUsage({ model: 'kimi-k3.1-pro', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 } })
  assert.equal(kimiK3.costCny, 13 + 68 + 1.3)

  const glm5v = priceUsage({ model: 'glm-5v-turbo', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 } })
  assert.equal(glm5v.pricingTier, '32K < 输入')
  assert.equal(glm5v.costCny, 7 + 26 + 1.8)
})

test('DeepSeek 计费：旧模型名按当前 Flash 价目映射，未知模型/无时间不猜价', () => {
  assert.equal(resolvePriceModel('deepseek-chat').key, 'deepseek-flash')
  assert.equal(resolvePriceModel('deepseek-reasoner').alias, true)
  assert.equal(resolvePriceModel('unknown-model'), null)

  const chat = priceUsage({
    model: 'deepseek-chat',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
    at: at('2026-11-16T10:00:00.000Z'),
  })
  assert.equal(chat.costCny, 5.02)
  assert.equal(chat.pricingModel, 'deepseek-flash')

  const unknown = priceUsage({ model: 'unknown-model', usage: { inputTokens: 100 } })
  assert.equal(unknown.priced, false)
  assert.equal(unknown.reason, 'unknown-model')
  assert.equal(unknown.unpricedTokens, 100)

  const noTime = priceUsage({ model: 'deepseek-flash', usage: { inputTokens: 100 } })
  assert.equal(noTime.priced, false)
  assert.equal(noTime.reason, 'missing-usage-at')
  assert.equal(noTime.unpricedTokens, 100)
})

test('Qwen-Plus 计费：按输入长度分档，缓存与思考输出分别计价', () => {
  const small = priceUsage({
    model: 'qwen-plus',
    usage: { inputTokens: 50_000, outputTokens: 100_000, cacheReadTokens: 50_000 },
  })
  assert.equal(small.priced, true)
  assert.equal(small.billingPeriod, 'flat')
  assert.equal(small.pricingTier, '输入 ≤128K')
  assert.equal(small.costCny, 0.008 + 0.04 + 0.2)
  assert.equal(small.costBreakdownCny.cacheHit, 0.008)
  assert.equal(small.costBreakdownCny.cacheMiss, 0.04)
  assert.equal(small.costBreakdownCny.output, 0.2)

  const large = priceUsage({
    model: 'qwen-plus',
    usage: { inputTokens: 150_000, outputTokens: 100_000, cacheReadTokens: 50_000 },
  })
  assert.equal(large.pricingTier, '128K < 输入 ≤256K')
  assert.equal(large.costBreakdownCny.cacheMiss, 0.36)
  assert.equal(large.costBreakdownCny.cacheHit, 0.024)
  assert.equal(large.costBreakdownCny.output, 2)

  const thinking = priceUsage({
    model: 'qwen-plus',
    usage: { inputTokens: 100_000, outputTokens: 100_000, reasoningTokens: 10_000 },
  })
  assert.equal(thinking.costBreakdownCny.output, 0.8)

  const explicit = priceUsage({
    model: 'qwen-plus',
    usage: { inputTokens: 50_000, outputTokens: 100_000, cacheReadTokens: 50_000, cacheMode: 'explicit' },
  })
  assert.equal(explicit.costBreakdownCny.cacheHit, 0.004)
})

test('Kimi / GLM 计费：固定价、免费模型与缓存创建', () => {
  const kimi = priceUsage({
    model: 'moonshot-v1-8k',
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 },
  })
  assert.equal(kimi.priced, true)
  assert.equal(kimi.costCny, 0 + 2 + 4 + 10)
  assert.equal(kimi.billingPeriod, 'flat')

  const glmFree = priceUsage({ model: 'glm-4-flash', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } })
  assert.equal(glmFree.priced, true)
  assert.equal(glmFree.costCny, 0)

  const glm = priceUsage({ model: 'glm-5.3-flash', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 } })
  assert.equal(glm.costCny, 0.23 + 0.8 + 2.8)

  const kimiCodeFast = priceUsage({ model: 'kimi-k2.7-code-highspeed', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 } })
  assert.equal(kimiCodeFast.costCny, 2.6 + 13 + 54)
})

test('图像计费：Qwen-Image 分辨率档与 Seedream 像素档（万相条目已移除）', () => {
  const qwen1k = priceImage({ model: 'qwen-image-3.0-pro', width: 1024, height: 1024, inputImages: 1 })
  assert.equal(qwen1k.priced, true)
  assert.equal(qwen1k.pricingTier, '1K')
  assert.equal(qwen1k.costCny, 0.02 + 0.25)

  const qwen2k = priceImage({ model: 'qwen-image-3.0-pro', width: 2048, height: 2048 })
  assert.equal(qwen2k.pricingTier, '2K')
  assert.equal(qwen2k.costCny, 0.5)

  const seedreamSmall = priceImage({ model: 'seedream-5.5', width: 1280, height: 720, inputImages: 1 })
  assert.equal(seedreamSmall.pricingTier, 'P ≤ 2.61M')
  assert.equal(seedreamSmall.costCny, 0.05 + 0.13)

  const seedreamLarge = priceImage({ model: 'seedream-5.5', width: 2048, height: 2048 })
  assert.equal(seedreamLarge.pricingTier, '2.61M < P ≤ 4.63M')
  assert.equal(seedreamLarge.costCny, 0.23)

  const wanx = priceImage({ model: 'wanx2.1-imageedit' })
  assert.equal(wanx.priced, false)
  assert.equal(wanx.reason, 'unknown-image-model')

  const missingSize = priceImage({ model: 'qwen-image-3.0-pro' })
  assert.equal(missingSize.priced, false)
  assert.equal(missingSize.reason, 'missing-image-size')
})

test('最终上线组合：每个 provider 只保留一个文本模型入口', () => {
  const summary = pricingSummary()
  assert.equal(LAUNCH_MODEL_KEYS.length, 4)
  assert.deepEqual(summary.launchModels.map((row) => row.model), LAUNCH_MODEL_KEYS)
  assert.deepEqual(
    summary.launchModels.map((row) => row.provider),
    ['DeepSeek', 'Qwen', 'Moonshot', 'Zhipu'],
  )
  assert.equal(IMAGE_LAUNCH_KEYS.length, 2)
  assert.deepEqual(summary.launchImageModels.map((row) => row.model), IMAGE_LAUNCH_KEYS)
  assert.deepEqual(
    summary.launchImageModels.map((row) => row.model),
    ['seedream-5.5', 'qwen-image-3.0-pro'],
  )
})
