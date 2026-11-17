/**
 * 模型计费口径（2026-11-16 核对各厂商官方价目）。
 *
 * 这里只负责“已有真实 usage / 图像尺寸字段”的金额换算，不根据字符数估算 token。
 * 文本模型覆盖模型网关当前可配置的 DeepSeek、Qwen、Kimi、GLM；
 * 图像模型覆盖图像工作台的 Qwen-Image 与 Seedream（选区重绘也走这两个预设模型）。
 *
 * 价格来源：
 * - DeepSeek：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 * - Qwen：https://help.aliyun.com/zh/model-studio/qwen-plus
 * - Kimi：https://platform.kimi.com/docs/pricing/chat-v1
 * - GLM：https://open.bigmodel.cn/pricing
 * - Qwen-Image：https://help.aliyun.com/zh/model-studio/qwen-image-3-0-pro
 * - Seedream：https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing
 */

const CNY = 'CNY'
const TOKEN_UNIT = 'per 1M tokens'
const IMAGE_UNIT = 'per image'

/** 统一积分制：100 积分 = 1 元，人民币仅保留给管理中心实价分析。 */
export const CREDIT_VALUE_CNY = 0.01
export const CREDITS_PER_CNY = 100

export function creditsFromCny(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Number((amount * CREDITS_PER_CNY).toFixed(2))
}

export function cnyFromCredits(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Number((amount * CREDIT_VALUE_CNY).toFixed(6))
}

export const DEEPSEEK_PRICING = {
  provider: 'DeepSeek',
  providerLabel: '深度求索',
  currency: CNY,
  unit: TOKEN_UNIT,
  source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
  checkedAt: '2026-11-16',
  effectiveAt: '2026-09-10T12:00:00+08:00',
  peakRule: {
    timezone: 'Asia/Shanghai',
    weekdayPeakRanges: [[9, 12], [14, 18]],
    excludesCnPublicHolidays: true,
  },
  holidayCoverage: { from: '2026-01-01', to: '2026-12-31' },
  models: {
    'deepseek-flash': {
      provider: 'DeepSeek',
      providerLabel: '深度求索',
      displayName: 'DeepSeek-V4.1-Flash',
      tier: 'flash',
      aliases: [
        'deepseek-v4-flash',
        'deepseek-v4-flash-vision-exp',
        'deepseek-v4.1-flash',
        'deepseek-v4-1-flash',
        'deepseek-chat',
        'deepseek-reasoner',
      ],
      aliasNote: 'deepseek-chat / deepseek-reasoner 为旧模型名，暂按当前 V4.1-Flash 价目映射；若实际账单仍按旧表，金额可能偏低',
      billingMode: 'peak-offpeak',
      billingNote: '输入按缓存命中/未命中分价；输出单独计价；高峰价为空闲价的 2 倍',
      offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4, cacheWrite: 0 },
      peak: { cacheHit: 0.04, cacheMiss: 2, output: 8, cacheWrite: 0 },
      source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    },
    'deepseek-v4-pro': {
      provider: 'DeepSeek',
      providerLabel: '深度求索',
      displayName: 'DeepSeek-V4-Pro',
      tier: 'pro',
      aliases: ['deepseek-pro'],
      aliasNote: '',
      billingMode: 'peak-offpeak',
      billingNote: '官方已于 2026-09-14 12:00 将 deepseek-v4-pro 请求路由到 V4.1 Flash，并按 Flash 单价计费；下列 Pro 原价仅作历史目录，实际计费走 flash 价目',
      routedTo: 'deepseek-flash',
      routedNote: 'V4 Pro 已按官方路由到 V4.1 Flash 计费，不按 Pro 原价计价',
      offPeak: { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5, cacheWrite: 0 },
      peak: { cacheHit: 0.3, cacheMiss: 9, output: 27, cacheWrite: 0 },
      source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
    },
  },
}

/**
 * 阿里云百炼 Qwen-Plus：按单次请求输入长度分档，不区分峰谷。
 * 非思考模式输出 2 元/M；思考模式输出 8 元/M，并根据 reasoningTokens 是否 > 0 切换。
 */
