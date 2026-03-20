const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'choreboard.db')
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    kid_name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS kids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 10,
    recurring TEXT NOT NULL DEFAULT 'daily',
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (kid_id) REFERENCES kids(id)
  );

  CREATE TABLE IF NOT EXISTS completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL,
    kid_id INTEGER NOT NULL,
    completed_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chore_id) REFERENCES chores(id),
    FOREIGN KEY (kid_id) REFERENCES kids(id)
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    points INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS redemption_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kid_id) REFERENCES kids(id),
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
  );

  CREATE TABLE IF NOT EXISTS kid_shoutouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    shoutout_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kid_id) REFERENCES kids(id)
  );
`)

// Migrate: add reward_suggestions table if not present
db.exec(`
  CREATE TABLE IF NOT EXISTS reward_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kid_id) REFERENCES kids(id)
  );
`)

// Migrate: add acknowledged column if not present
try { db.exec('ALTER TABLE redemption_requests ADD COLUMN acknowledged INTEGER NOT NULL DEFAULT 0') } catch(_) {}
// Migrate: add shoutout award columns if not present
try { db.exec('ALTER TABLE kid_shoutouts ADD COLUMN awarded INTEGER NOT NULL DEFAULT 0') } catch(_) {}
try { db.exec('ALTER TABLE kid_shoutouts ADD COLUMN awarded_points INTEGER DEFAULT NULL') } catch(_) {}

// Seed admin PIN from env var on first run
const existingPin = db.prepare('SELECT value FROM settings WHERE key=?').get('admin_pin')
if (!existingPin) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pin', process.env.ADMIN_PIN || '1234')
}

module.exports = db