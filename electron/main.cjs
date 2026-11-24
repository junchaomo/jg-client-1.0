const { app, BrowserWindow, Menu, ipcMain, shell, dialog, WebContentsView, screen, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { createDnrBlocker } = require('./extension-dnr.cjs')
const { spawn } = require('child_process')
const http = require('http')
const net = require('net')

const ROOT = path.join(__dirname, '..')
const ENTRY = path.join(ROOT, 'server.mjs')
/* 客户端与手工调试共用同一个端口，避免同一份 data 目录上跑两套服务。 */
const PREFERRED_PORT = Number(process.env.JG_PORT || 54269)

// 与旧客户端彻底隔离，避免沿用旧客户端的登录态、缓存与窗口状态。
app.setName('jg-client-1.0')
app.setPath('userData', process.env.JG_ELECTRON_USER_DATA_DIR || path.join(app.getPath('appData'), 'jg-client-1.0'))
if (process.platform === 'win32') app.setAppUserModelId('com.jiugui.harness')
const BRIDGE = `
(() => {
  if (window.__jgClientWindowBridge) return
  window.__jgClientWindowBridge = true

  // 只加 Electron 的拖拽/按钮命中区域，不改变任何视觉样式。
  const style = document.createElement('style')
  style.id = 'jg-client-window-bridge'
  style.textContent = [
    '.menubar{-webkit-app-region:drag}',
    '.menubar button,.menubar .mb-winbtn,.menubar input,.menubar a{-webkit-app-region:no-drag}',
    '.menubar .mb-win{display:none!important}'
  ].join('')
  document.head.appendChild(style)

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('[data-win], .mb-winbtn') : null
    if (!target || !window.jgClient) return
    const action = target.dataset.win || ({ '最小化': 'minimize', '最大化': 'maximize', '还原': 'maximize', '关闭': 'close' }[target.getAttribute('title')])
    if (!action) return
    event.preventDefault(); event.stopPropagation()
    if (action === 'minimize') window.jgClient.minimize()
    else if (action === 'maximize') window.jgClient.toggleMaximize()
    else if (action === 'close') window.jgClient.close()
  }, true)

  const paint = (winState) => {
    const btn = document.querySelector('[data-win="maximize"]')
    if (!btn) return
    const maximized = Boolean(winState && (winState.maximized || winState.fullscreen))
    btn.title = maximized ? '还原' : '最大化'
    btn.setAttribute('aria-label', maximized ? '还原窗口' : '最大化窗口')
    btn.setAttribute('aria-pressed', String(maximized))
    btn.innerHTML = maximized
      ? '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="4" width="6" height="6"/><path d="M4 4V2h6v6H8"/></svg>'
      : '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="7" height="7"/></svg>'
  }
  window.jgClient?.getWindowState?.().then(paint).catch(() => {})
  window.jgClient?.onWindowState?.(paint)
})()
`

let mainWindow = null
/* 每个网页/企业系统会话标签都有独立 WebContentsView；切换标签只改变可见性，
   关闭标签只销毁自己的视图。内部预览复用主窗口会话，外部网页使用隔离分区。 */
const browserViews = new Map()
let activeBrowserTabId = ''

// 原生标题栏覆盖层：背景透明，按钮符号色跟随页面文字色。
// overlay 背景透明：右侧按钮槽位不再铺一块不透明底色压住 menubar 的 1px 底边，
// 整行背景与分隔线由页面 menubar 透出贯通，避免按钮区下方边线断开。按钮符号色由 symbolColor 控制。
const TITLEBAR_THEME = {
  login: { color: '#00000000', symbolColor: '#3a3f45', height: 38 },
  app: { color: '#00000000', symbolColor: '#3a3f45', height: 38 },
}
function applyTitleBarTheme(window, mode) {
  if (process.platform !== 'win32' || !window || window.isDestroyed()) return
  const cfg = TITLEBAR_THEME[mode] || TITLEBAR_THEME.login
  try { window.setTitleBarOverlay(cfg) } catch (_) { /* 旧版本忽略 */ }
}
/* 最近一次渲染进程推来的槽位矩形。容器先行（应用启动期间先挂壳、后建视图）时，
   这次 bounds 会早于视图创建到达，先存下来、建视图时立刻应用，避免 0 尺寸白屏。 */
let browserBounds = null
/* 应用工作区标签页：每个应用一个独立的 WebContentsView。
   appViews 只保存视图与加载状态，不参与 AS 进程租约；关闭标签只销毁视图，
   应用进程仍由渲染层的 /api/as/heartbeat 租约维持。 */
const appViews = new Map()
let activeAppId = ''
let appBounds = null
let serverProcess = null
let serverPort = null
let quitting = false

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

function resolveNodeExe() {
  const candidates = [
    process.env.JG_NODE_EXE,
    path.join(ROOT, 'runtime', 'node.exe'),
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate } catch (_) {}
  }
  return process.execPath
}

function findMediakitCli() {
  const configured = String(process.env.MEDIAKIT_CLI_PATH || '').trim()
  if (configured && fs.existsSync(configured)) return configured
  const roots = [
    path.join(process.env.LOCALAPPDATA || '', 'Doubao', 'User Data', 'Default', 'sandbox_envs_dir', 'envs'),
    path.join(process.env.LOCALAPPDATA || '', 'Doubao', 'User Data', 'Default', 'sandbox_envs_dir'),
  ].filter(Boolean)
  const seen = new Set()
  const walk = (dir, depth) => {
    if (depth > 6 || seen.has(dir)) return ''
    seen.add(dir)
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (_) { return '' }
    for (const entry of entries) {
      if (entry.name.toLowerCase() === 'mediakit-cli.exe') return path.join(dir, entry.name)
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const found = walk(path.join(dir, entry.name), depth + 1)
      if (found) return found
    }
    return ''
  }
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const found = walk(root, 0)
    if (found) return found
  }
  return ''
}