export const QWEN_PRICING = {
  provider: 'Qwen',
  providerLabel: '阿里云百炼',
  currency: CNY,
  unit: TOKEN_UNIT,
  source: 'https://help.aliyun.com/zh/model-studio/qwen-plus',
  checkedAt: '2026-11-17',
  models: {
    'qwen-plus': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen-Plus',
      tier: 'plus',
      aliases: ['qwen-plus-latest', 'qwen-plus-2025-12-01'],
      aliasNote: 'qwen-plus-latest / qwen-plus-2025-12-01 为同能力快照或动态版本，按 qwen-plus 价目映射',
      billingMode: 'tiered',
      billingNote: '按单次请求输入长度分档，无峰谷；隐式缓存命中 0.16/0.48/0.96，显式缓存命中 0.08/0.24/0.48，显式缓存创建 1/3/6 元/M；思考模式输出单独计价',
      tiers: [
        {
          maxInputTokens: 128 * 1024,
          label: '输入 ≤128K',
          cacheHit: 0.16,
          explicitCacheHit: 0.08,
          cacheMiss: 0.8,
          output: 2,
          thinkingOutput: 8,
          cacheWrite: 1,
        },
        {
          maxInputTokens: 256 * 1024,
          label: '128K < 输入 ≤256K',
          cacheHit: 0.48,
          explicitCacheHit: 0.24,
          cacheMiss: 2.4,
          output: 20,
          thinkingOutput: 24,
          cacheWrite: 3,
        },
        {
          maxInputTokens: 1_000_000,
          label: '256K < 输入 ≤1M',
          cacheHit: 0.96,
          explicitCacheHit: 0.48,
          cacheMiss: 4.8,
          output: 48,
          thinkingOutput: 64,
          cacheWrite: 6,
        },
      ],
      source: 'https://help.aliyun.com/zh/model-studio/qwen-plus',
    },
    'qwen3.6-plus': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen3.6-Plus',
      tier: 'plus',
      aliases: ['qwen3.6-plus-2026-04-02'],
      aliasNote: 'qwen3.6-plus 当前能力等同于 2026-04-02 快照',
      billingMode: 'tiered',
      billingNote: '≤256K 输入 2 / 输出 12；256K–1M 输入 8 / 输出 48；显式缓存创建 2.5/10，显式缓存命中 0.2/0.8 元/M',
      tiers: [
        {
          maxInputTokens: 256 * 1024,
          label: '输入 ≤256K',
          cacheHit: 0.2,
          explicitCacheHit: 0.2,
          cacheMiss: 2,
          output: 12,
          thinkingOutput: 12,
          cacheWrite: 2.5,
        },
        {
          maxInputTokens: 1_000_000,
          label: '256K < 输入 ≤1M',
          cacheHit: 0.8,
          explicitCacheHit: 0.8,
          cacheMiss: 8,
          output: 48,
          thinkingOutput: 48,
          cacheWrite: 10,
        },
      ],
      source: 'https://help.aliyun.com/zh/model-studio/qwen3-6-plus',
    },
    'qwen3.6-flash': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen3.6-Flash',
      tier: 'flash',
      aliases: ['qwen3.6-flash-2026-04-16'],
      aliasNote: 'qwen3.6-flash 当前能力等同于 2026-04-16 快照',
      billingMode: 'tiered',
      billingNote: '≤256K 输入 1.2 / 输出 7.2；256K–1M 输入 4.8 / 输出 28.8；显式缓存创建 1.5/6，显式缓存命中 0.12/0.48 元/M',
      tiers: [
        {
          maxInputTokens: 256 * 1024,
          label: '输入 ≤256K',
          cacheHit: 0.12,
          explicitCacheHit: 0.12,
          cacheMiss: 1.2,
          output: 7.2,
          thinkingOutput: 7.2,
          cacheWrite: 1.5,
        },
        {
          maxInputTokens: 1_000_000,
          label: '256K < 输入 ≤1M',
          cacheHit: 0.48,
          explicitCacheHit: 0.48,
          cacheMiss: 4.8,
          output: 28.8,
          thinkingOutput: 28.8,
          cacheWrite: 6,
        },
      ],
      source: 'https://help.aliyun.com/zh/model-studio/qwen3-6-flash',
    },
    'qwen3.7-plus': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen3.7-Plus',
      tier: 'plus',
      aliases: ['qwen3.7-plus-2026-05-26'],
      aliasNote: 'qwen3.7-plus 当前能力等同于 2026-05-26 快照',
      billingMode: 'tiered',
      billingNote: '≤256K 输入 2 / 输出 8；256K–1M 输入 6 / 输出 24；输入缓存命中 0.4/1.2，显式缓存命中 0.2/0.6 元/M',
      tiers: [
        {
          maxInputTokens: 256 * 1024,
          label: '输入 ≤256K',
          cacheHit: 0.4,
          explicitCacheHit: 0.2,
          cacheMiss: 2,
          output: 8,
          thinkingOutput: 8,
          cacheWrite: 2.5,
        },
        {
          maxInputTokens: 1_000_000,
          label: '256K < 输入 ≤1M',
          cacheHit: 1.2,
          explicitCacheHit: 0.6,
          cacheMiss: 6,
          output: 24,
          thinkingOutput: 24,
          cacheWrite: 7.5,
        },
      ],
      source: 'https://help.aliyun.com/zh/model-studio/qwen3-7-plus',
    },
    'qwen3.8-max': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen3.8-Max',
      tier: 'max',
      aliases: ['qwen3.8-max-0902'],
      aliasNote: 'qwen3.8-max 当前能力等同于 2026-09-02 快照',
      billingMode: 'flat',
      billingNote: '输入 12 / 输出 36 元/M；输入缓存命中 1.5，显式缓存创建 15，显式缓存命中 1 元/M',
      cacheHit: 1.5,
      explicitCacheHit: 1,
      cacheMiss: 12,
      output: 36,
      thinkingOutput: 36,
      cacheWrite: 15,
      rates: { cacheHit: 1.5, explicitCacheHit: 1, cacheMiss: 12, output: 36, thinkingOutput: 36, cacheWrite: 15 },
      source: 'https://help.aliyun.com/zh/model-studio/qwen3-8-max',
    },
    'qwen4-max': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen4-Max',
      tier: 'max',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '0 < 输入 ≤ 1M：输入 10 / 输出 30 元/M（思考同价）；缓存命中 0.5；创建缓存 5min 12.5、1h 20 元/M，默认按 5min 价计',
      cacheHit: 0.5,
      explicitCacheHit: 0.5,
      cacheMiss: 10,
      output: 30,
      thinkingOutput: 30,
      cacheWrite: 12.5,
      rates: { cacheHit: 0.5, explicitCacheHit: 0.5, cacheMiss: 10, output: 30, thinkingOutput: 30, cacheWrite: 12.5 },
      contextWindow: 1_000_000,
      source: 'https://help.aliyun.com/zh/model-studio/model-pricing',
    },
  },
}

