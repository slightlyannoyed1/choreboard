const express = require('express')
const cors = require('cors')
const path = require('path')
const db = require('./database')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/kids', require('./routes/kids'))
app.use('/api/chores', require('./routes/chores'))
app.use('/api/rewards', require('./routes/rewards'))
app.use('/api/bounties', require('./routes/bounties'))

app.get('/api/pin/verify', (req, res) => {
  const { pin } = req.query
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get('admin_pin')
  res.json({ valid: pin === (row ? row.value : '1234') })
})

app.put('/api/pin', (req, res) => {
  const { pin } = req.body
  if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' })
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_pin', pin)
  res.json({ ok: true })
})

app.get('/api/settings', (_req, res) => {
  const get = (key) => db.prepare('SELECT value FROM settings WHERE key=?').get(key)
  const tz = get('timezone')
  const dp = get('default_points')
  const ts = get('text_size')
  const cm = get('currency_mode')
  const cr = get('currency_rate')
  const md = get('habit_mastery_days')
  const fp = get('habit_floor_pct')
  const gm = get('habit_graduation_multiplier')
  const cb = get('habit_consistency_pct')
  const ht = get('habit_health_threshold')
  res.json({
    timezone: tz ? tz.value : 'America/New_York',
    default_points: dp ? parseInt(dp.value) : 10,
    text_size: ts ? ts.value : 'medium',
    currency_mode: cm ? cm.value : 'points',
    currency_rate: cr ? parseFloat(cr.value) : 0.05,
    habit_mastery_days: md ? parseInt(md.value) : 60,
    habit_floor_pct: fp ? parseInt(fp.value) : 40,
    habit_graduation_multiplier: gm ? parseFloat(gm.value) : 5,
    habit_consistency_pct: cb ? parseInt(cb.value) : 20,
    habit_health_threshold: ht ? parseInt(ht.value) : 80,
  })
})

const HABIT_SETTING_RANGES = {
  habit_mastery_days: [7, 365],
  habit_floor_pct: [0, 100],
  habit_graduation_multiplier: [0, 50],
  habit_consistency_pct: [0, 100],
  habit_health_threshold: [0, 100],
}

app.put('/api/settings/habits', (req, res) => {
  const updates = []
  for (const [key, [min, max]] of Object.entries(HABIT_SETTING_RANGES)) {
    if (!(key in req.body)) continue
    const val = parseFloat(req.body[key])
    if (!isFinite(val) || val < min || val > max) {
      return res.status(400).json({ error: `Invalid ${key}` })
    }
    updates.push([key, String(val)])
  }
  for (const [key, value] of updates) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  }
  res.json({ ok: true })
})

app.put('/api/settings/default-points', (req, res) => {
  const { points } = req.body
  const val = parseInt(points)
  if (!val || val < 1) return res.status(400).json({ error: 'Invalid points value' })
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('default_points', String(val))
  res.json({ ok: true })
})

app.put('/api/settings/text-size', (req, res) => {
  const { size } = req.body
  if (!['small', 'medium', 'large', 'big'].includes(size)) return res.status(400).json({ error: 'Invalid size' })
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('text_size', size)
  res.json({ ok: true })
})

app.put('/api/settings/currency-mode', (req, res) => {
  const { mode } = req.body
  if (!['points', 'dollars'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' })
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('currency_mode', mode)
  res.json({ ok: true })
})

app.put('/api/settings/currency-rate', (req, res) => {
  const { rate } = req.body
  const val = parseFloat(rate)
  if (!isFinite(val) || val <= 0) return res.status(400).json({ error: 'Invalid rate' })
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('currency_rate', String(val))
  res.json({ ok: true })
})

app.put('/api/settings/timezone', (req, res) => {
  const { timezone } = req.body
  try { Intl.DateTimeFormat(undefined, { timeZone: timezone }) } catch {
    return res.status(400).json({ error: 'Invalid timezone' })
  }
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('timezone', timezone)
  res.json({ ok: true })
})

app.get('/api/shoutouts', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)
  const rows = db.prepare('SELECT * FROM kid_shoutouts WHERE shoutout_date=? ORDER BY created_at ASC').all(date)
  res.json(rows)
})

app.get('/api/shoutouts/pending', (_req, res) => {
  const rows = db.prepare(`
    SELECT ks.*, k.name as kid_name, k.emoji as kid_emoji, k.color as kid_color
    FROM kid_shoutouts ks
    JOIN kids k ON k.id = ks.kid_id
    WHERE ks.awarded = 0
      AND ks.shoutout_date >= date('now', '-7 days')
    ORDER BY ks.created_at DESC
  `).all()
  res.json(rows)
})

