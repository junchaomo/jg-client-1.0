const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jgClient', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  chooseFolder: (options = {}) => ipcRenderer.invoke('dialog:choose-folder', options),
  revealPath: (target) => ipcRenderer.invoke('shell:reveal-path', target),
  browser: {
    open: (url) => ipcRenderer.send('browser:open', url),
    bounds: (rect) => ipcRenderer.send('browser:bounds', rect),
    reload: () => ipcRenderer.send('browser:reload'),
    close: () => ipcRenderer.send('browser:close'),
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
  },
})
