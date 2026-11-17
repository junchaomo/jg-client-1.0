import http from 'node:http'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const host = process.env.AS_HOST || '127.0.0.1'
const port = Number(process.env.AS_PORT || process.env.PORT || 0)
const dataRoot = process.env.AS_DATA_ROOT || process.env.AS_DATA_DIR || join(process.cwd(), 'as-data')
const contextSecret = String(process.env.AS_CONTEXT_SECRET || '')
mkdirSync(dataRoot, { recursive: true })

function contextUser(req) {
  if (!contextSecret) return null
  let token = ''
  try {
    token = new URL(req.url || '/', 'http://local').searchParams.get('asContext') || ''
  } catch {}
  if (!token) token = String(req.headers['x-as-context'] || '')
  if (!token) return ''
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return ''
  const expected = createHmac('sha256', contextSecret).update(encoded).digest('hex')
  const left = Buffer.from(signature, 'hex')
  const right = Buffer.from(expected, 'hex')
  if (left.length !== right.length || !timingSafeEqual(left, right)) return ''
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (String(payload.appId || '') !== String(process.env.AS_APP_ID || 'as-sample')) return ''
    if (Number(payload.exp || 0) < Date.now()) return ''
    const user = String(payload.userId || '')
    return /^[A-Za-z0-9._-]{1,80}$/.test(user) ? user : ''
  } catch {
    return ''
  }
}

function userDir(req) {
  const verified = contextUser(req)
  if (contextSecret && !verified) {
    const error = new Error('AS 上下文令牌缺失、无效或已过期')
    error.status = 401
    throw error
  }
  let user = verified || 'guest'
  if (!verified) {
    try {
      user = new URL(req.url || '/', 'http://local').searchParams.get('asUser') || 'guest'
    } catch {}
  }
  const safe = user.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'guest'
  const dir = join(dataRoot, safe)
  mkdirSync(dir, { recursive: true })
  return dir
}

function stateFile(dir) {
  return join(dir, 'state.json')
}

function readState(dir) {
  try {
    return JSON.parse(readFileSync(stateFile(dir), 'utf8'))
  } catch {
    return { opens: 0, lastOpenAt: '' }
  }
}

function writeState(dir, state) {
  writeFileSync(stateFile(dir), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function html(req) {
  const dir = userDir(req)
  const state = readState(dir)
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AS 示例应用</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #111827; }
    main { width: min(680px, calc(100vw - 48px)); padding: 32px; border-radius: 18px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 12px 36px rgba(17,24,39,.08); }
    h1 { font-size: 24px; margin: 0 0 6px; letter-spacing: -.02em; }
    p { color: #6b7280; line-height: 1.7; margin: 0 0 18px; }
    dl { display: grid; grid-template-columns: 112px 1fr; gap: 10px 16px; margin: 0; font-size: 14px; }
    dt { color: #6b7280; }
    dd { margin: 0; color: #111827; word-break: break-all; }
    button { margin-top: 24px; border: 0; border-radius: 10px; padding: 10px 16px; background: #111827; color: #fff; font-size: 14px; cursor: pointer; }
    #count { font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <main>
    <h1>AS 示例应用</h1>
    <p>由 AS Runtime 启动的独立进程。这个页面不是 iframe 特例，而是应用自己的 HTTP 服务。</p>
    <dl>
      <dt>应用 ID</dt><dd>${process.env.AS_APP_ID || 'as-sample'}</dd>
      <dt>进程 PID</dt><dd>${process.pid}</dd>
      <dt>监听地址</dt><dd>${host}:${port}</dd>
      <dt>账号数据目录</dt><dd>${dir}</dd>
      <dt>打开次数</dt><dd id="count">${state.opens}</dd>
    </dl>
    <button id="open">记录一次打开</button>
  </main>
  <script>
    document.getElementById('open').addEventListener('click', async () => {
      const query = new URLSearchParams(location.search)
      const res = await fetch('/api/open?asUser=' + encodeURIComponent(query.get('asUser') || 'guest') + '&asContext=' + encodeURIComponent(query.get('asContext') || ''), { method: 'POST' })
      const data = await res.json()
      document.getElementById('count').textContent = data.opens
    })
  </script>
</body>
</html>`
}

async function handle(req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, appId: process.env.AS_APP_ID || 'as-sample', pid: process.pid, dataRoot }))
    return
  }
  const path = new URL(req.url || '/', 'http://local').pathname
  if (path === '/api/tools/state') {
    const dir = userDir(req)
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ appId: process.env.AS_APP_ID || 'as-sample', pid: process.pid, dataRoot, dataDir: dir, state: readState(dir) }))
    return
  }
  if (path === '/api/tools/echo' && req.method === 'POST') {
    let raw = ''
    for await (const chunk of req) raw += chunk
    let received = null
    try { received = JSON.parse(raw || '{}') } catch { received = raw }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ appId: process.env.AS_APP_ID || 'as-sample', pid: process.pid, received }))
    return
  }
  if (path === '/api/tools/note' && req.method === 'POST') {
    const dir = userDir(req)
    let raw = ''
    for await (const chunk of req) raw += chunk
    let received = {}
    try { received = JSON.parse(raw || '{}') } catch {}
    const note = String(received.note || '').trim()
    if (!note) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'note 不能为空' }))
      return
    }
    const state = readState(dir)
    state.notes = [...(state.notes || []), { note, at: new Date().toISOString() }].slice(-20)
    state.lastWriteAt = new Date().toISOString()
    writeState(dir, state)
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, dataDir: dir, notes: state.notes.length, lastNote: note }))
    return
  }
  if (req.url?.startsWith('/api/open') && req.method === 'POST') {
    const dir = userDir(req)
    const state = readState(dir)
    state.opens += 1
    state.lastOpenAt = new Date().toISOString()
    writeState(dir, state)
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ...state, dataDir: dir }))
    return
  }
  const page = html(req)
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(page)
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (res.headersSent) {
      res.end()
      return
    }
    res.writeHead(Number(error?.status) || 500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: String(error?.message || error) }))
  })
})

server.listen(port, host, () => {
  console.log(`[as-sample] http://${host}:${port} dataRoot=${dataRoot}`)
})
