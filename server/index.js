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
  const tz = db.prepare('SELECT value FROM settings WHERE key=?').get('timezone')
  const dp = db.prepare('SELECT value FROM settings WHERE key=?').get('default_points')
  res.json({ timezone: tz ? tz.value : 'America/New_York', default_points: dp ? parseInt(dp.value) : 10 })
})

app.put('/api/settings/default-points', (req, res) => {
  const { points } = req.body
  const val = parseInt(points)
  if (!val || val < 1) return res.status(400).json({ error: 'Invalid points value' })
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('default_points', String(val))
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