export const KIMI_PRICING = {
  provider: 'Moonshot',
  providerLabel: '月之暗面',
  currency: CNY,
  unit: TOKEN_UNIT,
  source: 'https://platform.kimi.com/docs/pricing/chat-v1',
  checkedAt: '2026-11-17',
  models: {
    'moonshot-v1-8k': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Moonshot V1 8K',
      tier: 'legacy',
      aliases: ['moonshot-v1-8k-vision-preview'],
      aliasNote: '视觉预览版与 8K 文本版同价',
      billingMode: 'flat',
      billingNote: '标准输入/输出固定价；上下文缓存命中当前限时免费，Cache 创建按 4 元/M tokens 计；Cache 调用 0.01 元/次、缓存存储 1 元/M/min 未并入（usage 无对应字段）',
      rates: { cacheHit: 0, cacheMiss: 2, output: 10, cacheWrite: 4 },
      source: 'https://platform.kimi.com/docs/pricing/chat-v1',
    },
    'moonshot-v1-32k': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Moonshot V1 32K',
      tier: 'legacy',
      aliases: ['moonshot-v1-32k-vision-preview'],
      aliasNote: '视觉预览版与 32K 文本版同价',
      billingMode: 'flat',
      billingNote: '标准输入/输出固定价；上下文缓存命中当前限时免费，Cache 创建按 4 元/M tokens 计；Cache 调用 0.01 元/次、缓存存储 1 元/M/min 未并入（usage 无对应字段）',
      rates: { cacheHit: 0, cacheMiss: 5, output: 20, cacheWrite: 4 },
      source: 'https://platform.kimi.com/docs/pricing/chat-v1',
    },
    'moonshot-v1-128k': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Moonshot V1 128K',
      tier: 'legacy',
      aliases: ['moonshot-v1-128k-vision-preview'],
      aliasNote: '视觉预览版与 128K 文本版同价',
      billingMode: 'flat',
      billingNote: '标准输入/输出固定价；上下文缓存命中当前限时免费，Cache 创建按 4 元/M tokens 计；Cache 调用 0.01 元/次、缓存存储 1 元/M/min 未并入（usage 无对应字段）',
      rates: { cacheHit: 0, cacheMiss: 10, output: 30, cacheWrite: 4 },
      source: 'https://platform.kimi.com/docs/pricing/chat-v1',
    },
    'kimi-k2.6': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K2.6',
      tier: 'standard',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '缓存命中 1.10 元/M，输入 6.50 元/M，输出 27 元/M',
      rates: { cacheHit: 1.1, cacheMiss: 6.5, output: 27, cacheWrite: 0 },
      source: 'https://platform.moonshot.cn/',
    },
    'kimi-k2.5': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K2.5',
      tier: 'standard',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '缓存命中 0.70 元/M，输入 4 元/M，输出 21 元/M',
      rates: { cacheHit: 0.7, cacheMiss: 4, output: 21, cacheWrite: 0 },
      source: 'https://platform.moonshot.cn/',
    },
    'kimi-k3.1-pro': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K3.1 Pro',
      tier: 'pro',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '输入 13 / 输出 68 元/M；缓存命中 1.3；缓存写入 5min 13、1h 26 元/M，默认按 5min 价计',
      rates: { cacheHit: 1.3, cacheMiss: 13, output: 68, cacheWrite: 13 },
      source: 'https://platform.kimi.com/docs/pricing/chat',
    },
    'kimi-k3.1-pro-highspeed': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K3.1 Pro Highspeed',
      tier: 'pro',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '高速版：输入 26 / 输出 136 元/M；缓存命中 1.3；缓存写入 5min 26、1h 52 元/M，默认按 5min 价计',
      rates: { cacheHit: 1.3, cacheMiss: 26, output: 136, cacheWrite: 26 },
      source: 'https://platform.kimi.com/docs/pricing/chat',
    },
    'kimi-k3': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K3',
      tier: 'standard',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '输入 20 / 输出 100 元/M；缓存命中 2；缓存写入 5min 20、1h 40 元/M，默认按 5min 价计',
      rates: { cacheHit: 2, cacheMiss: 20, output: 100, cacheWrite: 20 },
      source: 'https://platform.kimi.com/docs/pricing/chat',
    },
    'kimi-k2.7-code': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K2.7 Code',
      tier: 'standard',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '代码模型：输入 6.5 / 输出 27 元/M；缓存命中 1.3 元/M',
      rates: { cacheHit: 1.3, cacheMiss: 6.5, output: 27, cacheWrite: 0 },
      source: 'https://platform.kimi.com/docs/pricing/chat',
    },
    'kimi-k2.7-code-highspeed': {
      provider: 'Moonshot',
      providerLabel: '月之暗面',
      displayName: 'Kimi K2.7 Code Highspeed',
      tier: 'standard',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '代码模型高速版：输入 13 / 输出 54 元/M；缓存命中 2.6 元/M',
      rates: { cacheHit: 2.6, cacheMiss: 13, output: 54, cacheWrite: 0 },
      source: 'https://platform.kimi.com/docs/pricing/chat',
    },
  },
}

