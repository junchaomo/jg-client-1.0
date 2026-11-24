const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')

function loadMain(temp) {
  const handlers = new Map()
  const views = []
  const sessions = []
  class FakeWebContentsView {
    constructor(options) {
      this.options = options
      this.visible = false
      this.bounds = null
      this.loadCalls = []
      const listeners = new Map()
      const session = {
        handlers: new Map(),
        loaded: [],
        removed: [],
        on(name, fn) { this.handlers.set(name, fn) },
        setPermissionRequestHandler(fn) { this.permissionRequest = fn },
        setPermissionCheckHandler(fn) { this.permissionCheck = fn },
        setDevicePermissionHandler(fn) { this.devicePermission = fn },
        async loadExtension(abs) { this.loaded.push(abs); return { id: `ext-${this.loaded.length}` } },
        removeExtension(id) { this.removed.push(id) },
      }
      sessions.push(session)
      this.webContents = {
        session,
        destroyed: false,
        url: '',
        on(name, fn) { listeners.set(name, fn) },
        once(name, fn) { listeners.set(name, fn) },
        emit(name, ...args) { return listeners.get(name)?.(...args) },
        setWindowOpenHandler(fn) { this.windowOpenHandler = fn },
        loadURL: async (url) => { this.loadCalls.push(url); this.webContents.url = url },
        getURL() { return this.url },
        getTitle() { return `title:${this.url}` },
        canGoBack() { return false },
        canGoForward() { return false },
        isDestroyed() { return this.destroyed },
        close() { this.destroyed = true; this.webContents.emit('destroyed') },
        executeJavaScript: async (source) => { this.webContents.executed = source; return true },
        send: (channel, payload) => {
          if (channel !== 'browser:password-fill') return
          this.webContents.fillPayload = payload
          setImmediate(() => handlers.get('browser:password-filled')({ sender: this.webContents }, { requestId: payload.requestId, ok: true }))
        },
        reload() { this.reloaded = true },
      }
      views.push(this)
    }
    setBackgroundColor() {}
    setVisible(value) { this.visible = value }
    setBounds(value) { this.bounds = value }
  }
  const children = new Set()
  const sentMessages = []
  const mainWindow = {
    isDestroyed: () => false,
    contentView: { addChildView: (v) => children.add(v), removeChildView: (v) => children.delete(v) },
    webContents: { session: {}, send(...args) { sentMessages.push(args) }, setZoomFactor() {}, getZoomFactor: () => 1 },
  }
  const shellCalls = []
  const electron = {
    app: {
      setName() {}, setPath() {}, setAppUserModelId() {}, requestSingleInstanceLock: () => false,
      quit() {}, whenReady: () => new Promise(() => {}), on() {}, getPath: () => temp,
    },
    BrowserWindow: function () {}, Menu: { setApplicationMenu() {} },
    ipcMain: { on: (name, fn) => handlers.set(name, fn), handle: (name, fn) => handlers.set(name, fn) },
    shell: { openPath: async (value) => { shellCalls.push(['open', value]); return '' }, showItemInFolder: (value) => shellCalls.push(['reveal', value]) },
    dialog: {
      response: 0, savePath: '',
      async showMessageBox() { return { response: this.response } },
      async showSaveDialog(_win, options) { return this.savePath === null ? { canceled: true } : { canceled: false, filePath: this.savePath || options.defaultPath } },
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
      decryptString: (value) => Buffer.from(value.toString().replace(/^encrypted:/, ''), 'base64').toString(),
    },
    WebContentsView: FakeWebContentsView, screen: {},
  }
  const filename = path.join(__dirname, '..', 'electron', 'main.cjs')
  let source = fs.readFileSync(filename, 'utf8')
  source = source.replace("const EXT_ROOT = path.join(ROOT, 'extensions')", "const EXT_ROOT = process.env.JG_TEST_EXT_ROOT")
  source += '\nglobalThis.__browserTest = { setMainWindow: (value) => { mainWindow = value }, browserViews, showBrowserView, closeBrowserView, closeAllBrowserViews, approvedBrowserExtensions }\n'
  const context = {
    require: (id) => id === 'electron' ? electron : id.startsWith('.') ? require(path.join(path.dirname(filename), id)) : require(id),
    __dirname: path.dirname(filename), __filename: filename,
    process: { ...process, env: { ...process.env, JG_DATA_DIR: temp, JG_TEST_EXT_ROOT: path.join(temp, 'extensions') } },
    console, URL, Buffer, setTimeout, clearTimeout, setInterval, clearInterval,
  }
  context.globalThis = context
  vm.runInNewContext(source, context, { filename })
  context.__browserTest.setMainWindow(mainWindow)
  return { handlers, views, sessions, children, mainWindow, context, shellCalls, electron, sentMessages }
}

