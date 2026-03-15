const express = require('express')
const router = express.Router()
const db = require('../database')

router.get('/', (req, res) => {
  const kids = db.prepare('SELECT * FROM kids ORDER BY id').all()
  res.json(kids)
})

router.post('/', (req, res) => {
  const { name, emoji, color } = req.body
  const result = db.prepare(
    'INSERT INTO kids (name, emoji, color) VALUES (?, ?, ?)'
  ).run(name, emoji, color)
  res.json({ id: result.lastInsertRowid, name, emoji, color, points: 0 })
})

router.put('/:id', (req, res) => {
  const { name, emoji, color } = req.body
  db.prepare(
    'UPDATE kids SET name=?, emoji=?, color=? WHERE id=?'
  ).run(name, emoji, color, req.params.id)
  res.json({ ok: true })
})

router.put('/:id/points', (req, res) => {
  const { delta, reason } = req.body
  const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(req.params.id)
  if (!kid) return res.status(404).json({ error: 'Not found' })
  db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(delta, req.params.id)
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(kid.id, kid.name, delta > 0 ? 'points_added' : 'points_removed', reason || (delta > 0 ? 'Admin bonus' : 'Admin deduction'), delta)
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM kids WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router