/**
 * 运行轨迹与会话日志导出。
 *
 * 轨迹只保存 DSH SDK 本轮真实返回的 events / steps / usage，
 * 不构造演示数据；没有真实事件时，接口直接返回 404。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, basename, relative } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'

const TRACE_VERSION = 1
const MAX_EVENTS = 4000

function safeJson(value) {
  try {
    return JSON.stringify(value, (key, item) => {
      if (typeof item === 'bigint') return item.toString()
      if (typeof item === 'string' && item.length > 120000) return `${item.slice(0, 120000)}…`
      return item
    })
  } catch {
    return JSON.stringify({ error: 'trace-not-serializable' })
  }
}

export function traceRoot(userHome) {
  return join(userHome, 'traces')
}

export function newTraceId() {
  return `TR-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
}

export function tracePath(userHome, conversationId, id) {
  const safeConv = String(conversationId || '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(traceRoot(userHome), safeConv, `${safeId}.json`)
}

export function writeTrace(userHome, payload) {
  const id = payload.traceId
  const file = tracePath(userHome, payload.conversationId, id)
  mkdirSync(join(traceRoot(userHome), String(payload.conversationId || '').replace(/[^a-zA-Z0-9_-]/g, '_')), { recursive: true })
  const trace = {
    version: TRACE_VERSION,
    ...payload,
    events: Array.isArray(payload.events) ? payload.events.slice(-MAX_EVENTS) : [],
    notifications: Array.isArray(payload.notifications) ? payload.notifications.slice(-MAX_EVENTS) : [],
  }
  writeFileSync(file, `${safeJson(trace)}\n`)
  return { id, file, bytes: statSync(file).size, trace }
}

export function readTrace(userHome, conversationId, id) {
  const file = tracePath(userHome, conversationId, id)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function listTraces(userHome, conversationId) {
  const dir = join(traceRoot(userHome), String(conversationId || '').replace(/[^a-zA-Z0-9_-]/g, '_'))
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const file = join(dir, f)
      try { return { id: basename(f, '.json'), bytes: statSync(file).size, at: statSync(file).mtimeMs } } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => b.at - a.at)
}

function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 从真实 SDK 结果计算本轮统计；不产生任何估算以外的演示值。 */
export function buildRunStats({ startedAt, endedAt, model, contextText, steps, usage, events }) {
  const durationMs = Math.max(0, number(endedAt) - number(startedAt))
  const stepRows = Array.isArray(steps) ? steps : []
  const eventRows = Array.isArray(events) ? events : []
  const toolCalls = eventRows.filter((e) => e && e.type === 'tool/call').length
  const toolFailures = stepRows.filter((s) => s && s.status === 'fail').length
  const u = usage && typeof usage === 'object' ? usage : null
  const input = u ? number(u.inputTokens) : 0
  const cacheRead = u ? number(u.cacheReadTokens) : 0
  const cacheWrite = u ? number(u.cacheWriteTokens) : 0
  const cacheBase = input + cacheRead + cacheWrite
  return {
    durationMs,
    model: String(model || ''),
    modelCalls: u ? number(u.calls) : 0,
    inputTokens: input,
    outputTokens: u ? number(u.outputTokens) : 0,
    totalTokens: u ? number(u.totalTokens) || input + number(u.outputTokens) : 0,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: u ? number(u.reasoningTokens) : 0,
    cacheHitRate: cacheBase ? Number((cacheRead / cacheBase).toFixed(3)) : 0,
    contextChars: String(contextText || '').length,
    contextEstimateTokens: Math.ceil(String(contextText || '').length / 4),
    steps: stepRows.length,
    toolCalls,
    toolFailures,
    eventCount: eventRows.length,
    startedAt: number(startedAt),
    endedAt: number(endedAt),
  }
}

/** 只导出 DSH 实际持久化的会话日志；找不到时返回 null。 */
export function findSessionDir(dshHome, sessionId) {
  const clean = String(sessionId || '').trim()
  if (!/^session-[a-zA-Z0-9-]+$/.test(clean)) return null
  const root = join(dshHome, 'sessions')
  if (!existsSync(root)) return null
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let items
    try { items = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const item of items) {
      const full = join(dir, item.name)
      if (item.isDirectory()) {
        if (item.name === clean) return full
        stack.push(full)
      }
    }
  }
  return null
}

/* -------------------------- 最小 ZIP（store） -------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function dosTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

/** 生成标准 ZIP（无压缩）；只用于把真实日志与轨迹打包，不改变原文件。 */
export function buildZip(entries) {
  const local = []
  const central = []
  let offset = 0
  const now = dosTime()
  for (const entry of entries) {
    const name = Buffer.from(String(entry.name || 'file').replace(/\\/g, '/'), 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ''), 'utf8')
    const crc = crc32(data)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(now.time, 10)
    localHeader.writeUInt16LE(now.day, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(data.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)
    local.push(localHeader, name, data)
    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(now.time, 12)
    centralHeader.writeUInt16LE(now.day, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(data.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    central.push(centralHeader, name)
    offset += localHeader.length + name.length + data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...local, centralBuf, end])
}

/** 把真实 session 目录、轨迹和清单打包；没有 session 文件时返回 null。 */
export function buildSessionLogArchive({ dshHome, conversationId, sessionId, trace = null, meta = {} }) {
  const dir = findSessionDir(dshHome, sessionId)
  if (!dir) return null
  const files = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    let items
    try { items = readdirSync(current, { withFileTypes: true }) } catch { continue }
    for (const item of items) {
      const full = join(current, item.name)
      if (item.isDirectory()) stack.push(full)
      else if (item.isFile()) {
        const rel = relative(dir, full).replace(/\\/g, '/')
        files.push({ name: `dsh-session/${rel}`, data: readFileSync(full) })
      }
    }
  }
  if (!files.length) return null
  const manifest = {
    conversationId,
    sessionId,
    exportedAt: new Date().toISOString(),
    traceIncluded: Boolean(trace),
    traceId: trace?.traceId || '',
    meta,
    note: 'DSH 会话日志为 append-only 原始日志；trace.json 是本轮产品侧捕获的 SDK 事件。',
  }
  const entries = [
    { name: 'manifest.json', data: Buffer.from(`${safeJson(manifest)}\n`, 'utf8') },
    { name: 'README.txt', data: Buffer.from('九规智能中枢会话日志导出\n\n- dsh-session/ 为 DeepSeek Harness 原始会话日志（zstd 压缩）\n- trace.json 为产品侧捕获的本轮运行轨迹与统计\n', 'utf8') },
    ...files,
  ]
  if (trace) entries.push({ name: 'trace.json', data: Buffer.from(`${safeJson(trace)}\n`, 'utf8') })
  return { buffer: buildZip(entries), files: files.length, manifest }
}

export function traceDigest(trace) {
  return createHash('sha256').update(safeJson(trace)).digest('hex').slice(0, 16)
}
