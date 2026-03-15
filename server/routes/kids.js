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

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM kids WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router