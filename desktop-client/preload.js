const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pair: (serverUrl, code) => ipcRenderer.invoke('pair-request', { serverUrl, code }),
  onShowDrop: (callback) => {
    ipcRenderer.on('show-drop', (event, payload) => callback(payload));
  },
});