export const GLM_PRICING = {
  provider: 'Zhipu',
  providerLabel: '智谱 AI',
  currency: CNY,
  unit: TOKEN_UNIT,
  source: 'https://open.bigmodel.cn/pricing',
  checkedAt: '2026-11-17',
  models: {
    'glm-4.7-flash': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-4.7-Flash',
      tier: 'free',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '免费模型，输入/输出/缓存均为 0 元',
      free: true,
      rates: { cacheHit: 0, cacheMiss: 0, output: 0, cacheWrite: 0 },
      source: 'https://bigmodel.cn/pricing',
    },
    'glm-4.6v-flash': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-4.6V-Flash',
      tier: 'free',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '免费视觉模型，输入/输出/缓存均为 0 元',
      free: true,
      rates: { cacheHit: 0, cacheMiss: 0, output: 0, cacheWrite: 0 },
      source: 'https://bigmodel.cn/pricing',
    },
    'glm-4-flash': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-4-Flash',
      tier: 'free',
      aliases: ['glm-4-flash-250414'],
      aliasNote: 'GLM-4-Flash 系列为免费模型',
      billingMode: 'flat',
      billingNote: '免费模型，输入/输出/缓存均为 0 元',
      free: true,
      rates: { cacheHit: 0, cacheMiss: 0, output: 0, cacheWrite: 0 },
      source: 'https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414',
    },
    'glm-5v-turbo': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-5V-Turbo',
      tier: 'standard',
      aliases: [],
      aliasNote: '',
      billingMode: 'tiered',
      billingNote: '按单次请求输入长度分档：0–32K 输入 5 / 缓存 1.2 / 输出 22；32K+ 输入 7 / 缓存 1.8 / 输出 26 元/M',
      tiers: [
        {
          maxInputTokens: 32 * 1024,
          label: '输入 ≤32K',
          cacheHit: 1.2,
          cacheMiss: 5,
          output: 22,
          cacheWrite: 0,
        },
        {
          maxInputTokens: 1_000_000,
          label: '32K < 输入',
          cacheHit: 1.8,
          cacheMiss: 7,
          output: 26,
          cacheWrite: 0,
        },
      ],
      source: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
    },
    'glm-5.3-flash': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-5.3-Flash',
      tier: 'flash',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '输入 0.8 元/M，缓存命中 0.23 元/M，输出 2.8 元/M；缓存存储限时免费；官方另列限时五折 0.4/0.115/1.4，当前按标准价计价',
      rates: { cacheHit: 0.23, cacheMiss: 0.8, output: 2.8, cacheWrite: 0 },
      source: 'https://open.bigmodel.cn/pricing',
    },
    'glm-5.3-flashx': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-5.3-FlashX',
      tier: 'flash',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '输入 2 元/M，缓存命中 0.57 元/M，输出 7 元/M；缓存存储限时免费',
      rates: { cacheHit: 0.57, cacheMiss: 2, output: 7, cacheWrite: 0 },
      source: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
    },
    'glm-5.3': {
      provider: 'Zhipu',
      providerLabel: '智谱 AI',
      displayName: 'GLM-5.3',
      tier: 'pro',
      aliases: [],
      aliasNote: '',
      billingMode: 'flat',
      billingNote: '输入 8 元/M，缓存命中 2 元/M，输出 28 元/M；缓存存储限时免费',
      rates: { cacheHit: 2, cacheMiss: 8, output: 28, cacheWrite: 0 },
      source: 'https://open.bigmodel.cn/pricing',
    },
  },
}

