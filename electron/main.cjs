const { app, BrowserWindow, Menu, ipcMain, shell, dialog, WebContentsView } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const http = require('http')
const net = require('net')

const ROOT = path.join(__dirname, '..')
const ENTRY = path.join(ROOT, 'server.mjs')

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
    '.menubar button,.menubar .mb-winbtn,.menubar input,.menubar a{-webkit-app-region:no-drag}'
  ].join('')
  document.head.appendChild(style)

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('.mb-winbtn') : null
    if (!target || !window.jgClient) return
    const title = target.getAttribute('title')
    if (title === '最小化') { event.preventDefault(); event.stopPropagation(); window.jgClient.minimize() }
    else if (title === '最大化') { event.preventDefault(); event.stopPropagation(); window.jgClient.toggleMaximize() }
    else if (title === '关闭') { event.preventDefault(); event.stopPropagation(); window.jgClient.close() }
  }, true)
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

function startServer(port) {
  const nodeExe = resolveNodeExe()
  const env = { ...process.env, PORT: String(port) }
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

function installBridge(contents) {
  contents.on('did-finish-load', () => {
    contents.executeJavaScript(BRIDGE, true).catch(() => {})
  })
}

let browserDownloads = []
let browserDownloadSeq = 0
let browserSessionHooked = false
const BROWSER_PARTITION = 'persist:jg-cloud-browser'

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
      if (/^https?:\/\//i.test(url)) shell.openExternal(url)
      return { action: 'deny' }
    })
    browserView.webContents.on('will-navigate', (event, url) => {
      if (!/^https?:\/\//i.test(url)) event.preventDefault()
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

function closeBrowserView() {
  if (!browserView || !mainWindow) return
  if (browserAttached) {
    try { mainWindow.contentView.removeChildView(browserView) } catch (_) {}
    browserAttached = false
  }
  try { browserView.webContents.close() } catch (_) {}
  browserView = null
  browserUrl = ''
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

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
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
          frame: false,
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

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.on('window:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
})

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

ipcMain.on('browser:open', (_event, url) => {
  if (!/^https?:\/\//i.test(String(url || ''))) return
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

ipcMain.on('browser:close', () => closeBrowserView())

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
      serverPort = await getFreePort()
      startServer(serverPort)
      await waitForServer(serverPort)
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
