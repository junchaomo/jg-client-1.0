const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jgClient', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  chooseFolder: (options = {}) => ipcRenderer.invoke('dialog:choose-folder', options),
})