function ensureOnlyOfficeService() {
  if (process.platform !== 'win32') return
  if (String(process.env.JG_ONLYOFFICE_AUTOSTART || '') === '0') return
  const script = path.join(ROOT, 'scripts', 'onlyoffice-deploy.ps1')
  if (!fs.existsSync(script)) return
  const ps = process.env.JG_POWERSHELL_EXE || 'powershell.exe'
  try {
    const child = spawn(ps, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
      '-StartOnly', '-EnsureDockerDesktop', '-WaitSeconds', '25',
    ], {
      cwd: ROOT,
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch (error) {
    console.error('[jg-office] 自动启动 OnlyOffice 失败:', error?.message || error)
  }
}

function startServer(port) {
  const nodeExe = resolveNodeExe()
  const env = { ...process.env, PORT: String(port), JG_SERVER_ORIGIN: 'client' }
  const mediakit = findMediakitCli()
  if (mediakit) {
    env.MEDIAKIT_CLI_PATH = mediakit
    env.PATH = `${path.dirname(mediakit)}${path.delimiter}${env.PATH || ''}`
    env.Path = `${path.dirname(mediakit)}${path.delimiter}${env.Path || env.PATH || ''}`
  }
  delete env.ELECTRON_RUN_AS_NODE
  serverProcess = spawn(nodeExe, [ENTRY], {
    cwd: ROOT,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(`[jg-server] ${data}`)
  })
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(`[jg-server] ${data}`)
  })
  serverProcess.on('exit', (code) => {
    if (!quitting && code !== 0) {
      console.error(`[jg-server] exited with code ${code}`)
    }
  })
}

function stopServer() {
  if (!serverProcess) return
  const child = serverProcess
  serverProcess = null
  try { child.kill() } catch (_) {}
}

function waitForServer(port, timeoutMs = 15000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (response) => {
        response.resume()
        resolve()
      })
      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) reject(new Error(`local server did not start on port ${port}`))
        else setTimeout(probe, 250)
      })
      request.on('timeout', () => request.destroy())
    }
    probe()
  })
}

function probeHealthOnce(port, timeoutMs) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: timeoutMs }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          resolve(Boolean(parsed && parsed.ok && parsed.service === 'jg-server'))
        } catch (_) {
          resolve(false)
        }
      })
    })
    request.on('error', () => resolve(false))
    request.on('timeout', () => { request.destroy(); resolve(false) })
  })
}

/**
 * 服务在跑长任务时可能几秒不响应；1.5 秒探活失败就起第二套服务，会同时写同一个 SQLite。
 * 这里放宽单次超时并重试，宁可多等十几秒，也不要多起一个实例。
 */
async function probeHealth(port, timeoutMs = 5000, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    if (await probeHealthOnce(port, timeoutMs)) return true
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800))
  }
  return false
}

function readServerPidInfo() {
  try {
    const raw = fs.readFileSync(path.join(process.env.JG_DATA_DIR || path.join(ROOT, 'data'), 'run', 'server.pid'), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && Number.isFinite(Number(parsed.pid)) ? parsed : null
  } catch (_) {
    return null
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (_) {
    return false
  }
}

function installBridge(contents) {
  contents.on('did-finish-load', () => {
    contents.executeJavaScript(BRIDGE, true).catch(() => {})
  })
}

const browserSessionsHooked = new WeakSet()
const BROWSER_PARTITION = 'persist:jg-cloud-browser'
const BROWSER_TAB_ID = /^[A-Za-z0-9_-]{1,96}$/

/* 浏览器视图禁止回环访问本机服务（中枢服务跑在 127.0.0.1，浏览器只承载外网网页）。 */
function isLoopbackUrl(url) {
  try {
    const u = new URL(String(url))
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname)
  } catch (_) { return false }
}

/* 只放行中枢自己的只读预览/在线编辑页；不是所有回环地址都能进主窗口会话。 */
function isInternalPreviewUrl(url) {
  try {
    const u = new URL(String(url))
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname)) return false
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80))
    if (!serverPort || port !== Number(serverPort)) return false
    const path = String(u.pathname || '')
    return path === '/api/preview'
      || path.startsWith('/api/preview/')
      || path === '/api/office/editor'
      || path.startsWith('/api/office/editor/')
  } catch (_) { return false }
}

/* 渲染进程给的是 CSS 像素；BrowserView.setBounds 要的是窗口 DIP。
   页面被 Ctrl+滚轮/菜单缩放到 50% 时，innerWidth 会是窗口宽度的两倍，
   直接传 CSS 坐标会把原生视图放到窗口外，界面只剩 DOM 里的加载占位。 */
function cssRectToWindow(rect = {}) {
  const zoom = mainWindow && !mainWindow.isDestroyed()
    ? Math.max(0.25, Math.min(4, Number(mainWindow.webContents.getZoomFactor()) || 1))
    : 1
  return {
    x: Math.max(0, Math.round((Number(rect.x) || 0) * zoom)),
    y: Math.max(0, Math.round((Number(rect.y) || 0) * zoom)),
    width: Math.max(1, Math.round((Number(rect.width) || 1) * zoom)),
    height: Math.max(1, Math.round((Number(rect.height) || 1) * zoom)),
    zoom,
  }
}

/* 扩展只能按管理中心审核落盘的 id + 相对目录加载。渲染进程不能传本机路径，
   也不能把未审核目录塞入白名单。 */