export const IMAGE_PRICING = {
  provider: 'Image',
  currency: CNY,
  unit: IMAGE_UNIT,
  checkedAt: '2026-11-16',
  models: {
    'qwen-image-3.0-pro': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen-Image 3.0 Pro',
      tier: 'pro',
      aliases: ['qwen-image-3.0-pro-2026-04-22', 'qwen-image-3.0-pro-2026-06-22'],
      aliasNote: '按输出图像分辨率分档：1K 0.25 元/张，2K 0.5 元/张；输入图 0.02 元/张',
      billingMode: 'image-resolution',
      inputPerImage: 0.02,
      outputTiers: [
        { maxPixels: 1024 * 1024, label: '1K', price: 0.25 },
        { maxPixels: Infinity, label: '2K', price: 0.5 },
      ],
      source: 'https://help.aliyun.com/zh/model-studio/qwen-image-3-0-pro',
    },
    'qwen-image-3.0': {
      provider: 'Qwen',
      providerLabel: '阿里云百炼',
      displayName: 'Qwen-Image 3.0',
      tier: 'standard',
      aliases: [],
      aliasNote: '1K/2K 均 0.18 元/张；输入图 0.02 元/张',
      billingMode: 'image-resolution',
      inputPerImage: 0.02,
      outputTiers: [{ maxPixels: Infinity, label: '1K/2K', price: 0.18 }],
      source: 'https://help.aliyun.com/zh/model-studio/qwen-image-3-0',
    },
    'seedream-5.5': {
      provider: 'Seedream',
      providerLabel: '火山方舟',
      displayName: 'Seedream 5.5',
      tier: 'pro',
      aliases: ['doubao-seedream-5-5-261028'],
      aliasNote: '输出 ≤2.61M 像素 0.13 元/张，2.61M–4.63M 像素 0.23 元/张；输入图 0.05 元/张',
      billingMode: 'image-resolution',
      inputPerImage: 0.05,
      outputTiers: [
        { maxPixels: 2_610_000, label: 'P ≤ 2.61M', price: 0.13 },
        { maxPixels: Infinity, label: '2.61M < P ≤ 4.63M', price: 0.23 },
      ],
      source: 'https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing',
    },
  },
}

/** DeepSeek 除 token 外的按次/按量服务价格；当前 usage 汇总没有这些计数字段。 */
export const SERVICE_PRICING = {
  provider: 'DeepSeek',
  currency: CNY,
  source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
  checkedAt: '2026-11-16',
  items: [
    { key: 'search', label: '搜索（文字、图片）', unit: 'per 1,000 calls', price: 5 },
    { key: 'fetch', label: '网页抓取', unit: 'per 1,000 calls', price: 5 },
    { key: 'fileParse', label: '文件解析 / OCR', unit: 'per 1,000 pages', price: 1.5 },
    { key: 'tts', label: '语音合成 TTS', unit: 'per 10,000 chars', price: 3, discountPrice: 1.5 },
    { key: 'asr', label: '语音识别 ASR', unit: 'per hour audio', price: 0.78, discountPrice: 0.39 },
  ],
}

export const TEXT_PRICING = {
  currency: CNY,
  unit: TOKEN_UNIT,
  checkedAt: '2026-11-17',
  providers: [DEEPSEEK_PRICING, QWEN_PRICING, KIMI_PRICING, GLM_PRICING],
  models: {
    ...DEEPSEEK_PRICING.models,
    ...QWEN_PRICING.models,
    ...KIMI_PRICING.models,
    ...GLM_PRICING.models,
  },
}

/** 最终上线组合：每个 provider 只保留一个模型入口。 */
export const LAUNCH_MODEL_KEYS = [
  'deepseek-flash',
  'qwen4-max',
  'kimi-k3.1-pro',
  'glm-5.3-flash',
]

/** 最终上线图像生成模型：默认生图/编辑 + 专业图文生成。 */
export const IMAGE_LAUNCH_KEYS = [
  'seedream-5.5',
  'qwen-image-3.0-pro',
]

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateRange(start, end) {
  const rows = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor <= last) {
    rows.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return rows
}

