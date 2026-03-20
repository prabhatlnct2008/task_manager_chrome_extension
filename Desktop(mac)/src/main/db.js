const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'anchorflow.db');
}

function init() {
  if (db) return db;

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate();
  return db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      taskTitle TEXT NOT NULL,
      note TEXT DEFAULT '',
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      frequencyMinutes INTEGER NOT NULL,
      durationMinutes INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      nextCheckinAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      promptTaskTitle TEXT,
      userResponse TEXT,
      responseType TEXT,
      classification TEXT,
      consequence TEXT,
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sourceContext TEXT DEFAULT '',
      sessionId TEXT,
      createdAt INTEGER NOT NULL,
      completedAt INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS planner_history (
      id TEXT PRIMARY KEY,
      rawInput TEXT NOT NULL,
      parsedOutput TEXT,
      method TEXT,
      createdAt INTEGER NOT NULL
    );
  `);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

// --- Settings ---

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, v);
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

// --- Sessions ---

function createSession(session) {
  db.prepare(`
    INSERT INTO sessions (id, taskTitle, note, startedAt, endedAt, frequencyMinutes, durationMinutes, status, nextCheckinAt)
    VALUES (@id, @taskTitle, @note, @startedAt, @endedAt, @frequencyMinutes, @durationMinutes, @status, @nextCheckinAt)
  `).run(session);
  return session;
}

function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null;
}

function getActiveSession() {
  return db.prepare("SELECT * FROM sessions WHERE status = 'active' LIMIT 1").get() || null;
}

function updateSession(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE sessions SET ${fields} WHERE id = @id`).run({ id, ...updates });
}

function getAllSessions() {
  return db.prepare('SELECT * FROM sessions ORDER BY startedAt DESC').all();
}

// --- Checkins ---

function createCheckin(record) {
  db.prepare(`
    INSERT INTO checkins (id, sessionId, timestamp, promptTaskTitle, userResponse, responseType, classification, consequence)
    VALUES (@id, @sessionId, @timestamp, @promptTaskTitle, @userResponse, @responseType, @classification, @consequence)
  `).run(record);
  return record;
}

function getCheckinsBySession(sessionId) {
  return db.prepare('SELECT * FROM checkins WHERE sessionId = ? ORDER BY timestamp ASC').all(sessionId);
}

function getAllCheckins() {
  return db.prepare('SELECT * FROM checkins ORDER BY timestamp DESC').all();
}

function getCheckinStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM checkins').get().count;
  const aligned = db.prepare("SELECT COUNT(*) as count FROM checkins WHERE classification = 'aligned'").get().count;
  const slightlyOff = db.prepare("SELECT COUNT(*) as count FROM checkins WHERE classification = 'slightly_off'").get().count;
  const offTrack = db.prepare("SELECT COUNT(*) as count FROM checkins WHERE classification = 'off_track'").get().count;
  const breakCount = db.prepare("SELECT COUNT(*) as count FROM checkins WHERE classification = 'break'").get().count;
  return { total, aligned, slightlyOff, offTrack, break: breakCount };
}

function getSessionStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  const completed = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'ended'").get().count;
  const avgDuration = db.prepare(
    "SELECT AVG(endedAt - startedAt) as avg FROM sessions WHERE status = 'ended' AND endedAt IS NOT NULL"
  ).get().avg;
  return { total, completed, avgDurationMs: avgDuration || 0 };
}

// --- Tasks ---

function createTask(task) {
  db.prepare(`
    INSERT INTO tasks (id, title, sourceContext, sessionId, createdAt, completedAt, status)
    VALUES (@id, @title, @sourceContext, @sessionId, @createdAt, @completedAt, @status)
  `).run(task);
  return task;
}

function getTasks(sessionId) {
  if (sessionId) {
    return db.prepare('SELECT * FROM tasks WHERE sessionId = ? ORDER BY createdAt ASC').all(sessionId);
  }
  return db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
}

function updateTask(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE tasks SET ${fields} WHERE id = @id`).run({ id, ...updates });
}

// --- Planner History ---

function savePlannerHistory(record) {
  db.prepare(`
    INSERT INTO planner_history (id, rawInput, parsedOutput, method, createdAt)
    VALUES (@id, @rawInput, @parsedOutput, @method, @createdAt)
  `).run(record);
}

module.exports = {
  init, close, getDbPath,
  getSetting, setSetting, getAllSettings,
  createSession, getSession, getActiveSession, updateSession, getAllSessions,
  createCheckin, getCheckinsBySession, getAllCheckins, getCheckinStats, getSessionStats,
  createTask, getTasks, updateTask,
  savePlannerHistory
};