app.post('/api/shoutouts/:id/award', (req, res) => {
  const { points } = req.body
  const val = parseInt(points)
  if (!val || val < 1) return res.status(400).json({ error: 'Invalid points' })
  const shoutout = db.prepare('SELECT * FROM kid_shoutouts WHERE id=?').get(req.params.id)
  if (!shoutout) return res.status(404).json({ error: 'Not found' })
  if (shoutout.awarded) return res.status(400).json({ error: 'Already awarded' })
  const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(shoutout.kid_id)
  if (!kid) return res.status(404).json({ error: 'Kid not found' })
  db.prepare('UPDATE kid_shoutouts SET awarded=1, awarded_points=? WHERE id=?').run(val, shoutout.id)
  db.prepare('UPDATE kids SET points=points+? WHERE id=?').run(val, shoutout.kid_id)
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(shoutout.kid_id, kid.name, 'points_added', `Shoutout: ${shoutout.description}`, val)
  res.json({ ok: true })
})

app.post('/api/shoutouts', (req, res) => {
  const { kid_id, description, date } = req.body
  if (!kid_id || !description || !description.trim()) return res.status(400).json({ error: 'Missing fields' })
  const shoutout_date = date || new Date().toISOString().slice(0, 10)
  const result = db.prepare('INSERT INTO kid_shoutouts (kid_id, description, shoutout_date) VALUES (?, ?, ?)').run(kid_id, description.trim(), shoutout_date)
  res.json({ ok: true, id: result.lastInsertRowid })
})

app.post('/api/shoutouts/:id/acknowledge', (req, res) => {
  const shoutout = db.prepare('SELECT * FROM kid_shoutouts WHERE id=?').get(req.params.id)
  if (!shoutout) return res.status(404).json({ error: 'Not found' })
  if (shoutout.awarded) return res.status(400).json({ error: 'Already reviewed' })
  db.prepare('UPDATE kid_shoutouts SET awarded=1, awarded_points=0 WHERE id=?').run(shoutout.id)
  res.json({ ok: true })
})

app.delete('/api/shoutouts/:id', (req, res) => {
  db.prepare('DELETE FROM kid_shoutouts WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// Demerits: an admin-only deduction of a normal points/dollar amount. The reason
// is optional. Shows up as a gentle badge on the board for the day it lands.
app.get('/api/demerits', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)
  const rows = db.prepare('SELECT * FROM demerits WHERE demerit_date=? ORDER BY created_at ASC').all(date)
  res.json(rows)
})

app.post('/api/demerits', (req, res) => {
  const { kid_id, points, reason, date } = req.body
  const val = parseInt(points)
  if (!kid_id || !val || val < 1) return res.status(400).json({ error: 'Invalid demerit' })
  const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(kid_id)
  if (!kid) return res.status(404).json({ error: 'Kid not found' })
  const demerit_date = date || new Date().toISOString().slice(0, 10)
  const reasonText = (reason || '').trim()
  const result = db.prepare('INSERT INTO demerits (kid_id, points, reason, demerit_date) VALUES (?, ?, ?, ?)')
    .run(kid_id, val, reasonText, demerit_date)
  db.prepare('UPDATE kids SET points = points - ? WHERE id=?').run(val, kid_id)
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(kid.id, kid.name, 'demerit', reasonText ? `Demerit: ${reasonText}` : 'Demerit', -val)
  res.json({ ok: true, id: result.lastInsertRowid })
})

app.delete('/api/demerits/:id', (req, res) => {
  const demerit = db.prepare('SELECT * FROM demerits WHERE id=?').get(req.params.id)
  if (!demerit) return res.status(404).json({ error: 'Not found' })
  const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(demerit.kid_id)
  db.prepare('DELETE FROM demerits WHERE id=?').run(req.params.id)
  if (kid) {
    db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(demerit.points, demerit.kid_id)
    db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
      .run(kid.id, kid.name, 'points_added', 'Demerit removed', demerit.points)
  }
  res.json({ ok: true })
})

app.get('/api/audit', (_req, res) => {
  const rows = db.prepare(`
    SELECT * FROM audit_log
    WHERE created_at >= datetime('now', '-30 days')
    ORDER BY created_at DESC
    LIMIT 500
  `).all()
  res.json(rows)
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`ChoreBoard running on port ${PORT}`)
})