/** 国务院办公厅《关于2026年部分节假日安排的通知》公布的放假日。 */
const CN_HOLIDAYS_2026 = new Set([
  ...dateRange('2026-01-01', '2026-01-03'),
  ...dateRange('2026-02-15', '2026-02-23'),
  ...dateRange('2026-04-04', '2026-04-06'),
  ...dateRange('2026-05-01', '2026-05-05'),
  ...dateRange('2026-06-19', '2026-06-21'),
  ...dateRange('2026-09-25', '2026-09-27'),
  ...dateRange('2026-10-01', '2026-10-07'),
])

const MODEL_ALIASES = Object.entries(TEXT_PRICING.models).reduce((map, [key, value]) => {
  map.set(key, key)
  for (const alias of value.aliases || []) map.set(alias, key)
  return map
}, new Map())

const IMAGE_ALIASES = Object.entries(IMAGE_PRICING.models).reduce((map, [key, value]) => {
  map.set(key, key)
  for (const alias of value.aliases || []) map.set(alias, key)
  return map
}, new Map())

function timestamp(value) {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : NaN
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const text = String(value || '').trim()
  if (!text) return NaN
  const time = Date.parse(text)
  return Number.isFinite(time) ? time : NaN
}

/**
 * 按 usage 发生时间判定北京时间峰谷。
 * 无有效时间时返回 period=unknown，不猜测价格。
 */
export function billingPeriodAt(value) {
  const time = timestamp(value)
  if (!Number.isFinite(time)) {
    return { period: 'unknown', beijingDate: '', beijingHour: null, isHoliday: false, weekday: null }
  }
  const beijing = new Date(time + 8 * 60 * 60 * 1000)
  const year = beijing.getUTCFullYear()
  const month = pad(beijing.getUTCMonth() + 1)
  const day = pad(beijing.getUTCDate())
  const beijingDate = `${year}-${month}-${day}`
  const beijingHour = beijing.getUTCHours()
  const weekday = beijing.getUTCDay()
  const isHoliday = CN_HOLIDAYS_2026.has(beijingDate)
  const isWeekday = weekday >= 1 && weekday <= 5
  const isPeakHour = (beijingHour >= 9 && beijingHour < 12) || (beijingHour >= 14 && beijingHour < 18)
  const period = isWeekday && !isHoliday && isPeakHour ? 'peak' : 'off-peak'
  return { period, beijingDate, beijingHour, isHoliday, weekday }
}

/** 解析文本模型对应的计费模型；未知模型返回 null，不猜测价格。 */
export function resolvePriceModel(model) {
  const name = String(model || '').trim()
  const key = MODEL_ALIASES.get(name)
  if (!key) return null
  return {
    key,
    name,
    ...TEXT_PRICING.models[key],
    alias: key !== name,
  }
}

/**
 * 解析图像模型对应的计费模型；未知模型返回 null，不猜测价格。
 */
export function resolveImagePriceModel(model) {
  const name = String(model || '').trim()
  const key = IMAGE_ALIASES.get(name)
  if (!key) return null
  return {
    key,
    name,
    ...IMAGE_PRICING.models[key],
    alias: key !== name,
  }
}

function roundCost(value) {
  return Number(value.toFixed(6))
}

function emptyBreakdown() {
  return { cacheHit: 0, cacheMiss: 0, write: 0, output: 0 }
}

function totalInputTokens(usage) {
  return number(usage.inputTokens) + number(usage.cacheReadTokens) + number(usage.cacheWriteTokens)
}

function tierFor(model, tokens) {
  if (!Array.isArray(model.tiers) || !model.tiers.length) return null
  return model.tiers.find((tier) => tokens <= number(tier.maxInputTokens)) || model.tiers[model.tiers.length - 1]
}

function ratesFor(model, usage, period) {
  if (model.billingMode === 'peak-offpeak') {
    return period.period === 'peak' ? model.peak : model.offPeak
  }
  if (model.billingMode === 'tiered') {
    return tierFor(model, totalInputTokens(usage))
  }
  return model.rates
}

function creditsBreakdown(breakdown = {}) {
  const next = {}
  for (const [key, value] of Object.entries(breakdown || {})) next[key] = creditsFromCny(value)
  return next
}

function baseResult(pricedModel) {
  return {
    priced: false,
    reason: '',
    costCny: 0,
    costCredits: 0,
    costBreakdownCny: emptyBreakdown(),
    costBreakdownCredits: creditsBreakdown(emptyBreakdown()),
    billingPeriod: 'unknown',
    pricingModel: pricedModel?.key || '',
    requestedPricingModel: pricedModel?.key || '',
    pricingNote: pricedModel?.aliasNote || '',
    pricingMode: pricedModel?.billingMode || '',
    pricingTier: '',
    tier: pricedModel?.tier || '',
    pricedTokens: 0,
    unpricedTokens: 0,
  }
}