const EXT_ROOT = path.join(ROOT, 'extensions')
const EXT_REVIEW_REGISTRY = path.join(process.env.JG_DATA_DIR || path.join(ROOT, 'data'), 'browser-extension-review.json')
const loadedExts = new Map() // ext id -> { abs, extension, session }
const browserDnrEngines = new Map() // session -> Map(ext id -> blocker)
function installDnrCompat(session, id, extensionPath) {
  const blocker = createDnrBlocker(extensionPath)
  if (!browserDnrEngines.has(session)) {
    const engines = new Map()
    browserDnrEngines.set(session, engines)
    session.webRequest?.onBeforeRequest((details, callback) => {
      for (const engine of engines.values()) {
        if (engine.match(details.url)) { callback({ cancel: true }); return }
      }
      callback({})
    })
  }
  browserDnrEngines.get(session).set(id, blocker)
  console.info('[browser-ext] DNR 基础兼容规则已加载:', id, blocker.rules, '条；高级/不兼容规则', blocker.unsupported, '条')
}
function removeDnrCompat(session, id) {
  const engines = browserDnrEngines.get(session)
  engines?.delete(id)
  if (engines?.size === 0) browserDnrEngines.delete(session)
}
function approvedBrowserExtensions() {
  try {
    const body = JSON.parse(fs.readFileSync(EXT_REVIEW_REGISTRY, 'utf8'))
    return new Map((Array.isArray(body.items) ? body.items : [])
      .filter((x) => x && x.status === 'listed' && x.reviewedBy && x.reviewedAt && BROWSER_TAB_ID.test(String(x.id || '')))
      .map((x) => [String(x.id), String(x.extPath || '')]))
  } catch (_) { return new Map() }
}
async function syncBrowserExtensions(ids) {
  const first = [...browserViews.values()].find((rec) => !rec.internal)
  if (!first) return []
  const session = first.view.webContents.session
  const approved = approvedBrowserExtensions()
  const wanted = new Set()
  for (const id of Array.isArray(ids) ? ids : []) {
    const key = String(id || '')
    if (!approved.has(key)) continue
    const rel = approved.get(key)
    if (!rel || path.isAbsolute(rel) || rel.includes('..')) continue
    const abs = path.resolve(EXT_ROOT, rel)
    if (!abs.startsWith(EXT_ROOT + path.sep) || !fs.existsSync(path.join(abs, 'manifest.json'))) continue
    wanted.add(key)
    if (!loadedExts.has(key)) {
      try {
        const extension = await session.loadExtension(abs, { allowFileAccess: false })
        installDnrCompat(session, key, abs)
        loadedExts.set(key, { abs, extension, session })
      } catch (error) { console.error('[browser-ext] 审核扩展加载失败:', key, error?.message || error) }
    }
  }
  for (const [id, rec] of [...loadedExts]) {
    if (wanted.has(id)) continue
    try { session.removeExtension(rec.extension.id) } catch (_) {}
    removeDnrCompat(session, id)
    loadedExts.delete(id)
  }
  return [...wanted].filter((id) => loadedExts.has(id))
}

/* 每次下载由用户选择保存位置，默认仍落在九规下载目录；敏感类型先警告、由用户决定。
   文件工具只认本进程真实下载记录和默认目录文件，绝不接受任意路径作为打开依据。 */
