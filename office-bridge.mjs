/**
 * Office 选区桥：把 OnlyOffice 编辑器里的选区接到左侧对话。
 *
 * 设计要点：
 * - OnlyOffice 侧只加载一个无界面 background 插件，不新增右侧 AI 面板；
 * - 插件把选区上报到本模块，左侧聊天读取最新选区并把它作为 docContext 随消息发送；
 * - Agent 调用 office_replace_selection 时，本模块通过 SSE 把命令下发给插件，
 *   插件用 ReplaceTextSmart 按段落原位替换，保留原段落样式；
 * - expectedHash 与 sourceText 双重校验，防止用户已经改选或文档已变化时把旧建议落到错误位置。
 */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readOnlyOfficeToken } from './onlyoffice.mjs'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = join(MODULE_DIR, 'public', 'office-plugin')
const SELECTION_MAX = 50_000
const HTML_MAX = 80_000
const COMMAND_TIMEOUT_MS = 12_000
const selectionStore = new Map()
const clients = new Map()
const pendingCommands = new Map()

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-jg-office-token',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    ...extraHeaders,
  })
  res.end(JSON.stringify(body))
}

function parseBody(req) {
  try { return JSON.parse(req.__body || '{}') } catch { return {} }
}

function tokenOf(req, url, body = {}) {
  const header = String(req.headers['x-jg-office-token'] || '').trim()
  const query = url ? String(url.searchParams.get('token') || '').trim() : ''
  return header || query || String(body.token || '').trim()
}

function verifyCopilotToken(value) {
  const payload = readOnlyOfficeToken(value, 'copilot')
  if (!payload) return null
  return payload
}

function selectionKey(uid, docKey) {
  return `${String(uid || '')}:${String(docKey || '')}`
}

function selectionHash(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 32)
}

function selectionView(row, { includeHtml = false } = {}) {
  if (!row) return null
  return {
    docKey: row.docKey,
    docName: row.docName,
    path: row.path,
    hash: row.hash,
    text: row.text,
    chars: row.text.length,
    updatedAt: row.updatedAt,
    connected: Boolean(row.connected),
    ...(includeHtml ? { html: row.html } : {}),
  }
}

function normalizeParagraphs(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/)
  return raw.map((item) => String(item ?? '').replace(/\r/g, '')).slice(0, 200)
}

function latestForUser(uid, docKey = '') {
  let latest = null
  for (const row of selectionStore.values()) {
    if (String(row.uid) !== String(uid)) continue
    if (docKey && row.docKey !== String(docKey)) continue
    if (!latest || Number(row.updatedAt) > Number(latest.updatedAt)) latest = row
  }
  return latest
}

export function officeSelectionForUser(user, options = {}) {
  return selectionView(latestForUser(user?.id || user?.accountId || '', String(options.docKey || '')), options)
}

export function recordOfficeSelection(req, res) {
  const body = parseBody(req)
  const payload = verifyCopilotToken(tokenOf(req, null, body))
  if (!payload) return json(res, 403, { error: '选区令牌无效或已过期', code: 'OFFICE_TOKEN_INVALID' })
  const docKey = String(body.docKey || payload.docKey || '').trim()
  if (!docKey) return json(res, 400, { error: '缺少文档 key', code: 'OFFICE_DOC_KEY_REQUIRED' })
  const text = String(body.text || '').slice(0, SELECTION_MAX)
  const html = String(body.html || '').slice(0, HTML_MAX)
  const key = selectionKey(payload.uid, docKey)
  const previous = selectionStore.get(key)
  const row = {
    uid: String(payload.uid || ''),
    userName: String(payload.uname || ''),
    docKey,
    docName: String(payload.name || body.docName || '文档').slice(0, 160),
    path: String(payload.path || payload.fid || ''),
    text,
    html,
    hash: text ? selectionHash(text) : '',
    updatedAt: Date.now(),
    connected: Boolean(previous?.connected),
  }
  selectionStore.set(key, row)
  return json(res, 200, { ok: true, selection: selectionView(row) })
}

