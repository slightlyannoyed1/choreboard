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

// Migrate: habit tracking (mastery decay, streaks, health). Existing chores land
// with habit_enabled=0 and behave exactly as before until a parent opts them in.
try { db.exec('ALTER TABLE chores ADD COLUMN habit_enabled INTEGER NOT NULL DEFAULT 0') } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN mastery_reps INTEGER DEFAULT NULL') } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN floor_pct INTEGER DEFAULT NULL') } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN decay_start_date TEXT DEFAULT NULL') } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN revived_at TEXT DEFAULT NULL') } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN mastered_at TEXT DEFAULT NULL') } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN mastery_ack INTEGER NOT NULL DEFAULT 0') } catch(_) {}
try { db.exec("ALTER TABLE chores ADD COLUMN state TEXT NOT NULL DEFAULT 'active'") } catch(_) {}
try { db.exec('ALTER TABLE chores ADD COLUMN died_at TEXT DEFAULT NULL') } catch(_) {}

// Migrate: record what a completion actually paid. Without this, uncompleting a
// chore whose value has since decayed would refund the wrong amount.
try { db.exec('ALTER TABLE completions ADD COLUMN points_awarded INTEGER DEFAULT NULL') } catch(_) {}

// Weekly consistency + one-off graduation bonuses. The unique index is what makes
// the lazy "award it on first request of the new week" evaluation safe to re-run.
db.exec(`
  CREATE TABLE IF NOT EXISTS bonus_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    period_key TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kid_id) REFERENCES kids(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS bonus_awards_unique
    ON bonus_awards (kid_id, type, period_key);
`)

const HABIT_DEFAULTS = {
  habit_mastery_days: '60',
  habit_floor_pct: '40',
  habit_graduation_multiplier: '5',
  habit_consistency_pct: '20',
  habit_health_threshold: '80',
}
for (const [key, value] of Object.entries(HABIT_DEFAULTS)) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  if (!row) db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

// Seed admin PIN from env var on first run
const existingPin = db.prepare('SELECT value FROM settings WHERE key=?').get('admin_pin')
if (!existingPin) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pin', process.env.ADMIN_PIN || '1234')
}

module.exports = db