const RISKY_DOWNLOAD_EXTS = new Set(['.exe', '.msi', '.msix', '.appx', '.bat', '.cmd', '.scr', '.com', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.reg', '.dll', '.lnk', '.hta', '.jar', '.sh', '.app', '.dmg', '.pkg', '.deb', '.rpm'])
const browserDownloads = []
let browserDownloadSeq = 0
function downloadDir() {
  const dir = process.env.JG_BROWSER_DOWNLOAD_DIR || path.join(app.getPath('downloads'), '九规智能中枢')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
function riskyDownload(name) { return RISKY_DOWNLOAD_EXTS.has(path.extname(String(name || '')).toLowerCase()) }
function emitDownload(entry) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:download-state', { ...entry })
}
function uniqueDownloadPath(filename) {
  const safeName = path.basename(String(filename || 'download.bin')).replace(/[<>:"|?*]/g, '_') || 'download.bin'
  const ext = path.extname(safeName)
  const base = path.basename(safeName, ext)
  let target = path.join(downloadDir(), safeName)
  let index = 1
  while (fs.existsSync(target)) target = path.join(downloadDir(), `${base} (${index++})${ext}`)
  return target
}
function diskDownloads() {
  try {
    return fs.readdirSync(downloadDir(), { withFileTypes: true }).filter((item) => item.isFile() && !/\.(crdownload|part|tmp)$/i.test(item.name)).map((item) => {
      const full = path.join(downloadDir(), item.name)
      let stat
      try { stat = fs.statSync(full) } catch (_) { return null }
      return { id: `FS-${item.name}`, name: item.name, path: full, url: '', state: 'completed', bytes: stat.size, total: stat.size, received: stat.size, completedAt: stat.mtimeMs }
    }).filter(Boolean).sort((a, b) => b.completedAt - a.completedAt)
  } catch (_) { return [] }
}
function safeCompletedDownload(target) {
  const full = path.resolve(String(target || ''))
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null
  const known = [...browserDownloads, ...diskDownloads()]
  return known.find((item) => item.state === 'completed' && item.path && path.resolve(item.path) === full) || null
}

/* 云浏览器分区禁止设备与权限提权；普通文件下载走受控策略。 */
function hookBrowserPolicy(session) {
  if (browserSessionsHooked.has(session)) return
  browserSessionsHooked.add(session)
  session.on('will-download', async (event, item) => {
    const filename = path.basename(String(item.getFilename() || 'download.bin')).replace(/[<>:"|?*]/g, '_') || 'download.bin'
    const url = String(item.getURL() || '')
    const risky = riskyDownload(filename)
    let savePath = ''
    try {
      if (risky) {
        const warning = await dialog.showMessageBox(mainWindow, {
          type: 'warning', title: '敏感文件下载提醒', message: `“${filename}”可能执行代码或修改系统`,
          detail: `来源：${url}\n\n仅在来源可信且你明确需要该文件时继续。下载后不会自动运行。`,
          buttons: ['取消下载', '我了解风险，继续'], defaultId: 0, cancelId: 0, noLink: true,
        })
        if (warning.response !== 1) {
          item.cancel()
          emitDownload({ id: `DL-${Date.now()}-${++browserDownloadSeq}`, name: filename, url, state: 'cancelled', risky, error: '用户取消敏感文件下载' })
          return
        }
      }
      const choice = await dialog.showSaveDialog(mainWindow, {
        title: '选择下载保存位置', defaultPath: uniqueDownloadPath(filename), buttonLabel: '保存',
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      })
      if (choice.canceled || !choice.filePath) {
        item.cancel()
        emitDownload({ id: `DL-${Date.now()}-${++browserDownloadSeq}`, name: filename, url, state: 'cancelled', risky, error: '用户取消下载' })
        return
      }
      savePath = path.resolve(choice.filePath)
      item.setSavePath(savePath)
    } catch (_) {
      item.cancel()
      emitDownload({ id: `DL-${Date.now()}-${++browserDownloadSeq}`, name: filename, url, state: 'failed', risky, error: '无法选择保存位置' })
      return
    }
    const entry = { id: `DL-${Date.now()}-${++browserDownloadSeq}`, name: path.basename(savePath), path: savePath, url, state: 'downloading', risky, received: 0, total: Number(item.getTotalBytes() || 0), startedAt: Date.now() }
    browserDownloads.unshift(entry)
    browserDownloads.splice(40)
    emitDownload(entry)
    item.on('updated', (_e, state) => {
      entry.state = state === 'interrupted' ? 'interrupted' : 'downloading'
      entry.received = Number(item.getReceivedBytes() || 0)
      entry.total = Number(item.getTotalBytes() || 0)
      emitDownload(entry)
    })
    item.once('done', (_e, state) => {
      entry.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed'
      entry.received = Number(item.getReceivedBytes() || 0)
      entry.total = Number(item.getTotalBytes() || entry.received)
      if (entry.state === 'completed') { try { entry.bytes = fs.statSync(savePath).size } catch (_) {} }
      emitDownload(entry)
    })
  })
  session.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false) })
  session.setPermissionCheckHandler(() => false)
  session.setDevicePermissionHandler(() => false)
}

/* 网站密码只存在当前 Windows 用户的 Electron userData 中，由 safeStorage/DPAPI 加密。
   渲染进程只能看到 origin、用户名和记录 id；解密与填充都留在主进程。 */
const PASSWORD_FILE = path.join(app.getPath('userData'), 'cloud-passwords-v1.json')
const passwordFillRequests = new Map()
function httpsOrigin(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' ? url.origin : ''
  } catch (_) { return '' }
}
function readPasswordStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PASSWORD_FILE, 'utf8'))
    return Array.isArray(parsed?.items) ? parsed.items.filter((item) => item && httpsOrigin(item.origin) && typeof item.password === 'string') : []
  } catch (_) { return [] }
}
function writePasswordStore(items) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统无法提供安全加密，未保存密码')
  fs.mkdirSync(path.dirname(PASSWORD_FILE), { recursive: true })
  const temp = `${PASSWORD_FILE}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify({ version: 1, items }), { encoding: 'utf8', mode: 0o600 })
  fs.renameSync(temp, PASSWORD_FILE)
}
function passwordMetadata(item) {
  return { id: item.id, origin: item.origin, username: item.username || '', createdAt: item.createdAt, updatedAt: item.updatedAt }
}
function sendBrowserNavState(rec, titleOverride) {
  if (!mainWindow || mainWindow.isDestroyed() || !rec || rec.view.webContents.isDestroyed()) return
  const wc = rec.view.webContents
  mainWindow.webContents.send('browser:nav-state', {
    tabId: rec.tabId,
    url: String(wc.getURL() || ''),
    title: String(titleOverride || wc.getTitle() || ''),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  })
}

function sendBrowserNavError(rec, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('browser:nav-error', { ...payload, tabId: rec.tabId })
}

function createBrowserView(tabId, internal) {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
      ...(internal ? { session: mainWindow.webContents.session } : {
        partition: BROWSER_PARTITION,
        preload: path.join(__dirname, 'browser-password-preload.cjs'),
      }),
    },
  })
  const rec = { tabId, view, internal, attached: false, url: '' }
  const wc = view.webContents
  if (!internal) hookBrowserPolicy(wc.session)
  view.setBackgroundColor('#ffffff')
  wc.setWindowOpenHandler(({ url }) => {
    const target = String(url || '')
    const allowed = internal ? isInternalPreviewUrl(target) : /^https?:\/\//i.test(target) && !isLoopbackUrl(target)
    if (allowed && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser:new-window', { url: target, sourceTabId: tabId })
    }
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (internal ? !isInternalPreviewUrl(url) : (!/^https?:\/\//i.test(url) || isLoopbackUrl(url))) event.preventDefault()
  })
  wc.on('did-finish-load', () => {
    rec.url = String(wc.getURL() || rec.url)
    if (internal) {
      try { wc.setZoomFactor(1); mainWindow.webContents.setZoomFactor(1) } catch (_) {}
    }
    sendBrowserNavState(rec)
  })
  wc.on('page-title-updated', (_event, title) => sendBrowserNavState(rec, title))
  wc.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3) return
    sendBrowserNavError(rec, { code, description: String(description || ''), url: String(validatedURL || '') })
  })
  wc.on('render-process-gone', (_event, details) => sendBrowserNavError(rec, {
    code: String(details?.reason || 'crashed'), description: '页面进程已崩溃，可点击重试重新加载', url: String(wc.getURL() || ''),
  }))
  wc.on('unresponsive', () => sendBrowserNavError(rec, {
    code: 'unresponsive', description: '页面无响应，可点击重试重新加载', url: String(wc.getURL() || ''),
  }))
  wc.on('responsive', () => sendBrowserNavState(rec))
  wc.once('destroyed', () => {
    rec.attached = false
    if (browserViews.get(tabId) === rec) browserViews.delete(tabId)
    if (activeBrowserTabId === tabId) activeBrowserTabId = ''
  })
  browserViews.set(tabId, rec)
  return rec
}

function hideBrowserViews() {
  for (const rec of browserViews.values()) {
    try { rec.view.setVisible(false) } catch (_) {}
  }
  activeBrowserTabId = ''
}

function showBrowserView(tabId, target) {
  if (!mainWindow || !BROWSER_TAB_ID.test(tabId)) return null
  const internal = isInternalPreviewUrl(target)
  if (!internal && isLoopbackUrl(target)) return null
  let rec = browserViews.get(tabId)
  if (rec && rec.internal !== internal) { closeBrowserView(tabId); rec = null }
  if (!rec) rec = createBrowserView(tabId, internal)
  hideBrowserViews()
  if (!rec.attached) {
    mainWindow.contentView.addChildView(rec.view)
    rec.attached = true
  }
  if (browserBounds) rec.view.setBounds(browserBounds)
  rec.view.setVisible(true)
  activeBrowserTabId = tabId
  if (rec.url !== target) {
    rec.url = target
    rec.view.webContents.loadURL(target).catch(() => {})
  }
  return rec
}

function activeBrowserView() {
  return browserViews.get(activeBrowserTabId)?.view || null
}

function closeBrowserView(tabId) {
  const rec = browserViews.get(String(tabId || ''))
  if (!rec) return false
  browserViews.delete(rec.tabId)
  for (const request of [...passwordFillRequests.values()]) if (request.webContents === rec.view.webContents) {
    clearTimeout(request.timer)
    passwordFillRequests.delete(request.id)
    request.resolve(false)
  }
  if (rec.attached && mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.contentView.removeChildView(rec.view) } catch (_) {}
  }
  rec.attached = false
  try { rec.view.webContents.close() } catch (_) {}
  if (activeBrowserTabId === rec.tabId) activeBrowserTabId = ''
  return true
}

function closeAllBrowserViews() {
  for (const tabId of [...browserViews.keys()]) closeBrowserView(tabId)
  for (const [id, rec] of [...loadedExts]) {
    try { rec.session.removeExtension(rec.extension.id) } catch (_) {}
    removeDnrCompat(rec.session, id)
    loadedExts.delete(id)
  }
}

function appPartition(appId) {
  const digest = crypto.createHash('sha256').update(String(appId || '')).digest('hex').slice(0, 16)
  return `persist:jg-as-${digest}`
}

function appViewSend(rec, patch = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.webContents.send('app:tab-state', {
      appId: rec.appId,
      url: String(rec.url || ''),
      title: String(rec.view.webContents.getTitle() || ''),
      status: rec.status || 'loading',
      ...patch,
    })
  } catch (_) {}
}

function ensureAppView(appId, url = '') {
  if (!mainWindow || mainWindow.isDestroyed()) return null
  const key = String(appId || '').trim()
  if (!key) return null
  let rec = appViews.get(key)
  if (!rec) {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
        /* 每个应用独立持久化分区：应用之间、应用与中枢主界面之间不共享
           Cookie / localStorage，避免一个应用读到中枢登录态。 */
        partition: appPartition(key),
      },
    })
    rec = { appId: key, view, url: '', status: 'starting' }
    appViews.set(key, rec)
    view.setBackgroundColor('#ffffff')
    view.webContents.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:\/\//i.test(String(target || ''))) shell.openExternal(String(target))
      return { action: 'deny' }
    })
    view.webContents.on('will-navigate', (event, target) => {
      if (!/^https?:\/\//i.test(String(target || ''))) event.preventDefault()
    })
    view.webContents.on('did-finish-load', () => {
      rec.status = 'ready'
      appViewSend(rec, { status: 'ready', url: String(rec.view.webContents.getURL() || rec.url || '') })
    })
    view.webContents.on('page-title-updated', (_event, title) => {
      appViewSend(rec, { title: String(title || '') })
    })
    view.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
      if (!isMainFrame || code === -3) return
      rec.status = 'failed'
      appViewSend(rec, { status: 'failed', url: String(validatedURL || rec.url || ''), error: String(description || code || '') })
    })
    view.webContents.on('render-process-gone', (_event, details) => {
      rec.status = 'crashed'
      appViewSend(rec, { status: 'crashed', error: String(details?.reason || '') })
    })
    mainWindow.contentView.addChildView(view)
    view.setVisible(false)
  }
  if (url && rec.url !== url) {
    rec.url = String(url)
    rec.status = 'loading'
    appViewSend(rec, { status: 'loading', url: rec.url })
    rec.view.webContents.loadURL(rec.url).catch((error) => {
      rec.status = 'failed'
      appViewSend(rec, { status: 'failed', error: String(error?.message || error) })
    })
  }
  return rec
}

function showAppView(appId) {
  const key = String(appId || '').trim()
  const rec = appViews.get(key)
  if (!rec) return false
  for (const [id, item] of appViews) item.view.setVisible(id === key)
  activeAppId = key
  if (appBounds) rec.view.setBounds(appBounds)
  try { rec.view.webContents.focus() } catch (_) {}
  return true
}

function hideAppViews() {
  for (const item of appViews.values()) item.view.setVisible(false)
}

function closeAppView(appId) {
  const key = String(appId || '').trim()
  const rec = appViews.get(key)
  if (!rec) return
  appViews.delete(key)
  if (activeAppId === key) activeAppId = ''
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.contentView.removeChildView(rec.view) } catch (_) {}
  }
  try { rec.view.webContents.close() } catch (_) {}
}

function closeAllAppViews() {
  for (const key of [...appViews.keys()]) closeAppView(key)
  activeAppId = ''
  appBounds = null
}

function windowChromeOptions() {
  if (process.platform !== 'win32') return { frame: false }
  // Windows 使用系统标题栏覆盖层：原生最小化/最大化/关闭按钮自带 Snap Layouts（悬停显示分屏布局），
  // 并且在最大化、还原时自动切换图标，不需要在页面里自绘窗口按钮。
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...TITLEBAR_THEME.login },
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    ...windowChromeOptions(),
    show: false,
    backgroundColor: '#ffffff',
    title: '九规智能中枢 · 企业级 AI 中枢',
    icon: path.join(__dirname, 'jg-app-icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // 应用进程租约靠前端心跳续期；窗口最小化/被遮挡时不能把计时器节流到 1 分钟。
      backgroundThrottling: false,
    },
  })

  /* ready-to-show 依赖首帧渲染；GPU 合成异常时可能一直不触发，窗口就永远藏在后台。
     页面加载完成或兜底计时到点都必须把窗口显示出来，避免用户看到“进程在跑但没有窗口”。 */
  const showWindow = () => {
    if (window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    if (typeof window.moveTop === 'function') window.moveTop()
  }
  window.once('ready-to-show', showWindow)
  window.webContents.once('did-finish-load', showWindow)
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[jg-window] 页面加载失败 ${code} ${description} ${url}`)
    showWindow()
  })
  setTimeout(showWindow, 3000)
  const broadcastWindowState = () => pushWindowState(window)
  for (const eventName of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'resize', 'move']) {
    window.on(eventName, broadcastWindowState)
  }
  window.on('closed', () => {
    if (mainWindow === window) {
      closeAllAppViews()
      closeAllBrowserViews()
      mainWindow = null
      activeBrowserTabId = ''
    }
  })

  window.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!/^https?:\/\//i.test(String(params.src || ''))) {
      event.preventDefault()
      return
    }
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${serverPort}/`)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1440,
          height: 900,
          minWidth: 1024,
          minHeight: 680,
          ...windowChromeOptions(),
          backgroundColor: '#ffffff',
          autoHideMenuBar: true,
          icon: path.join(__dirname, 'jg-app-icon.ico'),
          webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
          },
        },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}/`)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  /* 复位主窗口原生缩放：Chromium 会按站点持久化上次的 zoom level，
     一旦被缩到 50%，CSS 视口会翻倍、布局按两倍宽度排，表现为元素偏小、
     右侧与下方大片留白。启动时强制回到 100%，加载完成后再兜底复位一次；
     运行中若内核缩放偏离 100%（误触 Ctrl±/滚轮或档位漂移），立即拉回。 */
  const resetMainZoom = () => { try { window.webContents.setZoomLevel(0); window.webContents.setZoomFactor(1) } catch (_) {} }
  resetMainZoom()
  window.webContents.on('dom-ready', () => { resetMainZoom() })
  window.webContents.on('did-finish-load', () => { resetMainZoom() })
  window.webContents.on('did-frame-finish-load', () => { resetMainZoom() })
  window.webContents.on('zoom-changed', () => {
    if (Math.abs(window.webContents.getZoomFactor() - 1) > 1e-6) resetMainZoom()
  })
  /* 方案 A：主窗口内核原生缩放锁死 100%，缩放只由前端菜单的 CSS zoom 承担。
     拦截 Ctrl/⌘ + =/+/-/_/0 键盘手势，不让其落到内核改档位；
     Ctrl+滚轮缩放在渲染层拦截。内嵌云浏览器/应用视图有独立缩放，不走此锁定。 */
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!(input.control || input.meta)) return
    if (['=', '+', '-', '_', '0'].includes(input.key)) { event.preventDefault(); resetMainZoom() }
  })
  const lockMainWheelZoom = `(() => {
    if (window.__jgWheelZoomLocked) return
    window.__jgWheelZoomLocked = true
    window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false, capture: true })
  })()`
  window.webContents.on('did-finish-load', () => { window.webContents.executeJavaScript(lockMainWheelZoom, true).catch(() => {}) })
  installBridge(window.webContents)
  window.loadURL(`http://127.0.0.1:${serverPort}/`)
  return window
}

