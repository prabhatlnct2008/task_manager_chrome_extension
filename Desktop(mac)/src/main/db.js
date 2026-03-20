const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;
let dbPath = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'anchorflow.db');
}

async function init() {
  if (db) return db;

  dbPath = getDbPath();

  const SQL = await initSqlJs();

  // Load existing DB file if it exists
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  migrate();
  save();
  return db;
}

function migrate() {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.run(`
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
    )
  `);
  db.run(`
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
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sourceContext TEXT DEFAULT '',
      sessionId TEXT,
      createdAt INTEGER NOT NULL,
      completedAt INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS planner_history (
      id TEXT PRIMARY KEY,
      rawInput TEXT NOT NULL,
      parsedOutput TEXT,
      method TEXT,
      createdAt INTEGER NOT NULL
    )
  `);
}

function save() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function close() {
  if (db) {
    save();
    db.close();
    db = null;
  }
}

// --- Query helpers ---

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

// --- Settings ---

function getSetting(key) {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, v]);
}

function getAllSettings() {
  const rows = queryAll('SELECT key, value FROM settings');
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

// --- Sessions ---

function createSession(session) {
  run(
    `INSERT INTO sessions (id, taskTitle, note, startedAt, endedAt, frequencyMinutes, durationMinutes, status, nextCheckinAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.taskTitle, session.note, session.startedAt, session.endedAt,
     session.frequencyMinutes, session.durationMinutes, session.status, session.nextCheckinAt]
  );
  return session;
}

function getSession(id) {
  return queryOne('SELECT * FROM sessions WHERE id = ?', [id]);
}

function getActiveSession() {
  return queryOne("SELECT * FROM sessions WHERE status = 'active' LIMIT 1");
}

function updateSession(id, updates) {
  const keys = Object.keys(updates);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => updates[k]);
  run(`UPDATE sessions SET ${sets} WHERE id = ?`, [...vals, id]);
}

function getAllSessions() {
  return queryAll('SELECT * FROM sessions ORDER BY startedAt DESC');
}

// --- Checkins ---

function createCheckin(record) {
  run(
    `INSERT INTO checkins (id, sessionId, timestamp, promptTaskTitle, userResponse, responseType, classification, consequence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.sessionId, record.timestamp, record.promptTaskTitle,
     record.userResponse, record.responseType, record.classification, record.consequence]
  );
  return record;
}

function getCheckinsBySession(sessionId) {
  return queryAll('SELECT * FROM checkins WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId]);
}

function getAllCheckins() {
  return queryAll('SELECT * FROM checkins ORDER BY timestamp DESC');
}

function getCheckinStats() {
  const total = queryOne('SELECT COUNT(*) as count FROM checkins').count;
  const aligned = queryOne("SELECT COUNT(*) as count FROM checkins WHERE classification = 'aligned'").count;
  const slightlyOff = queryOne("SELECT COUNT(*) as count FROM checkins WHERE classification = 'slightly_off'").count;
  const offTrack = queryOne("SELECT COUNT(*) as count FROM checkins WHERE classification = 'off_track'").count;
  const breakCount = queryOne("SELECT COUNT(*) as count FROM checkins WHERE classification = 'break'").count;
  return { total, aligned, slightlyOff, offTrack, break: breakCount };
}

function getSessionStats() {
  const total = queryOne('SELECT COUNT(*) as count FROM sessions').count;
  const completed = queryOne("SELECT COUNT(*) as count FROM sessions WHERE status = 'ended'").count;
  const avgRow = queryOne("SELECT AVG(endedAt - startedAt) as avg FROM sessions WHERE status = 'ended' AND endedAt IS NOT NULL");
  const avgDuration = avgRow ? avgRow.avg : 0;
  return { total, completed, avgDurationMs: avgDuration || 0 };
}

// --- Tasks ---

function createTask(task) {
  run(
    `INSERT INTO tasks (id, title, sourceContext, sessionId, createdAt, completedAt, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.title, task.sourceContext, task.sessionId, task.createdAt, task.completedAt, task.status]
  );
  return task;
}

function getTasks(sessionId) {
  if (sessionId) {
    return queryAll('SELECT * FROM tasks WHERE sessionId = ? ORDER BY createdAt ASC', [sessionId]);
  }
  return queryAll('SELECT * FROM tasks ORDER BY createdAt DESC');
}

function updateTask(id, updates) {
  const keys = Object.keys(updates);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => updates[k]);
  run(`UPDATE tasks SET ${sets} WHERE id = ?`, [...vals, id]);
}

// --- Planner History ---

function savePlannerHistory(record) {
  run(
    `INSERT INTO planner_history (id, rawInput, parsedOutput, method, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [record.id, record.rawInput, record.parsedOutput, record.method, record.createdAt]
  );
}

module.exports = {
  init, close, getDbPath,
  getSetting, setSetting, getAllSettings,
  createSession, getSession, getActiveSession, updateSession, getAllSessions,
  createCheckin, getCheckinsBySession, getAllCheckins, getCheckinStats, getSessionStats,
  createTask, getTasks, updateTask,
  savePlannerHistory
};