/**
 * 用真实 usage 字段计算人民币金额。
 * - inputTokens 视为缓存未命中的新增输入；
 * - cacheReadTokens 视为缓存命中输入；
 * - cacheWriteTokens 视为上下文缓存创建；
 * - outputTokens 单独按输出价；reasoningTokens > 0 时按思考模式输出价；
 * - 峰谷模型缺 usageAt 时保持未计价，不猜档。
 */
export function priceUsage({ model, usage = {}, at } = {}) {
  const pricedModel = resolvePriceModel(model)
  const result = baseResult(pricedModel)
  result.unpricedTokens = totalInputTokens(usage) + number(usage.outputTokens)
  if (!pricedModel) {
    result.reason = 'unknown-model'
    return result
  }

  // 官方路由：如 V4 Pro 已路由到 V4.1 Flash 时，按实际计费模型计价。
  const billedModel = pricedModel.routedTo ? resolvePriceModel(pricedModel.routedTo) : pricedModel
  if (!billedModel) {
    result.reason = 'unknown-routed-model'
    return result
  }

  const period = billingPeriodAt(at)
  if (billedModel.billingMode === 'peak-offpeak' && period.period === 'unknown') {
    result.reason = 'missing-usage-at'
    return result
  }

  const rates = ratesFor(billedModel, usage, period)
  if (!rates) {
    result.reason = 'missing-price-tier'
    return result
  }

  const cacheHitTokens = number(usage.cacheReadTokens)
  const cacheMissTokens = number(usage.inputTokens)
  const cacheWriteTokens = number(usage.cacheWriteTokens)
  const outputTokens = number(usage.outputTokens)
  const explicitCache = String(usage.cacheMode || '').toLowerCase() === 'explicit'
  const cacheHitRate = explicitCache && rates.explicitCacheHit != null
    ? number(rates.explicitCacheHit)
    : number(rates.cacheHit)
  const thinking = number(usage.reasoningTokens) > 0 && number(rates.thinkingOutput) > 0
  const outputRate = thinking ? number(rates.thinkingOutput) : number(rates.output)
  const cacheHit = (cacheHitTokens * cacheHitRate) / 1_000_000
  const cacheMiss = (cacheMissTokens * number(rates.cacheMiss)) / 1_000_000
  const cacheWrite = (cacheWriteTokens * number(rates.cacheWrite)) / 1_000_000
  const output = (outputTokens * outputRate) / 1_000_000
  const costCny = roundCost(cacheHit + cacheMiss + cacheWrite + output)
  const costBreakdownCny = {
    cacheHit: roundCost(cacheHit),
    cacheMiss: roundCost(cacheMiss),
    write: roundCost(cacheWrite),
    output: roundCost(output),
  }
  return {
    priced: true,
    reason: '',
    costCny,
    costCredits: creditsFromCny(costCny),
    costBreakdownCny,
    costBreakdownCredits: creditsBreakdown(costBreakdownCny),
    billingPeriod: billedModel.billingMode === 'peak-offpeak' ? period.period : 'flat',
    billingPeriodInfo: billedModel.billingMode === 'peak-offpeak'
      ? period
      : { period: 'flat', tier: rates.label || '', thinking },
    pricingModel: billedModel.key,
    requestedPricingModel: pricedModel.key,
    pricingNote: [pricedModel.routedNote, billedModel.aliasNote].filter(Boolean).join('；')
      || billedModel.billingNote
      || '',
    pricingMode: billedModel.billingMode,
    pricingTier: rates.label || '',
    tier: billedModel.tier || '',
    pricedTokens: cacheHitTokens + cacheMissTokens + cacheWriteTokens + outputTokens,
    unpricedTokens: 0,
  }
}

/**
 * 按真实图像尺寸与张数计算人民币金额。
 * 图像生成接口按张计费；缺少输出尺寸时保持未计价，不默认最低档。
 */
export function priceImage({ model, width, height, pixels, inputImages = 0, outputImages = 1 } = {}) {
  const pricedModel = resolveImagePriceModel(model)
  const result = {
    priced: false,
    reason: '',
    costCny: 0,
    costCredits: 0,
    costBreakdownCny: { input: 0, output: 0 },
    costBreakdownCredits: { input: 0, output: 0 },
    pricingModel: pricedModel?.key || '',
    pricingNote: pricedModel?.aliasNote || '',
    pricingMode: pricedModel?.billingMode || '',
    pricingTier: '',
    tier: pricedModel?.tier || '',
    outputImages: number(outputImages),
    inputImages: number(inputImages),
  }
  if (!pricedModel) {
    result.reason = 'unknown-image-model'
    return result
  }

  const outputCount = number(outputImages)
  const inputCount = number(inputImages)
  let outputUnit = number(pricedModel.flatOutputPerImage)
  if (pricedModel.billingMode === 'image-resolution') {
    const area = number(pixels) || (number(width) > 0 && number(height) > 0 ? number(width) * number(height) : 0)
    if (!area) {
      result.reason = 'missing-image-size'
      return result
    }
    const tier = (pricedModel.outputTiers || []).find((item) => area <= number(item.maxPixels))
      || (pricedModel.outputTiers || [])[pricedModel.outputTiers.length - 1]
    if (!tier) {
      result.reason = 'missing-price-tier'
      return result
    }
    outputUnit = number(tier.price)
    result.pricingTier = tier.label
  } else if (pricedModel.billingMode !== 'image-flat') {
    result.reason = 'unsupported-image-billing'
    return result
  }

  const inputCost = inputCount * number(pricedModel.inputPerImage)
  const outputCost = outputCount * outputUnit
  const costCny = roundCost(inputCost + outputCost)
  const costBreakdownCny = { input: roundCost(inputCost), output: roundCost(outputCost) }
  return {
    ...result,
    priced: true,
    costCny,
    costCredits: creditsFromCny(costCny),
    costBreakdownCny,
    costBreakdownCredits: creditsBreakdown(costBreakdownCny),
  }
}

