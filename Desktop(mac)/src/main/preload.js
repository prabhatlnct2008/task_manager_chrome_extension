const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startSession: (data) => ipcRenderer.invoke('start-session', data),
  endSession: () => ipcRenderer.invoke('end-session'),
  getState: () => ipcRenderer.invoke('get-state'),
  getActiveSession: () => ipcRenderer.invoke('get-active-session'),
  checkinResponse: (data) => ipcRenderer.invoke('checkin-response', data),
  onStateUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('state-update', handler);
    return () => ipcRenderer.removeListener('state-update', handler);
  }
});
