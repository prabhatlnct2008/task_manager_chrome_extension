const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');
const planner = require('./planner');
const openai = require('./openai');

let mainWindow = null;
let checkinWindow = null;
let checkinTimer = null;
let durationTimer = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 750,
    minWidth: 520,
    minHeight: 600,
    resizable: true,
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

  const session = db.getActiveSession();
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

  checkinWindow.setAlwaysOnTop(true, 'screen-saver');
  checkinWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  checkinWindow.loadFile(path.join(__dirname, '..', 'renderer', 'checkin.html'));
  checkinWindow.center();

  checkinWindow.once('ready-to-show', () => {
    checkinWindow.show();
    checkinWindow.focus();
  });

  checkinWindow.on('blur', () => {
    if (checkinWindow && !checkinWindow.isDestroyed()) {
      checkinWindow.focus();
    }
  });

  checkinWindow.on('closed', () => {
    checkinWindow = null;
  });
}

// --- Helpers ---

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Session management ---

function startSession({ taskTitle, note, frequencyMinutes, durationMinutes }) {
  const existing = db.getActiveSession();
  if (existing) endSession();

  const now = Date.now();
  const session = db.createSession({
    id: generateId(),
    taskTitle,
    note: note || '',
    startedAt: now,
    endedAt: null,
    frequencyMinutes,
    durationMinutes: durationMinutes || null,
    status: 'active',
    nextCheckinAt: now + frequencyMinutes * 60 * 1000
  });

  scheduleCheckin(frequencyMinutes);
  scheduleDurationEnd(session);
  notifyMainWindow();
  return session;
}

function endSession() {
  const session = db.getActiveSession();
  if (!session) return;

  db.updateSession(session.id, {
    status: 'ended',
    endedAt: Date.now(),
    nextCheckinAt: null
  });
  clearCheckinTimer();
  clearDurationTimer();

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
  durationTimer = setTimeout(() => endSession(), remaining);
}

function clearDurationTimer() {
  if (durationTimer) { clearTimeout(durationTimer); durationTimer = null; }
}

// --- Timer scheduling ---

function scheduleCheckin(minutes) {
  clearCheckinTimer();
  const ms = minutes * 60 * 1000;

  const session = db.getActiveSession();
  if (session) {
    db.updateSession(session.id, { nextCheckinAt: Date.now() + ms });
  }

  checkinTimer = setTimeout(() => {
    const active = db.getActiveSession();
    if (active && active.status === 'active') {
      createCheckinWindow();
    }
  }, ms);
}

function clearCheckinTimer() {
  if (checkinTimer) { clearTimeout(checkinTimer); checkinTimer = null; }
}

// --- Check-in response handling ---

function handleCheckinResponse({ userResponse, responseType, classification }) {
  const session = db.getActiveSession();
  if (!session) return;

  let consequence = 'none';
  let nextInterval = session.frequencyMinutes;

  if (classification === 'off_track') {
    consequence = 'shorter_interval';
    nextInterval = 1;
  } else if (classification === 'break') {
    consequence = 'snooze';
    nextInterval = 5;
  }

  const record = db.createCheckin({
    id: generateId(),
    sessionId: session.id,
    timestamp: Date.now(),
    promptTaskTitle: session.taskTitle,
    userResponse,
    responseType,
    classification,
    consequence
  });

  // Let the renderer show feedback before closing the modal
  const delay = classification === 'off_track' ? 3000 : 2000;
  setTimeout(() => {
    if (checkinWindow && !checkinWindow.isDestroyed()) {
      checkinWindow.destroy();
      checkinWindow = null;
    }
  }, delay);

  // Schedule next check-in first so session state has updated nextCheckinAt
  scheduleCheckin(nextInterval);

  // Notify after the next interval has been written back to session state
  notifyMainWindow();
  return record;
}

function notifyMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const session = db.getActiveSession();
    const checkins = session ? db.getCheckinsBySession(session.id) : [];
    mainWindow.webContents.send('state-update', { session, checkins });
  }
}

// --- IPC: Session ---

ipcMain.handle('start-session', (_event, data) => startSession(data));
ipcMain.handle('end-session', () => { endSession(); return true; });
ipcMain.handle('get-state', () => {
  const session = db.getActiveSession();
  const checkins = session ? db.getCheckinsBySession(session.id) : [];
  return { session, checkins };
});
ipcMain.handle('get-active-session', () => db.getActiveSession());
ipcMain.handle('checkin-response', (_event, data) => handleCheckinResponse(data));

// --- IPC: Settings ---

ipcMain.handle('get-settings', () => db.getAllSettings());

ipcMain.handle('save-settings', (_event, settings) => {
  for (const [key, value] of Object.entries(settings)) {
    db.setSetting(key, value);
  }
  return true;
});

ipcMain.handle('test-openai-key', async (_event, apiKey) => {
  return openai.testApiKey(apiKey);
});

// --- IPC: Planner ---

ipcMain.handle('parse-planner-text', async (_event, rawText) => {
  return planner.parsePlannerText(rawText);
});

ipcMain.handle('create-tasks-from-planner', (_event, tasks) => {
  const session = db.getActiveSession();
  const sessionId = session ? session.id : null;
  const created = [];

  for (const t of tasks) {
    const task = db.createTask({
      id: generateId(),
      title: t.title,
      sourceContext: t.sourceContext || '',
      sessionId,
      createdAt: Date.now(),
      completedAt: null,
      status: 'pending'
    });
    created.push(task);
  }

  return created;
});

ipcMain.handle('get-tasks', (_event, sessionId) => db.getTasks(sessionId || null));

ipcMain.handle('update-task', (_event, { id, updates }) => {
  db.updateTask(id, updates);
  return true;
});

// --- IPC: Stats & History ---

ipcMain.handle('get-stats', () => {
  const sessionStats = db.getSessionStats();
  const checkinStats = db.getCheckinStats();
  return { sessions: sessionStats, checkins: checkinStats };
});

ipcMain.handle('get-history', () => {
  const sessions = db.getAllSessions();
  const checkins = db.getAllCheckins();
  return { sessions, checkins };
});

// --- App lifecycle ---

app.whenReady().then(() => {
  db.init();
  createMainWindow();

  // Restore timers if session was active
  const session = db.getActiveSession();
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

app.on('will-quit', () => {
  db.close();
});