export function latestOfficeSelection(req, res, url, user) {
  if (!user) return json(res, 401, { error: '未登录', code: 'AUTH_REQUIRED' })
  const row = latestForUser(user.id || user.accountId || '', String(url.searchParams.get('docKey') || ''))
  return json(res, 200, { ok: true, selection: selectionView(row) })
}

export function officeBridgeEvents(req, res, url) {
  const payload = verifyCopilotToken(tokenOf(req, url))
  if (!payload) return json(res, 403, { error: '选区令牌无效或已过期', code: 'OFFICE_TOKEN_INVALID' })
  const docKey = String(url.searchParams.get('docKey') || payload.docKey || '').trim()
  if (!docKey) return json(res, 400, { error: '缺少文档 key', code: 'OFFICE_DOC_KEY_REQUIRED' })
  const key = selectionKey(payload.uid, docKey)
  let row = selectionStore.get(key)
  if (!row) {
    row = {
      uid: String(payload.uid || ''), userName: String(payload.uname || ''),
      docKey, docName: String(payload.name || '文档'), path: String(payload.path || payload.fid || ''),
      text: '', html: '', hash: '', updatedAt: Date.now(), connected: false,
    }
    selectionStore.set(key, row)
  }
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    'access-control-allow-origin': '*',
  })
  res.write('retry: 3000\n\n')
  res.write(`event: ready\ndata: ${JSON.stringify({ docKey, docName: row.docName })}\n\n`)
  row.connected = true
  const set = clients.get(key) || new Set()
  set.add(res)
  clients.set(key, set)
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n') } catch (_) { /* closed */ }
  }, 20_000)
  const cleanup = () => {
    clearInterval(heartbeat)
    set.delete(res)
    if (!set.size) {
      clients.delete(key)
      if (row && !clients.has(key)) row.connected = false
    }
    pendingCommands.forEach((entry, id) => {
      if (entry.key === key) {
        clearTimeout(entry.timer)
        pendingCommands.delete(id)
        entry.reject(Object.assign(new Error('文档桥接连接已断开'), { code: 'OFFICE_BRIDGE_DISCONNECTED' }))
      }
    })
  }
  req.on('close', cleanup)
  req.on('aborted', cleanup)
}

export function ackOfficeCommand(req, res) {
  const body = parseBody(req)
  const payload = verifyCopilotToken(tokenOf(req, null, body))
  if (!payload) return json(res, 403, { error: '选区令牌无效或已过期', code: 'OFFICE_TOKEN_INVALID' })
  const commandId = String(body.commandId || '').trim()
  const entry = pendingCommands.get(commandId)
  if (!entry) return json(res, 404, { error: '命令不存在或已超时', code: 'OFFICE_COMMAND_NOT_FOUND' })
  clearTimeout(entry.timer)
  pendingCommands.delete(commandId)
  if (body.ok === false) {
    entry.reject(Object.assign(new Error(String(body.error || '文档替换失败')), { code: String(body.code || 'OFFICE_REPLACE_FAILED') }))
  } else {
    entry.resolve({ commandId, ok: true, result: body.result || null })
  }
  return json(res, 200, { ok: true })
}

