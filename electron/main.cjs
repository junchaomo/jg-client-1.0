const { app, BrowserWindow, Menu, ipcMain, shell, dialog, WebContentsView, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const http = require('http')
const net = require('net')

const ROOT = path.join(__dirname, '..')
const ENTRY = path.join(ROOT, 'server.mjs')
/* 客户端与手工调试共用同一个端口，避免同一份 data 目录上跑两套服务。 */
const PREFERRED_PORT = Number(process.env.JG_PORT || 54269)

// 与旧客户端彻底隔离，避免沿用旧客户端的登录态、缓存与窗口状态。
app.setName('jg-client-1.0')
app.setPath('userData', path.join(app.getPath('appData'), 'jg-client-1.0'))
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
let browserView = null
let browserAttached = false
let browserUrl = ''
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
    const raw = fs.readFileSync(path.join(ROOT, 'data', 'run', 'server.pid'), 'utf8')
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

let browserDownloads = []
let browserDownloadSeq = 0
let browserSessionHooked = false
const BROWSER_PARTITION = 'persist:jg-cloud-browser'

/* 浏览器视图禁止回环访问本机服务（中枢服务跑在 127.0.0.1，浏览器只承载外网网页）。 */
function isLoopbackUrl(url) {
  try {
    const u = new URL(String(url))
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname)
  } catch (_) { return false }
}

/* 下载文件中需要提醒的可执行 / 脚本类型（浏览器隔离挡不住文件被系统程序执行）。 */
const RISKY_DOWNLOAD_EXTS = new Set(['.exe', '.msi', '.msix', '.appx', '.bat', '.cmd', '.scr', '.com', '.ps1', '.vbs', '.reg'])

/* 扩展只允许从客户端内置扩展目录加载，禁止 IPC 传入任意本机路径。 */
const EXT_ROOT = path.join(ROOT, 'extensions')
const loadedExts = new Map() // abs path -> Electron Extension
async function syncBrowserExtensions(paths) {
  if (!browserView) return
  const session = browserView.webContents.session
  const wanted = new Set()
  for (const raw of Array.isArray(paths) ? paths : []) {
    const abs = path.resolve(String(raw || ''))
    const within = abs === EXT_ROOT || abs.startsWith(EXT_ROOT + path.sep)
    if (!within) continue
    if (!fs.existsSync(path.join(abs, 'manifest.json'))) continue
    wanted.add(abs)
    if (!loadedExts.has(abs)) {
      try {
        const ext = await session.loadExtension(abs, { allowFileAccess: false })
        loadedExts.set(abs, ext)
      } catch (error) {
        console.error('[browser-ext] 加载失败:', abs, error?.message || error)
      }
    }
  }
  for (const [abs, ext] of [...loadedExts]) {
    if (!wanted.has(abs)) {
      try { session.removeExtension(ext.id) } catch (_) {}
      loadedExts.delete(abs)
    }
  }
}

function downloadDir() {
  const dir = path.join(app.getPath('downloads'), '九规智能中枢')
  try { fs.mkdirSync(dir, { recursive: true }) } catch (_) {}
  return dir
}

function emitDownload(entry) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser:download-state', entry)
  }
}

function diskDownloads() {
  const dir = downloadDir()
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((item) => item.isFile() && !/\.(crdownload|part|tmp)$/i.test(item.name))
      .map((item) => {
        const full = path.join(dir, item.name)
        let stat = null
        try { stat = fs.statSync(full) } catch (_) {}
        return {
          id: `FS-${item.name}`,
          name: item.name,
          path: full,
          url: '',
          state: 'completed',
          bytes: stat ? stat.size : 0,
          total: stat ? stat.size : 0,
          received: stat ? stat.size : 0,
          completedAt: stat ? stat.mtimeMs : 0,
        }
      })
      .sort((a, b) => b.completedAt - a.completedAt)
  } catch (_) {
    return []
  }
}

