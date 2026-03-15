const express = require('express')
const router = express.Router()
const db = require('../database')

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dowForDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay()
}

function choreIsActiveOnDow(recurring, dow) {
  if (recurring === 'daily') return true
  if (recurring === 'weekdays') return dow >= 1 && dow <= 5
  if (recurring === 'weekly') return dow === 1
  return recurring.split(',').map(Number).includes(dow)
}

router.get('/all', (_req, res) => {
  const chores = db.prepare('SELECT * FROM chores WHERE active=1 ORDER BY kid_id, id').all()
  res.json(chores)
})

router.get('/', (req, res) => {
  const date = req.query.date || todayStr()
  const dow = dowForDate(date)
  const chores = db.prepare(
    'SELECT * FROM chores WHERE active=1 ORDER BY kid_id, id'
  ).all()
  const completions = db.prepare(
    'SELECT chore_id FROM completions WHERE completed_date=?'
  ).all(date).map(r => r.chore_id)

  const streakRows = db.prepare(
    `SELECT chore_id, completed_date FROM completions
     WHERE completed_date <= ? AND completed_date >= date(?, '-60 days')
     ORDER BY chore_id, completed_date DESC`
  ).all(date, date)
  const byChore = {}
  for (const row of streakRows) {
    if (!byChore[row.chore_id]) byChore[row.chore_id] = []
    byChore[row.chore_id].push(row.completed_date)
  }
  function computeStreak(dates, fromDate) {
    if (!dates || dates.length === 0) return 0
    let streak = 0, expected = fromDate
    for (const d of dates) {
      if (d === expected) {
        streak++
        const prev = new Date(expected + 'T12:00:00')
        prev.setDate(prev.getDate() - 1)
        expected = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`
      } else break
    }
    return streak
  }

  const result = chores
    .filter(c => choreIsActiveOnDow(c.recurring, dow))
    .map(c => ({ ...c, done: completions.includes(c.id), streak: computeStreak(byChore[c.id], date) }))

  res.json(result)
})

router.post('/', (req, res) => {
  const { kid_id, name, points, recurring } = req.body
  const result = db.prepare(
    'INSERT INTO chores (kid_id, name, points, recurring) VALUES (?, ?, ?, ?)'
  ).run(kid_id, name, points || 10, recurring || 'daily')
  res.json({ id: result.lastInsertRowid, kid_id, name, points, recurring, done: false })
})

router.post('/:id/complete', (req, res) => {
  const date = req.query.date || todayStr()
  const today = todayStr()
  const msPerDay = 1000 * 60 * 60 * 24
  const daysAgo = (new Date(today + 'T12:00:00') - new Date(date + 'T12:00:00')) / msPerDay
  if (daysAgo > 7) return res.status(400).json({ error: 'Cannot complete chores more than 7 days ago' })
  if (daysAgo < -14) return res.status(400).json({ error: 'Cannot complete chores more than 14 days in advance' })

  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })

  const already = db.prepare(
    'SELECT id FROM completions WHERE chore_id=? AND completed_date=?'
  ).get(chore.id, date)
  if (already) return res.status(400).json({ error: 'Already completed today' })

  db.prepare(
    'INSERT INTO completions (chore_id, kid_id, completed_date) VALUES (?, ?, ?)'
  ).run(chore.id, chore.kid_id, date)
  db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(chore.points, chore.kid_id)

  const kid = db.prepare('SELECT name FROM kids WHERE id=?').get(chore.kid_id)
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(chore.kid_id, kid.name, 'chore_complete', chore.name, chore.points)

  res.json({ ok: true, points_awarded: chore.points })
})

router.delete('/:id/complete', (req, res) => {
  const date = req.query.date || todayStr()
  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })

  const completion = db.prepare(
    'SELECT id FROM completions WHERE chore_id=? AND completed_date=?'
  ).get(chore.id, date)
  if (!completion) return res.status(400).json({ error: 'Not completed on that date' })

  db.prepare('DELETE FROM completions WHERE id=?').run(completion.id)
  db.prepare('UPDATE kids SET points = points - ? WHERE id=?').run(chore.points, chore.kid_id)

  const kid = db.prepare('SELECT name FROM kids WHERE id=?').get(chore.kid_id)
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(chore.kid_id, kid.name, 'chore_uncomplete', chore.name, -chore.points)

  res.json({ ok: true, points_removed: chore.points })
})

router.put('/:id', (req, res) => {
  const { name, points, recurring } = req.body
  db.prepare(
    'UPDATE chores SET name=?, points=?, recurring=? WHERE id=?'
  ).run(name, points, recurring, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE chores SET active=0 WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router