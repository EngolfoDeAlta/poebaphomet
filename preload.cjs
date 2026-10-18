// PoeBaphomet — ponte segura entre o processo principal e a interface
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('poebaphomet', {
  detectGame: () => ipcRenderer.invoke('detect-game'),
  validateGame: (p) => ipcRenderer.invoke('validate-game', p),
  backupExists: (p) => ipcRenderer.invoke('backup-exists', p),
  getColorMods: () => ipcRenderer.invoke('get-colormods'),
  browseGame: () => ipcRenderer.invoke('browse-game'),
  apply: (gamePath, config) => ipcRenderer.invoke('apply', gamePath, config),
  restore: (gamePath) => ipcRenderer.invoke('restore', gamePath),
  onProgress: (cb) => ipcRenderer.on('progress', (_e, data) => cb(data)),
});
