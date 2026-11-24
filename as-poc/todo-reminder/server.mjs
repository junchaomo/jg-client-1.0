import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, parse as parseRequestUrl } from 'node:url'

const APP_ID = String(process.env.AS_APP_ID || 'todo-reminder')
const HUB = String(process.env.AS_HUB_URL || '').replace(/\/+$/, '')
const APP_DIR = path.dirname(fileURLToPath(import.meta.url))
const PAGE_FILE = path.join(APP_DIR, 'page.html')
const DATA_DIR = process.env.AS_DATA_DIR
  ? path.resolve(process.env.AS_DATA_DIR)
  : path.join(path.resolve(process.env.AS_DATA_ROOT || '.'), 'todo-data')
const STORE_FILE = path.join(DATA_DIR, 'todos.json')
const STDIO_LOG = path.join(DATA_DIR, 'app.log')
const PORT = Number(process.env.AS_PORT || process.env.PORT || 0)
const HOST = '127.0.0.1'

fs.mkdirSync(DATA_DIR, { recursive: true })

function logLine(message) {
  try {
    fs.appendFileSync(STDIO_LOG, `${new Date().toISOString()} ${message}\n`)
  } catch {}
}

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    if (parsed && Array.isArray(parsed.items)) return { version: 1, items: parsed.items }
  } catch {}
  return { version: 1, items: [] }
}

const store = loadStore()

function saveStore() {
  const temp = `${STORE_FILE}.tmp`
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), 'utf8')
  fs.renameSync(temp, STORE_FILE)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(ms) {
  const date = new Date(Number(ms))
  if (!Number.isFinite(date.getTime())) return '未知时间'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '')
  const result = {}
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    try { result[key] = decodeURIComponent(value) } catch { result[key] = value }
  }
  return result
}

function requestToken(req, url) {
  return String(
    req.headers['x-as-context']
      || parseCookies(req).as_ctx
      || url.searchParams.get('asContext')
      || url.searchParams.get('contextToken')
      || '',
  ).trim()
}

function requestAppId(req) {
  return String(req.headers['x-as-app-id'] || APP_ID).trim()
}

function canUseApp(req, url) {
  if (!HUB) return true
  return Boolean(requestToken(req, url))
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(html)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 256 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch { reject(new Error('请求体不是合法 JSON')) }
    })
    req.on('error', reject)
  })
}

