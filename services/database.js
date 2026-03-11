const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/plantdisease.db';
let db;

function getDB() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, err => {
      if (err) console.error('DB connection error:', err);
      else console.log('✅ SQLite connected:', DB_PATH);
    });
    db.run('PRAGMA journal_mode=WAL');
  }
  return db;
}

async function initDB() {
  return new Promise((resolve, reject) => {
    const database = getDB();
    database.serialize(() => {
      // Scan results table
      database.run(`
        CREATE TABLE IF NOT EXISTS scans (
          id TEXT PRIMARY KEY,
          image_path TEXT,
          crop_type TEXT,
          disease_name TEXT,
          confidence REAL,
          severity_level TEXT,
          affected_area_percent REAL,
          raw_predictions TEXT,
          treatment_advice TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chat sessions table
      database.run(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          scan_id TEXT,
          messages TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (scan_id) REFERENCES scans(id)
        )
      `);

      // Feedback table (for learning loop)
      database.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id TEXT PRIMARY KEY,
          scan_id TEXT NOT NULL,
          was_correct INTEGER NOT NULL,
          correct_disease TEXT,
          treatment_helpful INTEGER,
          comments TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (scan_id) REFERENCES scans(id)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Database tables ready');
          resolve();
        }
      });
    });
  });
}

// ── Scan helpers ──────────────────────────────────────────────────────────────
async function saveScan(scan) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO scans
        (id, image_path, crop_type, disease_name, confidence, severity_level,
         affected_area_percent, raw_predictions, treatment_advice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    getDB().run(sql, [
      scan.id, scan.image_path, scan.crop_type, scan.disease_name,
      scan.confidence, scan.severity_level, scan.affected_area_percent,
      JSON.stringify(scan.raw_predictions), scan.treatment_advice,
    ], function(err) {
      if (err) reject(err);
      else resolve(scan.id);
    });
  });
}

async function getScanById(id) {
  return new Promise((resolve, reject) => {
    getDB().get('SELECT * FROM scans WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function getAllScans(limit = 50) {
  return new Promise((resolve, reject) => {
    getDB().all(
      'SELECT * FROM scans ORDER BY created_at DESC LIMIT ?',
      [limit],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

// ── Chat helpers ──────────────────────────────────────────────────────────────
async function saveChatSession(session) {
  return new Promise((resolve, reject) => {
    getDB().run(
      `INSERT OR REPLACE INTO chat_sessions (id, scan_id, messages, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [session.id, session.scan_id, JSON.stringify(session.messages)],
      err => { if (err) reject(err); else resolve(); }
    );
  });
}

async function getChatSession(id) {
  return new Promise((resolve, reject) => {
    getDB().get('SELECT * FROM chat_sessions WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else if (row) resolve({ ...row, messages: JSON.parse(row.messages || '[]') });
      else resolve(null);
    });
  });
}

// ── Feedback helpers ──────────────────────────────────────────────────────────
async function saveFeedback(feedback) {
  return new Promise((resolve, reject) => {
    getDB().run(
      `INSERT INTO feedback
         (id, scan_id, was_correct, correct_disease, treatment_helpful, comments)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [feedback.id, feedback.scan_id, feedback.was_correct ? 1 : 0,
       feedback.correct_disease, feedback.treatment_helpful ? 1 : 0, feedback.comments],
      err => { if (err) reject(err); else resolve(); }
    );
  });
}

async function getFeedbackStats() {
  return new Promise((resolve, reject) => {
    getDB().all(`
      SELECT
        COUNT(*) AS total,
        SUM(was_correct) AS correct_count,
        SUM(treatment_helpful) AS helpful_count,
        ROUND(AVG(was_correct) * 100, 1) AS accuracy_pct,
        ROUND(AVG(treatment_helpful) * 100, 1) AS helpful_pct
      FROM feedback
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows[0]);
    });
  });
}

module.exports = {
  initDB, getDB,
  saveScan, getScanById, getAllScans,
  saveChatSession, getChatSession,
  saveFeedback, getFeedbackStats,
};