function hookBrowserDownloads(session) {
  if (browserSessionHooked) return
  browserSessionHooked = true
  session.on('will-download', (_event, item) => {
    const id = `DL-${Date.now()}-${++browserDownloadSeq}`
    const filename = path.basename(String(item.getFilename() || 'download.bin'))
    const dir = downloadDir()
    let savePath = path.join(dir, filename)
    const ext = path.extname(filename)
    const base = path.basename(filename, ext)
    let n = 1
    while (fs.existsSync(savePath)) {
      savePath = path.join(dir, `${base} (${n})${ext}`)
      n += 1
    }
    item.setSavePath(savePath)
    const entry = {
      id, name: path.basename(savePath), path: savePath,
      url: String(item.getURL() || ''), state: 'downloading',
      risky: RISKY_DOWNLOAD_EXTS.has(ext.toLowerCase()),
      received: 0, total: Number(item.getTotalBytes() || 0), startedAt: Date.now(),
    }
    browserDownloads = [entry, ...browserDownloads].slice(0, 40)
    emitDownload({ ...entry })
    item.on('updated', (_e, state) => {
      entry.state = state === 'interrupted' ? 'interrupted' : 'downloading'
      entry.received = Number(item.getReceivedBytes() || 0)
      entry.total = Number(item.getTotalBytes() || 0)
      emitDownload({ ...entry })
    })
    item.once('done', (_e, state) => {
      entry.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed'
      entry.received = Number(item.getReceivedBytes() || 0)
      entry.total = Number(item.getTotalBytes() || entry.received)
      if (entry.state === 'completed') {
        try { entry.bytes = fs.statSync(savePath).size } catch (_) {}
      }
      emitDownload({ ...entry })
    })
  })
}

function ensureBrowserView() {
  if (!mainWindow) return null
  if (!browserView) {
    browserView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
        partition: BROWSER_PARTITION,
      },
    })
    hookBrowserDownloads(browserView.webContents.session)
    browserView.setBackgroundColor('#ffffff')
    browserView.webContents.setWindowOpenHandler(({ url }) => {
      const target = String(url || '')
      // 页面内 target=_blank / window.open 的新窗口：回传渲染进程，在云浏览器网页标签内打开，不交由系统默认浏览器。
      if (/^https?:\/\//i.test(target) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:new-window', { url: target })
      }
      return { action: 'deny' }
    })
    browserView.webContents.on('will-navigate', (event, url) => {
      if (!/^https?:\/\//i.test(url) || isLoopbackUrl(url)) event.preventDefault()
    })
    browserView.webContents.on('did-finish-load', () => sendBrowserNavState(browserView.webContents))
    browserView.webContents.on('page-title-updated', (_event, title) => sendBrowserNavState(browserView.webContents, title))
    browserView.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
      if (!isMainFrame) return
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:nav-error', { code, description: String(description || ''), url: String(validatedURL || '') })
      }
    })
    browserView.webContents.on('render-process-gone', (_event, details) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:nav-error', {
          code: String(details?.reason || 'crashed'),
          description: '页面进程已崩溃，可点击重试重新加载',
          url: String(browserView.webContents.getURL() || ''),
        })
      }
    })
    browserView.webContents.on('unresponsive', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:nav-error', {
          code: 'unresponsive',
          description: '页面无响应，可点击重试重新加载',
          url: String(browserView.webContents.getURL() || ''),
        })
      }
    })
    browserView.webContents.on('responsive', () => sendBrowserNavState(browserView.webContents))
    browserView.webContents.on('found-in-page', (_event, result) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:find-result', {
          matchCount: result.matchCount || 0,
          activeMatchOrdinal: result.activeMatchOrdinal || 0,
          finalUpdate: !!result.finalUpdate,
        })
      }
    })
  }
  if (!browserAttached) {
    mainWindow.contentView.addChildView(browserView)
    browserAttached = true
  }
  if (browserBounds) browserView.setBounds(browserBounds)
  browserView.setVisible(true)
  return browserView
}

function sendBrowserNavState(wc, titleOverride) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('browser:nav-state', {
    url: String(wc.getURL() || ''),
    title: String(titleOverride || wc.getTitle() || ''),
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  })
}

