const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pair: (code) => ipcRenderer.invoke('pair-request', { code }),
  onShowDrop: (callback) => {
    ipcRenderer.on('show-drop', (event, payload) => callback(payload));
  },
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
});