test('网页标签各有独立视图，切换不串页，单标签关闭不影响其他标签', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jg-browser-tabs-'))
  const { handlers, views, context } = loadMain(temp)
  const open = handlers.get('browser:open')
  open({}, { tabId: 'web-a', url: 'https://example.com/a' })
  open({}, { tabId: 'web-b', url: 'https://example.com/b' })
  assert.equal(views.length, 2)
  assert.equal(views[0].visible, false)
  assert.equal(views[1].visible, true)
  assert.deepEqual(views[0].loadCalls, ['https://example.com/a'])
  assert.deepEqual(views[1].loadCalls, ['https://example.com/b'])

  open({}, { tabId: 'web-a', url: 'https://example.com/a' })
  assert.equal(views.length, 2)
  assert.equal(views[0].visible, true)
  assert.equal(views[1].visible, false)
  assert.equal(views[0].loadCalls.length, 1, '切回同地址标签不应重新加载')

  handlers.get('browser:close')({}, 'web-a')
  assert.equal(views[0].webContents.destroyed, true)
  assert.equal(views[1].webContents.destroyed, false)
  assert.equal(context.__browserTest.browserViews.has('web-b'), true)
  handlers.get('browser:close-all')()
  assert.equal(views[1].webContents.destroyed, true)
})

test('下载可选保存位置，敏感文件由用户确认，文件工具只认真实下载记录', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jg-browser-policy-'))
  const { handlers, sessions, shellCalls, electron } = loadMain(temp)
  handlers.get('browser:open')({}, { tabId: 'web-a', url: 'https://example.com/' })
  const hook = sessions[0].handlers.get('will-download')
  let dangerousPath = ''
  let cancelled = false
  await hook({ preventDefault() {} }, {
    getFilename: () => 'payload.exe', getURL: () => 'https://example.com/payload.exe',
    setSavePath: (value) => { dangerousPath = value }, cancel: () => { cancelled = true },
  })
  assert.equal(cancelled, true)
  assert.equal(dangerousPath, '', '用户未确认敏感文件前不能设置保存路径')

  electron.dialog.response = 1
  await hook({ preventDefault() {} }, {
    getFilename: () => 'payload.exe', getURL: () => 'https://example.com/payload.exe',
    setSavePath: (value) => { dangerousPath = value }, cancel() {}, getTotalBytes: () => 0,
    on() {}, once() {},
  })
  assert.ok(dangerousPath.endsWith('payload.exe'), '用户明确确认后允许选择敏感文件保存位置')

  let safePath = ''
  const customPath = path.join(temp, '用户选择', 'report.pdf')
  electron.dialog.savePath = customPath
  const item = {
    getFilename: () => 'report.pdf', getURL: () => 'https://example.com/report.pdf',
    setSavePath: (value) => { safePath = value }, cancel() {}, getTotalBytes: () => 10, getReceivedBytes: () => 10,
    on() {}, once(name, fn) { if (name === 'done') this.done = fn },
  }
  await hook({ preventDefault() {} }, item)
  assert.equal(safePath, customPath)
  item.done({}, 'completed')
  fs.mkdirSync(path.dirname(customPath), { recursive: true })
  fs.writeFileSync(customPath, 'report')

  for (const channel of ['browser:downloads', 'browser:download-open', 'browser:download-reveal', 'browser:print', 'browser:screenshot', 'browser:set-zoom', 'browser:find', 'browser:clear-data', 'browser:password-submit', 'browser:password-fill']) {
    assert.equal(handlers.has(channel), true, `${channel} 应提供受控能力`)
  }
  handlers.get('browser:download-open')({}, customPath)
  handlers.get('browser:download-open')({}, path.join(temp, 'outside.pdf'))
  handlers.get('browser:download-reveal')({}, path.join(temp, 'outside.pdf'))
  assert.deepEqual(shellCalls, [['open', customPath]], '只能打开真实下载记录，任意路径仍被拒绝')
  assert.equal(sessions[0].permissionCheck(), false)
})

