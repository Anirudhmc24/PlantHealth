const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const fs = require('fs');
const path = require('path');

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const adapter = new FileSync(path.join(DATA_DIR, 'db.json'));
const db = low(adapter);

function initDB() {
  return new Promise((resolve) => {
    db.defaults({
      scans: [],
      chat_sessions: [],
      feedback: [],
      users: [],
      sessions: [],
    }).write();
    console.log('✅ Database ready (lowdb JSON)');
    resolve();
  });
}

function createUser(user) {
  return new Promise((resolve) => {
    db.get('users').push(user).write();
    resolve(user.id);
  });
}

function getUserByEmail(email) {
  return new Promise((resolve) => {
    const user = db.get('users').find({ email }).value();
    resolve(user || null);
  });
}

function getUserById(id) {
  return new Promise((resolve) => {
    const user = db.get('users').find({ id }).value();
    resolve(user || null);
  });
}

function saveSession(session) {
  return new Promise((resolve) => {
    db.get('sessions').push(session).write();
    resolve();
  });
}

function getSession(token) {
  return new Promise((resolve) => {
    const session = db.get('sessions').find({ token }).value();
    resolve(session || null);
  });
}

function deleteSession(token) {
  return new Promise((resolve) => {
    db.get('sessions').remove({ token }).write();
    resolve();
  });
}

function saveScan(scan) {
  return new Promise((resolve) => {
    const record = {
      ...scan,
      raw_predictions: JSON.stringify(scan.raw_predictions),
      created_at: new Date().toISOString()
    };
    db.get('scans').push(record).write();
    resolve(scan.id);
  });
}

function getScanById(id) {
  return new Promise((resolve) => {
    const row = db.get('scans').find({ id }).value();
    resolve(row || null);
  });
}

function getAllScans(limit = 50) {
  return new Promise((resolve) => {
    const rows = db.get('scans')
      .orderBy(['created_at'], ['desc'])
      .take(limit)
      .value();
    resolve(rows);
  });
}

function saveChatSession(session) {
  return new Promise((resolve) => {
    const existing = db.get('chat_sessions').find({ id: session.id }).value();
    const record = {
      id: session.id,
      scan_id: session.scan_id,
      messages: JSON.stringify(session.messages),
      updated_at: new Date().toISOString()
    };
    if (existing) {
      db.get('chat_sessions').find({ id: session.id }).assign(record).write();
    } else {
      db.get('chat_sessions').push({
        ...record,
        created_at: new Date().toISOString()
      }).write();
    }
    resolve();
  });
}

function getChatSession(id) {
  return new Promise((resolve) => {
    const row = db.get('chat_sessions').find({ id }).value();
    if (row) resolve({ ...row, messages: JSON.parse(row.messages || '[]') });
    else resolve(null);
  });
}

function saveFeedback(feedback) {
  return new Promise((resolve) => {
    db.get('feedback').push({
      ...feedback,
      created_at: new Date().toISOString()
    }).write();
    resolve();
  });
}

function getFeedbackStats() {
  return new Promise((resolve) => {
    const all = db.get('feedback').value();
    const total = all.length;
    const correct = all.filter(f => f.was_correct).length;
    const helpful = all.filter(f => f.treatment_helpful).length;
    resolve({
      total,
      correct_count: correct,
      helpful_count: helpful,
      accuracy_pct: total ? Math.round((correct / total) * 100) : 0,
      helpful_pct: total ? Math.round((helpful / total) * 100) : 0
    });
  });
}

module.exports = {
  initDB,
  createUser, getUserByEmail, getUserById,
  saveSession, getSession, deleteSession,
  saveScan, getScanById, getAllScans,
  saveChatSession, getChatSession,
  saveFeedback, getFeedbackStats,
};