async function callHub(pathname, method, payload, token) {
  if (!HUB) throw new Error('应用不在中枢环境中运行，无法登记提醒')
  const response = await fetch(`${HUB}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-as-context': token,
      'x-as-app-id': APP_ID,
    },
    body: payload ? JSON.stringify({ ...payload, appId: APP_ID }) : undefined,
    signal: AbortSignal.timeout(8000),
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {}
  if (!response.ok || (data && data.ok === false)) {
    throw new Error((data && (data.error || data.code)) || `中枢返回 ${response.status}`)
  }
  return data || {}
}

function normalizeTitle(value) {
  return String(value || '').trim().slice(0, 75)
}

function normalizeNote(value) {
  return String(value || '').trim().slice(0, 200)
}

function normalizeDue(value) {
  const dueAt = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(dueAt) || dueAt <= 0) throw new Error('截止时间无效')
  if (dueAt > Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) throw new Error('截止时间超过 5 年上限')
  if (dueAt < Date.now() - 10 * 60 * 1000) throw new Error('截止时间不能早于当前时间')
  return Math.round(dueAt)
}

function reminderPayload(todo) {
  const note = todo.note ? ` · ${todo.note}` : ''
  return {
    key: todo.id,
    title: `待办到期：${todo.title}`,
    body: `截止时间 ${formatDateTime(todo.dueAt)}${note}`,
    dueAt: todo.dueAt,
  }
}

function listTodos() {
  const items = [...store.items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return Number(a.dueAt) - Number(b.dueAt)
  })
  return items
}

function activeFutureTodos() {
  return store.items.filter((item) => !item.done && Number(item.dueAt) > Date.now())
}

function pageHtml() {
  const html = fs.readFileSync(PAGE_FILE, 'utf8')
  return html.replaceAll('__APP_ID__', APP_ID)
}
async function handle(req, res) {
  /* 不用 URL 构造器，避免应用包里出现外部协议字面量；这里只解析本地 HTTP 请求的 path/query。 */
  const parsed = parseRequestUrl(req.url || '/', false)
  const url = {
    pathname: parsed.pathname || '/',
    searchParams: new URLSearchParams(parsed.query || ''),
  }
  const method = String(req.method || 'GET').toUpperCase()
  const token = requestToken(req, url)

  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/app')) {
    if (token && url.searchParams.has('asContext')) {
      res.writeHead(302, {
        location: '/',
        'set-cookie': `as_ctx=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
        'cache-control': 'no-store',
      })
      return res.end()
    }
    if (!canUseApp(req, url)) {
      return sendHtml(res, 401, '<!doctype html><meta charset="utf-8"><title>待办提醒</title><p style="font:15px sans-serif;padding:32px">请从九规智能中枢的应用入口打开待办提醒。</p>')
    }
    return sendHtml(res, 200, pageHtml())
  }

  if (method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, app: APP_ID, version: '1.0.0' })
  }

  if (method === 'GET' && url.pathname === '/favicon.ico') {
    res.writeHead(204)
    return res.end()
  }

  if (url.pathname.startsWith('/api/') && !canUseApp(req, url)) {
    return sendJson(res, 401, { ok: false, error: '应用上下文无效或已过期', code: 'AS_CONTEXT_INVALID' })
  }

  if (method === 'GET' && url.pathname === '/api/todos') {
    return sendJson(res, 200, { ok: true, items: listTodos(), serverTime: Date.now() })
  }

  if (method === 'POST' && url.pathname === '/api/todos') {
    const body = await readBody(req)
    const title = normalizeTitle(body.title)
    if (!title) return sendJson(res, 400, { ok: false, error: '待办标题不能为空' })
    let dueAt
    try { dueAt = normalizeDue(body.dueAt) } catch (error) { return sendJson(res, 400, { ok: false, error: error.message }) }
    const note = normalizeNote(body.note)
    const now = Date.now()
    const todo = {
      id: `T-${now.toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      title,
      note,
      dueAt,
      done: false,
      createdAt: now,
      updatedAt: now,
    }
    try {
      await callHub('/api/as/v1/reminders', 'POST', reminderPayload(todo), token)
    } catch (error) {
      logLine(`register failed ${todo.id}: ${error.message}`)
      return sendJson(res, 502, { ok: false, error: `提醒登记失败：${error.message}`, code: 'REMINDER_REGISTER_FAILED' })
    }
    store.items.unshift(todo)
    saveStore()
    logLine(`created ${todo.id} due ${formatDateTime(dueAt)}`)
    return sendJson(res, 200, { ok: true, todo })
  }

  if (method === 'POST' && url.pathname === '/api/todos/complete') {
    const body = await readBody(req)
    const id = String(body.id || '').trim()
    const todo = store.items.find((item) => item.id === id)
    if (!todo) return sendJson(res, 404, { ok: false, error: '待办不存在' })
    const nextDone = Boolean(body.done)
    try {
      if (nextDone) {
        await callHub('/api/as/v1/reminders/remove', 'POST', { key: todo.id }, token)
      } else if (Number(todo.dueAt) > Date.now()) {
        await callHub('/api/as/v1/reminders', 'POST', reminderPayload(todo), token)
      }
    } catch (error) {
      logLine(`toggle failed ${todo.id}: ${error.message}`)
      return sendJson(res, 502, { ok: false, error: `提醒更新失败：${error.message}`, code: 'REMINDER_UPDATE_FAILED' })
    }
    todo.done = nextDone
    todo.updatedAt = Date.now()
    saveStore()
    return sendJson(res, 200, { ok: true, todo })
  }

  if (method === 'POST' && url.pathname === '/api/todos/delete') {
    const body = await readBody(req)
    const id = String(body.id || '').trim()
    const index = store.items.findIndex((item) => item.id === id)
    if (index < 0) return sendJson(res, 404, { ok: false, error: '待办不存在' })
    try {
      await callHub('/api/as/v1/reminders/remove', 'POST', { key: id }, token)
    } catch (error) {
      logLine(`remove failed ${id}: ${error.message}`)
      return sendJson(res, 502, { ok: false, error: `提醒撤销失败：${error.message}`, code: 'REMINDER_REMOVE_FAILED' })
    }
    store.items.splice(index, 1)
    saveStore()
    return sendJson(res, 200, { ok: true })
  }

  if (method === 'POST' && url.pathname === '/api/todos/sync') {
    let registered = 0
    let failed = 0
    for (const todo of activeFutureTodos()) {
      try {
        await callHub('/api/as/v1/reminders', 'POST', reminderPayload(todo), token)
        registered += 1
      } catch (error) {
        failed += 1
        logLine(`sync failed ${todo.id}: ${error.message}`)
      }
    }
    return sendJson(res, 200, { ok: true, registered, failed })
  }

  return sendJson(res, 404, { ok: false, error: 'Not found' })
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    logLine(`request failed ${req.method} ${req.url}: ${error.stack || error.message}`)
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: error.message || '应用内部错误' })
    else res.end()
  })
})

server.listen(PORT, HOST, () => {
  logLine(`todo-reminder listening on ${HOST}:${server.address().port} hub=${HUB || '(none)'}`)
  /* AS 运行时通过端口探测或日志识别动态端口；这里显式输出一行便于宿主解析。 */
  console.log(`todo-reminder listening on ${HOST}:${server.address().port}`)
})
