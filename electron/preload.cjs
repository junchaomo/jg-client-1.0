const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jgClient', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  setTitleBarTheme: (mode) => ipcRenderer.send('window:titlebar-theme', { mode }),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  onWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('window:state', handler)
    return () => ipcRenderer.removeListener('window:state', handler)
  },
  chooseFolder: (options = {}) => ipcRenderer.invoke('dialog:choose-folder', options),
  clearCache: () => ipcRenderer.invoke('settings:clear-cache'),
  revealPath: (target) => ipcRenderer.invoke('shell:reveal-path', target),
  revealFile: (target) => ipcRenderer.invoke('shell:reveal-file', target),
  browser: {
    open: (tabId, url) => ipcRenderer.send('browser:open', { tabId, url }),
    activate: (tabId) => ipcRenderer.send('browser:activate', tabId),
    hide: () => ipcRenderer.send('browser:hide'),
    bounds: (tabId, rect) => ipcRenderer.send('browser:bounds', { tabId, rect }),
    reload: () => ipcRenderer.send('browser:reload'),
    goBack: () => ipcRenderer.send('browser:go-back'),
    goForward: () => ipcRenderer.send('browser:go-forward'),
    setZoom: (factor) => ipcRenderer.send('browser:set-zoom', factor),
    zoomFactor: () => ipcRenderer.invoke('browser:zoom'),
    print: () => ipcRenderer.send('browser:print'),
    screenshot: () => ipcRenderer.invoke('browser:screenshot'),
    clearData: () => ipcRenderer.invoke('browser:clear-data'),
    find: (text, forward = true) => ipcRenderer.send('browser:find', { text, forward }),
    downloads: () => ipcRenderer.invoke('browser:downloads'),
    openDownload: (path) => ipcRenderer.send('browser:download-open', path),
    revealDownload: (path) => ipcRenderer.send('browser:download-reveal', path),
    passwords: () => ipcRenderer.invoke('browser:password-list'),
    fillPassword: (tabId, id) => ipcRenderer.invoke('browser:password-fill', { tabId, id }),
    deletePassword: (id) => ipcRenderer.invoke('browser:password-delete', id),
    close: (tabId) => ipcRenderer.send('browser:close', tabId),
    closeAll: () => ipcRenderer.send('browser:close-all'),
    loadExtensions: (ids) => ipcRenderer.invoke('browser:load-extensions', Array.isArray(ids) ? ids : []),
    openExternal: (url) => ipcRenderer.send('browser:open-external', url),
    pageInfo: (tabId) => ipcRenderer.invoke('browser:page-info', tabId),
    pageText: (tabId) => ipcRenderer.invoke('browser:page-text', tabId),
    onDownload: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, entry) => callback(entry)
      ipcRenderer.on('browser:download-state', handler)
      return () => ipcRenderer.removeListener('browser:download-state', handler)
    },
    onFindResult: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, result) => callback(result)
      ipcRenderer.on('browser:find-result', handler)
      return () => ipcRenderer.removeListener('browser:find-result', handler)
    },
    onPasswordSaved: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, result) => callback(result)
      ipcRenderer.on('browser:password-saved', handler)
      return () => ipcRenderer.removeListener('browser:password-saved', handler)
    },
    onNavState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, state) => callback(state)
      ipcRenderer.on('browser:nav-state', handler)
      return () => ipcRenderer.removeListener('browser:nav-state', handler)
    },
    onNavError: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, err) => callback(err)
      ipcRenderer.on('browser:nav-error', handler)
      return () => ipcRenderer.removeListener('browser:nav-error', handler)
    },
    onNewWindow: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, payload) => callback(payload?.url)
      ipcRenderer.on('browser:new-window', handler)
      return () => ipcRenderer.removeListener('browser:new-window', handler)
    },
  },
  asApp: {
    open: (payload = {}) => ipcRenderer.send('app:open', payload),
    activate: (appId) => ipcRenderer.send('app:activate', appId),
    hide: () => ipcRenderer.send('app:hide'),
    close: (appId) => ipcRenderer.send('app:close', appId),
    bounds: (payload = {}) => ipcRenderer.send('app:bounds', payload),
    pageText: (appId) => ipcRenderer.invoke('app:page-text', appId),
    onTabState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, entry) => callback(entry)
      ipcRenderer.on('app:tab-state', handler)
      return () => ipcRenderer.removeListener('app:tab-state', handler)
    },
  },
})