test('网站密码系统加密落盘、元数据无明文且严格按当前 HTTPS 源填充', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jg-browser-password-'))
  const { handlers, views, electron, sentMessages } = loadMain(temp)
  handlers.get('browser:open')({}, { tabId: 'web-a', url: 'https://example.com/login' })
  const wc = views[0].webContents
  handlers.get('browser:password-submit')({ sender: wc }, { origin: 'http://example.com', username: 'u', password: 'not-saved' })
  assert.equal(fs.existsSync(path.join(temp, 'cloud-passwords-v1.json')), false, 'HTTP 网站不能保存密码')

  const saved = handlers.get('browser:password-submit')({ sender: wc }, { origin: 'https://example.com', username: 'alice', password: 'Secret-Pass-123' })
  assert.equal(saved.ok, true)
  const sent = sentMessages.find(([channel]) => channel === 'browser:password-saved')
  assert.ok(sent)
  assert.equal(JSON.stringify(sent).includes('Secret-Pass-123'), false, '自动保存结果不能携带明文密码')
  const storeFile = path.join(temp, 'cloud-passwords-v1.json')
  const encrypted = fs.readFileSync(storeFile, 'utf8')
  assert.equal(encrypted.includes('Secret-Pass-123'), false)
  assert.notEqual(JSON.parse(encrypted).items[0].password, Buffer.from('Secret-Pass-123').toString('base64'), '不能只做可逆 Base64 编码')

  const updated = handlers.get('browser:password-submit')({ sender: wc }, { origin: 'https://example.com', username: 'alice', password: 'Updated-Pass-456' })
  assert.equal(updated.ok, true)
  assert.equal(updated.item.id, saved.item.id, '同网站同账号应更新原记录')
  const list = await handlers.get('browser:password-list')()
  assert.equal(list.items.length, 1)
  assert.equal(JSON.stringify(list).includes('Updated-Pass-456'), false)
  assert.equal(JSON.stringify(list).includes('password'), false)
  assert.equal(fs.readFileSync(storeFile, 'utf8').includes('Updated-Pass-456'), false)
  const filled = await handlers.get('browser:password-fill')({}, { tabId: 'web-a', id: list.items[0].id })
  assert.equal(filled.ok, true)
  assert.equal(wc.fillPayload.password, 'Updated-Pass-456', '明文只应发送到目标网页隔离预加载脚本')

  wc.url = 'https://evil.example/login'
  wc.fillPayload = null
  const crossOrigin = await handlers.get('browser:password-fill')({}, { tabId: 'web-a', id: list.items[0].id })
  assert.equal(crossOrigin.ok, false)
  assert.equal(wc.fillPayload, null, '跨源时不能发送填充内容')
  const removed = await handlers.get('browser:password-delete')({}, list.items[0].id)
  assert.equal(removed.ok, true)
  assert.equal(electron.safeStorage.isEncryptionAvailable(), true)
})

test('扩展只加载管理中心审核注册表内的 id，忽略路径伪造与未审核项', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jg-browser-ext-'))
  const extRoot = path.join(temp, 'extensions')
  fs.mkdirSync(path.join(extRoot, 'approved'), { recursive: true })
  fs.mkdirSync(path.join(extRoot, 'unreviewed'), { recursive: true })
  fs.writeFileSync(path.join(extRoot, 'approved', 'manifest.json'), '{}')
  fs.writeFileSync(path.join(extRoot, 'unreviewed', 'manifest.json'), '{}')
  fs.writeFileSync(path.join(temp, 'browser-extension-review.json'), JSON.stringify({ items: [
    { id: 'approved', extPath: 'approved', status: 'listed', reviewedBy: 'admin', reviewedAt: '2026-11-24T00:00:00Z' },
    { id: 'unreviewed', extPath: 'unreviewed', status: 'pending', reviewedBy: '', reviewedAt: '' },
  ] }))
  const { handlers, sessions } = loadMain(temp)
  handlers.get('browser:open')({}, { tabId: 'web-a', url: 'https://example.com/' })
  handlers.get('browser:load-extensions')({}, ['approved', 'unreviewed', 'C:\\fake'])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(sessions[0].loaded.length, 1)
  assert.equal(sessions[0].loaded[0], path.join(extRoot, 'approved'))
})