function closeBrowserView() {
  if (!browserView || !mainWindow) return
  if (browserAttached) {
    try { mainWindow.contentView.removeChildView(browserView) } catch (_) {}
    browserAttached = false
  }
  try { browserView.webContents.close() } catch (_) {}
  browserView = null
  browserUrl = ''
  loadedExts.clear()
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
    titleBarOverlay: { color: '#ffffff', symbolColor: '#3a3f45', height: 38 },
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

  window.once('ready-to-show', () => window.show())
  const broadcastWindowState = () => pushWindowState(window)
  for (const eventName of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'resize', 'move']) {
    window.on(eventName, broadcastWindowState)
  }
  window.on('closed', () => {
    if (mainWindow === window) {
      closeAllAppViews()
      mainWindow = null
      browserView = null
      browserAttached = false
      browserUrl = ''
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

ipcMain.on('browser:open', (_event, url) => {
  if (!/^https?:\/\//i.test(String(url || ''))) return
  if (isLoopbackUrl(url)) return
  const view = ensureBrowserView()
  if (!view) return
  const next = String(url)
  if (browserUrl !== next) {
    browserUrl = next
    view.webContents.loadURL(next).catch(() => {})
  }
})

ipcMain.on('browser:bounds', (_event, rect = {}) => {
  const x = Math.max(0, Math.round(Number(rect.x) || 0))
  const y = Math.max(0, Math.round(Number(rect.y) || 0))
  const width = Math.max(1, Math.round(Number(rect.width) || 1))
  const height = Math.max(1, Math.round(Number(rect.height) || 1))
  browserBounds = { x, y, width, height }
  if (!browserView || !browserAttached) return
  browserView.setBounds(browserBounds)
})

ipcMain.on('browser:reload', () => {
  if (browserView) browserView.webContents.reload()
})

ipcMain.on('browser:go-back', () => {
  if (browserView && browserView.webContents.canGoBack()) browserView.webContents.goBack()
})

ipcMain.on('browser:go-forward', () => {
  if (browserView && browserView.webContents.canGoForward()) browserView.webContents.goForward()
})

ipcMain.on('browser:set-zoom', (_event, factor) => {
  if (!browserView) return
  const f = Math.max(0.5, Math.min(2, Number(factor) || 1))
  browserView.webContents.setZoomFactor(f)
})

ipcMain.handle('browser:zoom', () => {
  if (!browserView) return { ok: true, factor: 1 }
  return { ok: true, factor: Number(browserView.webContents.getZoomFactor() || 1) }
})

/* 打印当前页面（保留背景色与图片）。 */
ipcMain.on('browser:print', () => {
  if (!browserView) return
  browserView.webContents.print({ silent: false, printBackground: true }, () => {})
})

/* 截取当前页面，保存到下载目录并计入下载记录。 */
ipcMain.handle('browser:screenshot', async () => {
  if (!browserView) return { ok: false, error: '自带浏览器未打开' }
  try {
    const img = await browserView.webContents.capturePage()
    const png = img.toPNG()
    const file = path.join(downloadDir(), `screenshot-${Date.now()}.png`)
    fs.writeFileSync(file, png)
    const entry = { id: `dl-${Date.now()}`, name: path.basename(file), path: file, state: 'completed', received: png.length, total: png.length, mime: 'image/png' }
    browserDownloads = [entry, ...browserDownloads.filter((x) => x.path !== file)].slice(0, 40)
    emitDownload(entry)
    return { ok: true, path: file }
  } catch (error) {
    return { ok: false, error: String(error?.message || error) }
  }
})

/* 清除当前浏览器分区的本地存储（缓存、Cookie、localStorage 等）。 */
ipcMain.handle('browser:clear-data', async () => {
  if (!browserView) return { ok: false, error: '自带浏览器未打开' }
  try {
    await browserView.webContents.session.clearStorageData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error?.message || error) }
  }
})

ipcMain.on('browser:find', (_event, payload) => {
  if (!browserView) return
  const q = String(payload?.text || '').trim()
  if (!q) { browserView.webContents.stopFindInPage('clear'); return }
  const forward = payload?.forward !== false
  browserView.webContents.findInPage(q, { findNext: true, forward })
})

ipcMain.on('browser:find-stop', () => {
  if (browserView) browserView.webContents.stopFindInPage('clear')
})

/* 设备视口：切换移动 / 桌面 UA；视图尺寸仍跟随右侧面板槽位。 */
ipcMain.on('browser:viewport', (_event, preset) => {
  if (!browserView) return
  const ua = preset === 'mobile'
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : ''
  browserView.webContents.setUserAgent(ua)
})

ipcMain.on('browser:close', () => closeBrowserView())

/* 由渲染进程按服务端审核清单推送应加载的扩展目录；路径限定内置扩展根，不存在 manifest 则跳过。 */
ipcMain.on('browser:load-extensions', (_event, paths) => { syncBrowserExtensions(paths) })

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
  const x = Math.max(0, Math.round(Number(rect.x) || 0))
  const y = Math.max(0, Math.round(Number(rect.y) || 0))
  const width = Math.max(1, Math.round(Number(rect.width) || 1))
  const height = Math.max(1, Math.round(Number(rect.height) || 1))
  appBounds = { x, y, width, height }
  const active = appViews.get(activeAppId)
  if (active) active.view.setBounds(appBounds)
})