function windowStateOf(window) {
  if (!window || window.isDestroyed()) return { maximized: false, fullscreen: false, snapped: '' }
  const maximized = window.isMaximized()
  const fullscreen = window.isFullScreen()
  let snapped = ''
  if (!maximized && !fullscreen) {
    const bounds = window.getBounds()
    const area = screen.getDisplayMatching(bounds).workArea
    const near = (a, b) => Math.abs(a - b) <= 12
    if (near(bounds.width, Math.floor(area.width / 2)) && near(bounds.height, area.height)) {
      snapped = bounds.x <= area.x + 12 ? 'left' : 'right'
    } else if (near(bounds.width, area.width) && near(bounds.height, Math.floor(area.height / 2))) {
      snapped = bounds.y <= area.y + 12 ? 'top' : 'bottom'
    } else if (near(bounds.width, Math.floor(area.width / 2)) && near(bounds.height, Math.floor(area.height / 2))) {
      const left = bounds.x <= area.x + 12
      const top = bounds.y <= area.y + 12
      snapped = `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`
    }
  }
  return { maximized, fullscreen, snapped }
}

function pushWindowState(window) {
  if (!window || window.isDestroyed()) return
  window.webContents.send('window:state', windowStateOf(window))
}

ipcMain.handle('window:get-state', (event) => {
  return windowStateOf(BrowserWindow.fromWebContents(event.sender))
})

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.on('window:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
  pushWindowState(window)
})

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

