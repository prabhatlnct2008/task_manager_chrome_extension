const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store').default;

const store = new Store({
  defaults: {
    sessions: [],
    checkins: [],
    activeSessionId: null
  }
});

let mainWindow = null;
let checkinWindow = null;
let checkinTimer = null;
let durationTimer = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 680,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createCheckinWindow() {
  if (checkinWindow && !checkinWindow.isDestroyed()) {
    checkinWindow.focus();
    return;
  }

  const session = getActiveSession();
  if (!session) return;

  checkinWindow = new BrowserWindow({
    width: 460,
    height: 420,
    resizable: false,
    minimizable: false,
    closable: false,
    fullscreenable: false,
    skipTaskbar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Use 'screen-saver' level to float above fullscreen apps on macOS
  checkinWindow.setAlwaysOnTop(true, 'screen-saver');
  checkinWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  checkinWindow.loadFile(path.join(__dirname, '..', 'renderer', 'checkin.html'));
  checkinWindow.center();

  // Aggressively take focus once content is ready
  checkinWindow.once('ready-to-show', () => {
    checkinWindow.show();
    checkinWindow.focus();
  });

  // Re-focus if user tries to switch away while modal is open
  checkinWindow.on('blur', () => {
    if (checkinWindow && !checkinWindow.isDestroyed()) {
      checkinWindow.focus();
    }
  });

  checkinWindow.on('closed', () => {
    checkinWindow = null;
  });
}

// --- Session management ---

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getActiveSession() {
  const id = store.get('activeSessionId');
  if (!id) return null;
  const sessions = store.get('sessions');
  return sessions.find(s => s.id === id) || null;
}

function updateSession(id, updates) {
  const sessions = store.get('sessions');
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...updates };
  store.set('sessions', sessions);
}

function startSession({ taskTitle, note, frequencyMinutes, durationMinutes }) {
  // End any existing session
  const existing = getActiveSession();
  if (existing) endSession();

  const now = Date.now();
  const session = {
    id: generateId(),
    taskTitle,
    note: note || '',
    startedAt: now,
    endedAt: null,
    frequencyMinutes,
    durationMinutes: durationMinutes || null,
    status: 'active',
    nextCheckinAt: now + frequencyMinutes * 60 * 1000
  };

  const sessions = store.get('sessions');
  sessions.push(session);
  store.set('sessions', sessions);
  store.set('activeSessionId', session.id);

  scheduleCheckin(frequencyMinutes);
  scheduleDurationEnd(session);
  notifyMainWindow();
  return session;
}

function endSession() {
  const session = getActiveSession();
  if (!session) return;

  updateSession(session.id, {
    status: 'ended',
    endedAt: Date.now(),
    nextCheckinAt: null
  });
  store.set('activeSessionId', null);
  clearCheckinTimer();
  clearDurationTimer();

  // Close any open check-in modal
  if (checkinWindow && !checkinWindow.isDestroyed()) {
    checkinWindow.destroy();
    checkinWindow = null;
  }

  notifyMainWindow();
}

function scheduleDurationEnd(session) {
  clearDurationTimer();
  if (!session.durationMinutes) return;
  const remaining = (session.startedAt + session.durationMinutes * 60 * 1000) - Date.now();
  if (remaining <= 0) {
    endSession();
    return;
  }
  durationTimer = setTimeout(() => {
    endSession();
  }, remaining);
}

function clearDurationTimer() {
  if (durationTimer) {
    clearTimeout(durationTimer);
    durationTimer = null;
  }
}

// --- Timer scheduling ---

function scheduleCheckin(minutes) {
  clearCheckinTimer();
  const ms = minutes * 60 * 1000;

  const session = getActiveSession();
  if (session) {
    updateSession(session.id, { nextCheckinAt: Date.now() + ms });
  }

  checkinTimer = setTimeout(() => {
    const active = getActiveSession();
    if (active && active.status === 'active') {
      createCheckinWindow();
    }
  }, ms);
}

function clearCheckinTimer() {
  if (checkinTimer) {
    clearTimeout(checkinTimer);
    checkinTimer = null;
  }
}

// --- Check-in response handling ---

function handleCheckinResponse({ userResponse, responseType, classification }) {
  const session = getActiveSession();
  if (!session) return;

  let consequence = 'none';
  let nextInterval = session.frequencyMinutes;

  if (classification === 'off_track') {
    consequence = 'shorter_interval';
    nextInterval = 1; // 1 minute for off-track
  } else if (classification === 'break') {
    consequence = 'snooze';
    nextInterval = 5; // 5 minute break
  }

  const record = {
    id: generateId(),
    sessionId: session.id,
    timestamp: Date.now(),
    promptTaskTitle: session.taskTitle,
    userResponse,
    responseType,
    classification,
    consequence
  };

  const checkins = store.get('checkins');
  checkins.push(record);
  store.set('checkins', checkins);

  // Let the renderer show feedback before closing the modal
  const delay = classification === 'off_track' ? 3000 : 2000;
  setTimeout(() => {
    if (checkinWindow && !checkinWindow.isDestroyed()) {
      checkinWindow.destroy();
      checkinWindow = null;
    }
  }, delay);

  // Show feedback in main window
  notifyMainWindow();

  // Schedule next check-in
  scheduleCheckin(nextInterval);

  return record;
}

function notifyMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const session = getActiveSession();
    const checkins = store.get('checkins');
    mainWindow.webContents.send('state-update', { session, checkins });
  }
}

// --- IPC Handlers ---

ipcMain.handle('start-session', (_event, data) => {
  return startSession(data);
});

ipcMain.handle('end-session', () => {
  endSession();
  return true;
});

ipcMain.handle('get-state', () => {
  const session = getActiveSession();
  const checkins = store.get('checkins');
  return { session, checkins };
});

ipcMain.handle('get-active-session', () => {
  return getActiveSession();
});

ipcMain.handle('checkin-response', (_event, data) => {
  return handleCheckinResponse(data);
});

// --- App lifecycle ---

app.whenReady().then(() => {
  createMainWindow();

  // Restore timers if session was active
  const session = getActiveSession();
  if (session && session.status === 'active') {
    const remaining = session.nextCheckinAt - Date.now();
    if (remaining > 0) {
      scheduleCheckin(remaining / 60000);
    } else {
      createCheckinWindow();
    }
    scheduleDurationEnd(session);
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app alive in dock so it can be reactivated
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createMainWindow();
  }
});
