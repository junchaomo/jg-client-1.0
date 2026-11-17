/**
 * 官方价格源变动监控。
 *
 * 只做“抓取 → 归一化 → 内容指纹对比 → 标记待核对”，不会自动改写价格数字：
 * 官方页面含活动价、区域价和表格排版变化，自动抽取容易把限时价/海外价误当成标准价。
 * 管理中心据此提示人工核对，核对后再更新 pricing.mjs 并重新测试。
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const PRICING_SOURCES = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: '文本',
    url: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',
  },
  {
    id: 'qwen',
    label: '阿里云百炼',
    kind: '文本',
    url: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  },
  {
    id: 'kimi',
    label: '月之暗面',
    kind: '文本',
    url: 'https://platform.kimi.com/docs/pricing/chat',
  },
  {
    id: 'glm',
    label: '智谱 AI',
    kind: '文本',
    url: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
  },
  {
    id: 'qwen-image',
    label: 'Qwen-Image',
    kind: '图像',
    url: 'https://help.aliyun.com/zh/model-studio/qwen-image-3-0-pro',
  },
  {
    id: 'seedream',
    label: 'Seedream',
    kind: '图像',
    url: 'https://console.volcengine.com/ark/region:cn-beijing/docs/model-pricing',
  },
]

const STATE_FILE = 'pricing-watch.json'
const MAX_ALERTS = 40
const FETCH_TIMEOUT_MS = 25_000
const SIGNATURE_VERSION = 'price-fields-v1'

function normalizePage(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260_000)
}

/**
 * 只保留价格行。官方文档的导航、公告、推荐位和样式会频繁变化，但不影响价格；
 * 整页指纹会把这些变化误报成“价格变动”。这里按表格行/段落拆行，只对同时包含
 * 数字和价格信号的文本做指纹。
 */
function priceEvidence(value) {
  const lines = String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?(?:tr|p|div|h[1-6]|li|br|section|article|table|thead|tbody|ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&yen;|&#165;/gi, '¥')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .split('\n')
  const signals = []
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line || !/[0-9]/.test(line)) continue
    if (!/(?:¥|￥|元|价格|单价|计费|收费|免费|MTok|Tokens|token|缓存)/i.test(line)) continue
    signals.push(line)
  }
  return signals.join('\n').slice(0, 120_000)
}

function fingerprint(text) {
  return createHash('sha256').update(text).digest('hex')
}

function stamp() {
  return new Date().toISOString()
}

async function defaultFetchText(url) {
  if (typeof fetch !== 'function') throw new Error('当前 Node 运行时没有 fetch')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JG-Harness-PricingWatch/1.0',
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

export function createPricingWatch({
  dataDir,
  fetchText = defaultFetchText,
  sources = PRICING_SOURCES,
  intervalMs = 6 * 60 * 60 * 1000,
  catalog = null,
} = {}) {
  if (!dataDir) throw new Error('createPricingWatch 需要 dataDir')
  const statePath = path.join(dataDir, STATE_FILE)
  let running = null
  let timer = null

  async function readState() {
    try {
      const raw = await readFile(statePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return {
          version: 'auto-detect-v2',
          lastCheckedAt: parsed.lastCheckedAt || '',
          lastStartedAt: parsed.lastStartedAt || '',
          sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
          alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
        }
      }
    } catch {
      // 首次运行或状态文件损坏时从空基线开始。
    }
    return { version: 'auto-detect-v2', lastCheckedAt: '', lastStartedAt: '', sources: {}, alerts: [] }
  }

  async function writeState(state) {
    await mkdir(dataDir, { recursive: true })
    const temp = `${statePath}.tmp`
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
    await rename(temp, statePath)
  }

  async function checkOnce() {
    const state = await readState()
    const startedAt = stamp()
    const nextSources = { ...state.sources }
    let alerts = [...state.alerts]
    for (const source of sources) {
      const previous = nextSources[source.id] || {}
      try {
        const body = await fetchText(source.url)
        const normalized = normalizePage(body)
        const evidence = priceEvidence(body)
        const hash = fingerprint(evidence)
        const sameSignature = previous.mode === SIGNATURE_VERSION
        const changed = Boolean(previous.hash && sameSignature && previous.hash !== hash)
        nextSources[source.id] = {
          ...source,
          status: 'ok',
          httpStatus: 200,
          hash,
          mode: SIGNATURE_VERSION,
          signalChars: evidence.length,
          checks: Number(previous.checks ?? (previous.hash ? 1 : 0)) + 1,
          checkedAt: stamp(),
          changedAt: changed ? stamp() : previous.changedAt || '',
          pending: changed ? true : sameSignature ? Boolean(previous.pending) : false,
          error: '',
          chars: normalized.length,
        }
        if (changed) {
          alerts.unshift({
            id: `${source.id}-${hash.slice(0, 12)}`,
            sourceId: source.id,
            label: source.label,
            kind: source.kind,
            url: source.url,
            at: stamp(),
            fromHash: previous.hash,
            toHash: hash,
            message: `${source.label} 官方价格字段发生变化，待核对后更新价格目录。`,
          })
        }
      } catch (error) {
        nextSources[source.id] = {
          ...source,
          ...previous,
          id: source.id,
          label: source.label,
          kind: source.kind,
          url: source.url,
          status: 'failed',
          checkedAt: stamp(),
          error: String(error?.message || error).slice(0, 200),
        }
      }
    }
    const migrated = sources.some((source) => state.sources[source.id]?.mode !== SIGNATURE_VERSION)
    if (migrated) alerts = []
    const stateNext = {
      version: 'auto-detect-v2',
      lastStartedAt: startedAt,
      lastCheckedAt: stamp(),
      sources: nextSources,
      alerts: alerts.slice(0, MAX_ALERTS),
    }
    await writeState(stateNext)
    return stateNext
  }

  async function check() {
    if (running) return running
    running = checkOnce().finally(() => { running = null })
    return running
  }

  async function snapshot() {
    const state = await readState()
    const rows = sources.map((source) => ({
      ...source,
      ...(state.sources[source.id] || {}),
    }))
    return {
      version: state.version,
      intervalHours: Math.round(intervalMs / 3_600_000),
      lastCheckedAt: state.lastCheckedAt,
      lastStartedAt: state.lastStartedAt,
      checking: Boolean(running),
      pendingCount: rows.filter((row) => row.pending).length,
      failedCount: rows.filter((row) => row.status === 'failed').length,
      sources: rows,
      alerts: state.alerts,
      catalog: catalog || null,
      boundary: '只监测官方页面中的价格字段指纹；导航、公告、推荐位等非价格内容变化不计入。检测到价格字段变化后标记待核对，避免把限时价、海外区域价或排版变化直接当成标准价。',
    }
  }

  function start() {
    if (timer) return
    const kickoff = setTimeout(() => { check().catch(() => {}) }, 90_000)
    kickoff.unref?.()
    timer = setInterval(() => { check().catch(() => {}) }, intervalMs)
    timer.unref?.()
    return timer
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  async function acknowledge(sourceId, note = '') {
    const state = await readState()
    const source = state.sources[sourceId]
    if (source) {
      source.pending = false
      source.acknowledgedAt = stamp()
      source.acknowledgedNote = String(note || '').slice(0, 200)
    }
    state.alerts = state.alerts.filter((alert) => alert.sourceId !== sourceId)
    await writeState(state)
    return snapshot()
  }

  return { check, snapshot, start, stop, acknowledge, statePath }
}