ipcMain.on('window:titlebar-theme', (event, payload = {}) => {
  applyTitleBarTheme(BrowserWindow.fromWebContents(event.sender), payload.mode)
})

ipcMain.on('browser:open', (_event, payload = {}) => {
  const tabId = String(payload.tabId || '')
  const target = String(payload.url || '')
  if (!BROWSER_TAB_ID.test(tabId) || !/^https?:\/\//i.test(target)) return
  const rec = showBrowserView(tabId, target)
  if (!rec && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser:nav-error', {
      tabId, code: 'address-blocked', description: '该地址不在云浏览器允许范围内', url: target,
    })
  }
})

ipcMain.on('browser:bounds', (_event, payload = {}) => {
  const box = cssRectToWindow(payload.rect || payload)
  browserBounds = { x: box.x, y: box.y, width: box.width, height: box.height }
  activeBrowserView()?.setBounds(browserBounds)
})

ipcMain.on('browser:activate', (_event, tabId) => {
  const rec = browserViews.get(String(tabId || ''))
  if (!rec) return
  showBrowserView(rec.tabId, rec.url || rec.view.webContents.getURL())
})
ipcMain.on('browser:hide', () => hideBrowserViews())
ipcMain.on('browser:reload', () => { activeBrowserView()?.webContents.reload() })
ipcMain.on('browser:go-back', () => {
  const wc = activeBrowserView()?.webContents
  if (wc?.canGoBack()) wc.goBack()
})
ipcMain.on('browser:go-forward', () => {
  const wc = activeBrowserView()?.webContents
  if (wc?.canGoForward()) wc.goForward()
})
ipcMain.on('browser:close', (_event, tabId) => { closeBrowserView(String(tabId || '')) })
ipcMain.on('browser:close-all', () => closeAllBrowserViews())