ipcMain.on('browser:open-external', (_event, url) => {
  if (/^https?:\/\//i.test(String(url || ''))) shell.openExternal(String(url))
})

ipcMain.handle('browser:page-info', () => {
  if (!browserView) return { ok: false, error: '自带浏览器未打开' }
  try {
    const wc = browserView.webContents
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

ipcMain.handle('browser:page-text', async () => {
  if (!browserView) return { ok: false, error: '自带浏览器未打开' }
  try {
    const text = await browserView.webContents.executeJavaScript(
      `(() => { try { return String(document.body ? document.body.innerText : '').slice(0, 20000) } catch (_) { return '' } })()`,
      true,
    )
    return { ok: true, text: String(text || '') }
  } catch (error) {
    return { ok: false, error: String(error?.message || error) }
  }
})

ipcMain.handle('browser:downloads', () => {
  const live = browserDownloads.map((entry) => ({ ...entry }))
  const paths = new Set(live.map((entry) => String(entry.path || '').toLowerCase()))
  const disk = diskDownloads().filter((entry) => !paths.has(entry.path.toLowerCase()))
  return { ok: true, items: [...live, ...disk].slice(0, 40) }
})

ipcMain.on('browser:download-open', (_event, target) => {
  const file = String(target || '')
  const entry = browserDownloads.find((item) => item.path === file)
    || diskDownloads().find((item) => item.path === file)
  if (!entry || entry.state !== 'completed') return
  shell.openPath(entry.path).then((err) => { if (err) shell.showItemInFolder(entry.path) }).catch(() => {})
})

ipcMain.on('browser:download-reveal', (_event, target) => {
  const file = String(target || '')
  const entry = browserDownloads.find((item) => item.path === file)
    || diskDownloads().find((item) => item.path === file)
  if (entry) shell.showItemInFolder(entry.path)
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
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    app.on('web-contents-created', (_event, contents) => installBridge(contents))

    try {
      /* 已经有健康的本机服务就复用，不再另起一套：两套服务会同时写同一个 SQLite。 */
      const pidInfo = readServerPidInfo()
      const holderAlive = Boolean(pidInfo && isProcessAlive(pidInfo.pid))
      if (await probeHealth(PREFERRED_PORT)) {
        serverPort = PREFERRED_PORT
        console.log(`[jg-server] 复用已在运行的本机服务 http://127.0.0.1:${serverPort}`)
      } else if (holderAlive) {
        /* 进程还活着但暂时没响应（长任务、正在启动）：等它恢复，不能再起第二套。 */
        serverPort = PREFERRED_PORT
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