function modelRow(key, value) {
  return {
    model: key,
    displayName: value.displayName,
    provider: value.provider,
    providerLabel: value.providerLabel,
    tier: value.tier || '',
    billingMode: value.billingMode,
    billingNote: value.billingNote || '',
    routedTo: value.routedTo || '',
    routedNote: value.routedNote || '',
    aliases: value.aliases || [],
    aliasNote: value.aliasNote || '',
    rates: value.rates || null,
    offPeak: value.offPeak || null,
    peak: value.peak || null,
    tiers: value.tiers || null,
    free: Boolean(value.free),
    source: value.source,
  }
}

function imageRow(key, value) {
  return {
    model: key,
    displayName: value.displayName,
    provider: value.provider,
    providerLabel: value.providerLabel,
    tier: value.tier || '',
    billingMode: value.billingMode,
    aliasNote: value.aliasNote || '',
    inputPerImage: number(value.inputPerImage),
    flatOutputPerImage: value.flatOutputPerImage == null ? null : number(value.flatOutputPerImage),
    outputTiers: value.outputTiers || null,
    source: value.source,
  }
}

/** 全模型价目摘要，供 /api/usage/summary 与 Token 面板展示。 */
export function pricingSummary() {
  const providers = TEXT_PRICING.providers.map((provider) => ({
    provider: provider.provider,
    providerLabel: provider.providerLabel,
    currency: provider.currency,
    unit: provider.unit,
    source: provider.source,
    checkedAt: provider.checkedAt,
    peakRule: provider.peakRule || null,
    holidayCoverage: provider.holidayCoverage || null,
  }))
  return {
    currency: CNY,
    unit: TOKEN_UNIT,
    checkedAt: TEXT_PRICING.checkedAt,
    credits: {
      valueCny: CREDIT_VALUE_CNY,
      perCny: CREDITS_PER_CNY,
      note: '100 积分 = 1 元；智能中枢统一展示积分，管理中心按人民币展示实价。',
    },
    providers,
    launchModels: LAUNCH_MODEL_KEYS.map((key) => modelRow(key, TEXT_PRICING.models[key])).filter((row) => row.model),
    launchImageModels: IMAGE_LAUNCH_KEYS.map((key) => imageRow(key, IMAGE_PRICING.models[key])).filter((row) => row.model),
    textModels: Object.entries(TEXT_PRICING.models).map(([key, value]) => modelRow(key, value)),
    imageModels: Object.entries(IMAGE_PRICING.models).map(([key, value]) => imageRow(key, value)),
    services: SERVICE_PRICING.items,
    serviceSource: SERVICE_PRICING.source,
    note: '文本按真实 tokens 计价，图像按真实张数与像素档计价；峰谷/分档/缓存/固定价/免费模型分别处理，缺字段不估算。',
  }
}

/** 兼容旧调用方：只返回 DeepSeek 价目。 */
export function deepseekPricingSummary() {
  return {
    currency: DEEPSEEK_PRICING.currency,
    unit: DEEPSEEK_PRICING.unit,
    source: DEEPSEEK_PRICING.source,
    checkedAt: DEEPSEEK_PRICING.checkedAt,
    effectiveAt: DEEPSEEK_PRICING.effectiveAt,
    peakRule: DEEPSEEK_PRICING.peakRule,
    holidayCoverage: DEEPSEEK_PRICING.holidayCoverage,
    models: Object.entries(DEEPSEEK_PRICING.models).map(([model, value]) => ({
      model,
      displayName: value.displayName,
      aliases: value.aliases || [],
      aliasNote: value.aliasNote || '',
      offPeak: value.offPeak,
      peak: value.peak,
    })),
    note: '按 message.usageAt 的北京时间判定峰谷；跨峰谷的单轮按该时间归入一档。',
  }
}