/* 常用工具只作用于当前云浏览器标签；内部预览不允许缩放或清除中枢会话。 */
ipcMain.on('browser:set-zoom', (_event, factor) => {
  const rec = browserViews.get(activeBrowserTabId)
  if (!rec || rec.internal) return
  rec.view.webContents.setZoomFactor(Math.max(0.5, Math.min(2, Number(factor) || 1)))
})
ipcMain.handle('browser:zoom', () => {
  const rec = browserViews.get(activeBrowserTabId)
  return { ok: true, factor: rec && !rec.internal ? Number(rec.view.webContents.getZoomFactor() || 1) : 1 }
})
ipcMain.on('browser:print', () => { activeBrowserView()?.webContents.print({ silent: false, printBackground: true }, () => {}) })
ipcMain.handle('browser:screenshot', async () => {
  const wc = activeBrowserView()?.webContents
  if (!wc) return { ok: false, error: '云浏览器未打开' }
  try {
    const image = browserBounds && mainWindow && !mainWindow.isDestroyed()
      ? await mainWindow.capturePage(browserBounds)
      : await wc.capturePage()
    const png = image.toPNG()
    const file = uniqueDownloadPath(`screenshot-${Date.now()}.png`)
    fs.writeFileSync(file, png)
    const entry = { id: `DL-${Date.now()}-${++browserDownloadSeq}`, name: path.basename(file), path: file, url: String(wc.getURL() || ''), state: 'completed', received: png.length, total: png.length, bytes: png.length }
    browserDownloads.unshift(entry)
    browserDownloads.splice(40)
    emitDownload(entry)
    return { ok: true, path: file }
  } catch (error) { return { ok: false, error: String(error?.message || error) } }
})
ipcMain.handle('browser:clear-data', async () => {
  const rec = browserViews.get(activeBrowserTabId)
  if (!rec) return { ok: false, error: '云浏览器未打开' }
  if (rec.internal) return { ok: false, error: '内部预览使用中枢会话，不能在此清除' }
  try { await rec.view.webContents.session.clearStorageData(); return { ok: true } }
  catch (error) { return { ok: false, error: String(error?.message || error) } }
})
ipcMain.on('browser:find', (_event, payload = {}) => {
  const rec = browserViews.get(activeBrowserTabId)
  const wc = rec?.view.webContents
  if (!wc) return
  const text = String(payload.text || '').trim().slice(0, 200)
  if (!text) return
  const forward = payload.forward !== false
  /* 当前 Electron 的原生 findInPage/stopFindInPage 会阻塞后续视图 IPC；
     使用页面 window.find 完成同等定位，不触发该原生缺陷。 */
  wc.executeJavaScript(`(() => { try { return window.find(${JSON.stringify(text)}, false, ${forward}, true, false, false, false) } catch (_) { return false } })()`, true)
    .then((found) => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.webContents.send('browser:find-result', { tabId: rec.tabId, matchCount: found ? 1 : 0, activeMatchOrdinal: found ? 1 : 0, finalUpdate: true })
    }).catch(() => {})
})
ipcMain.handle('browser:downloads', () => {
  const live = browserDownloads.map((entry) => ({ ...entry }))
  const paths = new Set(live.filter((entry) => entry.path).map((entry) => path.resolve(entry.path)))
  return { ok: true, items: [...live, ...diskDownloads().filter((entry) => !paths.has(path.resolve(entry.path)))].slice(0, 60), directory: downloadDir() }
})
ipcMain.on('browser:download-open', (_event, target) => {
  const entry = safeCompletedDownload(target)
  if (entry) shell.openPath(entry.path).catch(() => {})
})
ipcMain.on('browser:download-reveal', (_event, target) => {
  const entry = safeCompletedDownload(target)
  if (entry) shell.showItemInFolder(entry.path)
})

/* HTTPS 登录表单提交后默认自动加密保存；同网站、同账号再次提交会更新密码。
   明文不进入中枢前端，前端只收到保存结果和元数据。 */
ipcMain.on('browser:password-submit', (event, payload = {}) => {
  const rec = [...browserViews.values()].find((item) => !item.internal && item.view.webContents === event.sender)
  if (!rec) return
  const origin = httpsOrigin(payload.origin)
  const password = String(payload.password || '')
  const username = String(payload.username || '').slice(0, 320)
  if (!origin || origin !== httpsOrigin(rec.view.webContents.getURL()) || !password || password.length > 1024) return
  try {
    const now = new Date().toISOString()
    const items = readPasswordStore()
    const existing = items.find((item) => item.origin === origin && item.username === username)
    const entry = existing || { id: crypto.randomUUID(), origin, username, createdAt: now }
    entry.password = safeStorage.encryptString(password).toString('base64')
    entry.updatedAt = now
    if (!existing) items.push(entry)
    writePasswordStore(items)
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:password-saved', { ok: true, tabId: rec.tabId, item: passwordMetadata(entry) })
    return { ok: true, item: passwordMetadata(entry) }
  } catch (error) {
    const message = String(error?.message || '密码自动保存失败')
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser:password-saved', { ok: false, tabId: rec.tabId, origin, error: message })
    return { ok: false, error: message }
  }
})
ipcMain.handle('browser:password-list', () => ({ ok: true, items: readPasswordStore().map(passwordMetadata) }))
ipcMain.handle('browser:password-delete', (_event, id) => {
  const target = String(id || '')
  const items = readPasswordStore()
  const next = items.filter((item) => item.id !== target)
  if (next.length === items.length) return { ok: false, error: '密码记录不存在' }
  try { writePasswordStore(next); return { ok: true } }
  catch (error) { return { ok: false, error: String(error?.message || error) } }
})
ipcMain.on('browser:password-filled', (event, payload = {}) => {
  const request = passwordFillRequests.get(String(payload.requestId || ''))
  if (!request || request.webContents !== event.sender) return
  clearTimeout(request.timer)
  passwordFillRequests.delete(request.id)
  request.resolve(!!payload.ok)
})
ipcMain.handle('browser:password-fill', async (_event, payload = {}) => {
  const rec = browserViews.get(String(payload.tabId || ''))
  if (!rec || rec.internal) return { ok: false, error: '目标网页已关闭' }
  const item = readPasswordStore().find((entry) => entry.id === String(payload.id || ''))
  if (!item) return { ok: false, error: '密码记录不存在' }
  if (httpsOrigin(rec.view.webContents.getURL()) !== item.origin) return { ok: false, error: '网站源不匹配，已拒绝填充' }
  try {
    const password = safeStorage.decryptString(Buffer.from(item.password, 'base64'))
    const wc = rec.view.webContents
    const requestId = crypto.randomUUID()
    const filled = await new Promise((resolve) => {
      const timer = setTimeout(() => { passwordFillRequests.delete(requestId); resolve(false) }, 5000)
      timer.unref?.()
      passwordFillRequests.set(requestId, { id: requestId, webContents: wc, resolve, timer })
      try {
        wc.send('browser:password-fill', { requestId, origin: item.origin, username: String(item.username || ''), password })
      } catch (_) {
        clearTimeout(timer)
        passwordFillRequests.delete(requestId)
        resolve(false)
      }
    })
    return filled ? { ok: true } : { ok: false, error: '当前页面没有可填充的密码框或页面未响应' }
  } catch (_) { return { ok: false, error: '密码解密或填充失败' } }
})

/* 渲染进程只能提交扩展 id；主进程按管理中心审核注册表解析目录。 */
ipcMain.handle('browser:load-extensions', async (_event, ids) => ({ ok: true, items: await syncBrowserExtensions(ids) }))

