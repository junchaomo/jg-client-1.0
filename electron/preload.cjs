const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jgClient', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  onWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('window:state', handler)
    return () => ipcRenderer.removeListener('window:state', handler)
  },
  chooseFolder: (options = {}) => ipcRenderer.invoke('dialog:choose-folder', options),
  revealPath: (target) => ipcRenderer.invoke('shell:reveal-path', target),
  browser: {
    open: (url) => ipcRenderer.send('browser:open', url),
    bounds: (rect) => ipcRenderer.send('browser:bounds', rect),
    reload: () => ipcRenderer.send('browser:reload'),
    goBack: () => ipcRenderer.send('browser:go-back'),
    goForward: () => ipcRenderer.send('browser:go-forward'),
    setZoom: (factor) => ipcRenderer.send('browser:set-zoom', factor),
    zoomFactor: () => ipcRenderer.invoke('browser:zoom'),
    print: () => ipcRenderer.send('browser:print'),
    screenshot: () => ipcRenderer.invoke('browser:screenshot'),
    clearData: () => ipcRenderer.invoke('browser:clear-data'),
    find: (text, forward = true) => ipcRenderer.send('browser:find', { text, forward }),
    findStop: () => ipcRenderer.send('browser:find-stop'),
    viewport: (preset) => ipcRenderer.send('browser:viewport', preset),
    close: () => ipcRenderer.send('browser:close'),
    loadExtensions: (paths) => ipcRenderer.send('browser:load-extensions', Array.isArray(paths) ? paths : []),
    openExternal: (url) => ipcRenderer.send('browser:open-external', url),
    pageInfo: () => ipcRenderer.invoke('browser:page-info'),
    pageText: () => ipcRenderer.invoke('browser:page-text'),
    downloads: () => ipcRenderer.invoke('browser:downloads'),
    openDownload: (path) => ipcRenderer.send('browser:download-open', path),
    revealDownload: (path) => ipcRenderer.send('browser:download-reveal', path),
    onDownload: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, entry) => callback(entry)
      ipcRenderer.on('browser:download-state', handler)
      return () => ipcRenderer.removeListener('browser:download-state', handler)
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
    onFindResult: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const handler = (_event, result) => callback(result)
      ipcRenderer.on('browser:find-result', handler)
      return () => ipcRenderer.removeListener('browser:find-result', handler)
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
