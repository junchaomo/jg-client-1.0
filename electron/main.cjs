const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const http = require('http')
const net = require('net')

const ROOT = path.join(__dirname, '..')
const ENTRY = path.join(ROOT, 'server.mjs')

// 与旧客户端彻底隔离，避免沿用旧客户端的登录态、缓存与窗口状态。
app.setName('jg-client-1.0')
app.setPath('userData', path.join(app.getPath('appData'), 'jg-client-1.0'))
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
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
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