/* ---------- 应用工作区标签页 ---------- */
ipcMain.on('app:open', (_event, payload = {}) => {
  const appId = String(payload.appId || '').trim()
  const url = String(payload.url || '')
  if (!appId || !/^https?:\/\//i.test(url)) return
  ensureAppView(appId, url)
  if (payload.activate !== false) showAppView(appId)
})

ipcMain.on('app:activate', (_event, appId) => {
  showAppView(String(appId || '').trim())
})

ipcMain.on('app:hide', () => hideAppViews())

ipcMain.handle('app:page-text', async (_event, appId) => {
  const rec = appViews.get(String(appId || '').trim())
  if (!rec) return { ok: false, error: '应用视图未打开' }
  try {
    const text = await rec.view.webContents.executeJavaScript(
      `(() => { try { return String(document.body ? document.body.innerText : '').slice(0, 20000) } catch (_) { return '' } })()`,
      true,
    )
    return { ok: true, text: String(text || '') }
  } catch (error) {
    return { ok: false, error: String(error?.message || error) }
  }
})

ipcMain.on('app:close', (_event, appId) => {
  closeAppView(String(appId || '').trim())
})

ipcMain.on('app:bounds', (_event, payload = {}) => {
  const rect = payload.rect || payload
  const box = cssRectToWindow(rect)
  appBounds = { x: box.x, y: box.y, width: box.width, height: box.height }
  const active = appViews.get(activeAppId)
  if (active) active.view.setBounds(appBounds)
})

ipcMain.on('browser:open-external', (_event, url) => {
  if (/^https?:\/\//i.test(String(url || ''))) shell.openExternal(String(url))
})

ipcMain.handle('browser:page-info', (_event, tabId) => {
  const rec = tabId ? browserViews.get(String(tabId)) : browserViews.get(activeBrowserTabId)
  const wc = rec?.view.webContents
  if (!wc) return { ok: false, error: '自带浏览器未打开' }
  try {
    return {
      ok: true,
      url: String(wc.getURL() || ''),
      title: String(wc.getTitle() || ''),
      canGoBack: wc.canGoBack(),
      canGoForward: wc.canGoForward(),
    }
  } catch (error) {
    return { ok: false, error: String(error?.message || error) }
  }
})

ipcMain.handle('browser:page-text', async (_event, tabId) => {
  const rec = tabId ? browserViews.get(String(tabId)) : browserViews.get(activeBrowserTabId)
  const wc = rec?.view.webContents
  if (!wc) return { ok: false, error: '自带浏览器未打开' }
  try {
    const text = await Promise.race([
      wc.executeJavaScript(
        `(() => { try { return String(document.body ? document.body.innerText : '').slice(0, 20000) } catch (_) { return '' } })()`,
        true,
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('页面正文读取超时')), 5000)),
    ])
    return { ok: true, text: String(text || '') }
  } catch (error) {
    return { ok: false, error: String(error?.message || error) }
  }
})

ipcMain.handle('shell:reveal-path', async (_event, target) => {
  const dir = String(target || '')
  if (!dir || !path.isAbsolute(dir)) return { ok: false, error: '项目目录无效' }
  if (!fs.existsSync(dir)) return { ok: false, error: '项目目录不存在或已离线' }
  const error = await shell.openPath(dir)
  if (error) {
    shell.showItemInFolder(dir)
    return { ok: false, error }
  }
  return { ok: true }
})

ipcMain.handle('shell:reveal-file', async (_event, target) => {
  const file = String(target || '')
  if (!file || !path.isAbsolute(file)) return { ok: false, error: '文件路径无效' }
  if (!fs.existsSync(file)) return { ok: false, error: '文件不存在或已离线' }
  shell.showItemInFolder(file)
  return { ok: true }
})

ipcMain.handle('settings:clear-cache', async (event) => {
  try {
    const session = event.sender.session
    await session.clearCache()
    await session.clearStorageData({ storages: ['cachestorage', 'shadercache'] })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('dialog:choose-folder', async (event, options = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(window || mainWindow, {
    title: options.title || '选择项目文件夹',
    buttonLabel: options.buttonLabel || '选择文件夹',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths?.length) return { canceled: true }
  return { canceled: false, path: result.filePaths[0] }
})

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      // 已在后台运行时再次点击快捷方式：必须先还原并显示到前台，仅 focus 在最小化/被遮挡时不会把窗口带回可见。
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      if (typeof mainWindow.moveTop === 'function') mainWindow.moveTop()
    }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    app.on('web-contents-created', (_event, contents) => installBridge(contents))
    ensureOnlyOfficeService()

    try {
      /* 已经有健康的本机服务就复用，不再另起一套：两套服务会同时写同一个 SQLite。 */
      const pidInfo = readServerPidInfo()
      const pidPort = pidInfo && Number.isFinite(Number(pidInfo.port)) ? Number(pidInfo.port) : null
      const holderAlive = Boolean(pidInfo && isProcessAlive(pidInfo.pid))
      if (await probeHealth(PREFERRED_PORT)) {
        serverPort = PREFERRED_PORT
        console.log(`[jg-server] 复用已在运行的本机服务 http://127.0.0.1:${serverPort}`)
      } else if (pidPort && pidPort !== PREFERRED_PORT && await probeHealth(pidPort)) {
        /* 标记文件里的实例可能不在首选端口（历史启动脚本、手工服务）。
           它健康就先用它，不能只认 PREFERRED_PORT 然后误判成“服务已死”。 */
        serverPort = pidPort
        console.log(`[jg-server] 复用标记文件中的服务 pid=${pidInfo.pid} http://127.0.0.1:${serverPort}`)
      } else if (holderAlive) {
        /* 进程还活着但暂时没响应（长任务、正在启动）：等它恢复，不能再起第二套。 */
        serverPort = pidPort || PREFERRED_PORT
        try {
          await waitForServer(serverPort, 30000)
          console.log(`[jg-server] 等待已有服务恢复 pid=${pidInfo.pid}`)
        } catch (_) {
          console.error(`[jg-server] 已有服务 pid=${pidInfo.pid} 存活但 30 秒无响应，避免重复实例不再自动重启`)
        }
      } else {
        serverPort = PREFERRED_PORT
        startServer(serverPort)
        try {
          await waitForServer(serverPort)
        } catch (_) {
          stopServer()
          serverPort = await getFreePort()
          startServer(serverPort)
          await waitForServer(serverPort)
        }
      }
      mainWindow = createWindow()
    } catch (error) {
      dialog.showErrorBox('九规智能中枢启动失败', String(error && error.message ? error.message : error))
      app.quit()
    }
  }).catch((error) => {
    dialog.showErrorBox('九规智能中枢启动失败', String(error && error.message ? error.message : error))
    app.quit()
  })

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    quitting = true
    stopServer()
  })
}
