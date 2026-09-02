const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

const resolvedPath = path.resolve(process.cwd(), config.dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    service TEXT,
    field_index INTEGER DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}',
    order_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    service TEXT NOT NULL,
    service_data TEXT NOT NULL DEFAULT '{}',
    price_soles INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pendiente',
    payment_reported_at TEXT,
    payment_confirmed_at TEXT,
    result_status TEXT,
    result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS processed_messages (
    id TEXT PRIMARY KEY,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