export async function applyOfficeSelectionReplace({ user, docKey = '', paragraphs, expectedHash = '', sourceText = '' }) {
  const uid = user?.id || user?.accountId || ''
  const target = latestForUser(uid, docKey)
  if (!target) {
    throw Object.assign(new Error('当前没有可用的 Office 选区，请先在文档中选中一段文字'), { code: 'OFFICE_SELECTION_MISSING', status: 409 })
  }
  const incoming = normalizeParagraphs(paragraphs)
  if (!incoming.some((line) => line.trim())) {
    throw Object.assign(new Error('替换内容为空'), { code: 'OFFICE_REPLACE_EMPTY', status: 400 })
  }
  if (expectedHash && legacyHash(expectedHash) !== target.hash) {
    throw Object.assign(new Error('文档选区已经变化，请重新选中后再发出修改指令'), { code: 'OFFICE_SELECTION_STALE', status: 409 })
  }
  if (sourceText && normalizeText(sourceText) !== normalizeText(target.text)) {
    throw Object.assign(new Error('文档选区已经变化，请重新选中后再发出修改指令'), { code: 'OFFICE_SELECTION_STALE', status: 409 })
  }
  const set = clients.get(selectionKey(uid, target.docKey))
  if (!set || !set.size) {
    throw Object.assign(new Error('文档当前没有连接 AI 桥接插件，请重新打开在线编辑页后再试'), { code: 'OFFICE_BRIDGE_OFFLINE', status: 409 })
  }
  const commandId = `OC-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
  const event = {
    type: 'command',
    action: 'replaceSelection',
    commandId,
    docKey: target.docKey,
    expectedHash: target.hash,
    sourceText: target.text,
    paragraphs: incoming,
  }
  const ack = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(commandId)
      reject(Object.assign(new Error('文档没有在 12 秒内确认替换，请检查编辑器是否仍在前台'), { code: 'OFFICE_COMMAND_TIMEOUT', status: 504 }))
    }, COMMAND_TIMEOUT_MS)
    pendingCommands.set(commandId, { key: selectionKey(uid, target.docKey), resolve, reject, timer })
    let sent = 0
    for (const client of set) {
      try {
        client.write(`event: command\ndata: ${JSON.stringify(event)}\n\n`)
        sent += 1
      } catch (_) { /* closed */ }
    }
    if (!sent) {
      clearTimeout(timer)
      pendingCommands.delete(commandId)
      reject(Object.assign(new Error('文档桥接连接不可用'), { code: 'OFFICE_BRIDGE_OFFLINE', status: 409 }))
    }
  })
  return {
    commandId: ack.commandId,
    docKey: target.docKey,
    docName: target.docName,
    path: target.path,
    replacedParagraphs: incoming.length,
    charsBefore: target.text.length,
    charsAfter: incoming.join('').length,
  }
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function legacyHash(value) {
  return String(value || '').trim()
}

export function officePluginConfig(req, res, url) {
  const rawToken = tokenOf(req, url)
  const payload = verifyCopilotToken(rawToken)
  if (!payload && rawToken) return json(res, 403, { error: '插件令牌无效或已过期', code: 'OFFICE_TOKEN_INVALID' })
  const origin = String(url.searchParams.get('origin') || req.headers.origin || `http://${req.headers.host || '127.0.0.1:54269'}`).replace(/\/$/, '')
  const token = encodeURIComponent(rawToken)
  const docKey = encodeURIComponent(String((payload && payload.docKey) || url.searchParams.get('docKey') || ''))
  json(res, 200, {
    guid: 'asc.{7EA2E7A2-2C71-4E5F-9C39-6E7A2B1F9D31}',
    name: '九规 AI 选区桥',
    nameLocale: { 'zh-CN': '九规 AI 选区桥' },
    variations: [{
      description: '把当前选区同步到左侧九规 AI 对话，不显示额外面板',
      // OnlyOffice 会把 variation.url 拼在 config.json 所在目录后面；
      // 这里必须是相对 config.json 的 index.html，不能写绝对 URL，否则会拼成
      // /api/office/plugin/http://... 的双重地址。
      url: `index.html?guid=asc.{7EA2E7A2-2C71-4E5F-9C39-6E7A2B1F9D31}&token=${token}&docKey=${docKey}&tail=1`,
      icons: ['icon.svg'],
      isViewer: false,
      EditorsSupport: ['word'],
      type: 'background',
      isSystem: false,
      isVisual: false,
      initDataType: 'text',
      initOnSelectionChanged: true,
    }],
  })
}

function servePluginFile(res, name, type) {
  const path = join(PLUGIN_DIR, name)
  if (!existsSync(path)) return json(res, 404, { error: '插件文件不存在' })
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  })
  res.end(readFileSync(path))
}

export function officePluginPage(req, res) {
  servePluginFile(res, 'index.html', 'text/html; charset=utf-8')
}

export function officePluginScript(req, res) {
  servePluginFile(res, 'plugin.js', 'text/javascript; charset=utf-8')
}

export function officePluginSdk(req, res) {
  servePluginFile(res, 'plugins.js', 'text/javascript; charset=utf-8')
}

export function officePluginIcon(req, res) {
  servePluginFile(res, 'icon.svg', 'image/svg+xml')
}
