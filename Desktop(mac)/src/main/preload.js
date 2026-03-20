const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startSession: (data) => ipcRenderer.invoke('start-session', data),
  endSession: () => ipcRenderer.invoke('end-session'),
  getState: () => ipcRenderer.invoke('get-state'),
  getActiveSession: () => ipcRenderer.invoke('get-active-session'),
  checkinResponse: (data) => ipcRenderer.invoke('checkin-response', data),
  onStateUpdate: (callback) => {
    ipcRenderer.on('state-update', (_event, data) => callback(data));
  }
});
