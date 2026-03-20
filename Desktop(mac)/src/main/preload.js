const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Session
  startSession: (data) => ipcRenderer.invoke('start-session', data),
  endSession: () => ipcRenderer.invoke('end-session'),
  getState: () => ipcRenderer.invoke('get-state'),
  getActiveSession: () => ipcRenderer.invoke('get-active-session'),
  checkinResponse: (data) => ipcRenderer.invoke('checkin-response', data),
  onStateUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('state-update', handler);
    return () => ipcRenderer.removeListener('state-update', handler);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  testOpenaiKey: (key) => ipcRenderer.invoke('test-openai-key', key),

  // Planner
  parsePlannerText: (text) => ipcRenderer.invoke('parse-planner-text', text),
  createTasksFromPlanner: (tasks) => ipcRenderer.invoke('create-tasks-from-planner', tasks),
  getTasks: (sessionId) => ipcRenderer.invoke('get-tasks', sessionId),
  updateTask: (id, updates) => ipcRenderer.invoke('update-task', { id, updates }),

  // Stats & History
  getStats: () => ipcRenderer.invoke('get-stats'),
  getHistory: () => ipcRenderer.invoke('get-history')
});
