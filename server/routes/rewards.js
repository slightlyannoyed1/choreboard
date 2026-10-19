const express = require('express')
const router = express.Router()
const db = require('../database')

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM rewards WHERE active=1').all())
})

router.post('/', (req, res) => {
  const { name, points } = req.body
  const result = db.prepare('INSERT INTO rewards (name, points) VALUES (?, ?)').run(name, points)
  res.json({ id: result.lastInsertRowid, name, points })
})

router.put('/:id', (req, res) => {
  const { name, points } = req.body
  db.prepare('UPDATE rewards SET name=?, points=? WHERE id=?').run(name, points, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE rewards SET active=0 WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

// Returns redeemed (acknowledged, non-rejected) requests for a given date — for board display
router.get('/redeemed', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)
  const rows = db.prepare(`
    SELECT rr.id, rr.created_at,
      k.name as kid_name, k.id as kid_id,
      r.name as reward_name, r.points as reward_points
    FROM redemption_requests rr
    JOIN kids k ON k.id = rr.kid_id
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.acknowledged = 1
      AND (rr.status IS NULL OR rr.status != 'rejected')
      AND date(rr.created_at) = ?
    ORDER BY rr.created_at ASC
  `).all(date)
  res.json(rows)
})

// Returns all unacknowledged awards (for admin dot + pending tab + kid cards)
router.get('/requests', (_req, res) => {
  const rows = db.prepare(`
    SELECT rr.id, rr.acknowledged, rr.created_at, rr.balance_after,
      k.name as kid_name, k.id as kid_id,
      r.name as reward_name, r.points as reward_points, r.id as reward_id
    FROM redemption_requests rr
    JOIN kids k ON k.id = rr.kid_id
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.acknowledged = 0
    ORDER BY rr.created_at ASC
  `).all()
  res.json(rows)
})

// Kid claims a reward — points deducted immediately. A kid who can't afford it may
// still claim it on credit, but only from a non-negative balance: once they're in
// debt they have to earn their way back before claiming anything else.
router.post('/requests', (req, res) => {
  const { kid_id, reward_id } = req.body
  const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(kid_id)
  const reward = db.prepare('SELECT * FROM rewards WHERE id=?').get(reward_id)
  if (!kid || !reward) return res.status(404).json({ error: 'Not found' })
  if (kid.points < 0) return res.status(400).json({ error: 'Already in debt — earn it back before claiming another reward' })
  const balanceAfter = kid.points - reward.points
  db.prepare('UPDATE kids SET points = points - ? WHERE id=?').run(reward.points, kid_id)
  const result = db.prepare(
    'INSERT INTO redemption_requests (kid_id, reward_id, acknowledged, balance_after, points_spent) VALUES (?, ?, 0, ?, ?)'
  ).run(kid_id, reward_id, balanceAfter, reward.points)

  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(kid_id, kid.name, 'reward_claimed', reward.name, -reward.points)

  res.json({ id: result.lastInsertRowid })
})

// Admin rejects — request removed and the points refunded
router.post('/requests/:id/reject', (req, res) => {
  const request = db.prepare(`
    SELECT rr.kid_id, rr.acknowledged, rr.points_spent, k.name as kid_name, r.name as reward_name, r.points as reward_points
    FROM redemption_requests rr
    JOIN kids k ON k.id = rr.kid_id
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id=?
  `).get(req.params.id)
  if (!request) return res.status(404).json({ error: 'Not found' })
  // Only a pending request can be rejected, so a double tap can't refund twice.
  if (request.acknowledged) return res.status(400).json({ error: 'Already handled' })

  // Refund exactly what was paid. Legacy rows predate points_spent and were paid the
  // reward's price.
  const refund = request.points_spent ?? request.reward_points
  db.prepare('UPDATE redemption_requests SET acknowledged=1, status=? WHERE id=?').run('rejected', req.params.id)
  db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(refund, request.kid_id)
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(request.kid_id, request.kid_name, 'reward_rejected', `Rejected: ${request.reward_name} (refunded)`, refund)
  res.json({ ok: true, points_refunded: refund })
})

// Admin acknowledges — prize has been handed out
router.post('/requests/:id/acknowledge', (req, res) => {
  const request = db.prepare(`
    SELECT rr.kid_id, k.name as kid_name, r.name as reward_name, r.points as reward_points
    FROM redemption_requests rr
    JOIN kids k ON k.id = rr.kid_id
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id=?
  `).get(req.params.id)
  db.prepare('UPDATE redemption_requests SET acknowledged=1 WHERE id=?').run(req.params.id)
  if (request) {
    db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
      .run(request.kid_id, request.kid_name, 'prize_given', request.reward_name, 0)
  }
  res.json({ ok: true })
})

// Reward suggestions (kids propose, admin approves/rejects)
router.get('/suggestions', (_req, res) => {
  const rows = db.prepare(`
    SELECT rs.*, k.name as kid_name, k.emoji as kid_emoji
    FROM reward_suggestions rs
    JOIN kids k ON k.id = rs.kid_id
    WHERE rs.status = 'pending'
    ORDER BY rs.created_at ASC
  `).all()
  res.json(rows)
})

router.post('/suggestions', (req, res) => {
  const { kid_id, name } = req.body
  if (!kid_id || !name || !name.trim()) return res.status(400).json({ error: 'Missing fields' })
  const result = db.prepare('INSERT INTO reward_suggestions (kid_id, name) VALUES (?, ?)').run(kid_id, name.trim())
  res.json({ ok: true, id: result.lastInsertRowid })
})

router.post('/suggestions/:id/approve', (req, res) => {
  const { points } = req.body
  const val = parseInt(points)
  if (!val || val < 1) return res.status(400).json({ error: 'Invalid points' })
  const suggestion = db.prepare('SELECT * FROM reward_suggestions WHERE id=?').get(req.params.id)
  if (!suggestion) return res.status(404).json({ error: 'Not found' })
  db.prepare('INSERT INTO rewards (name, points) VALUES (?, ?)').run(suggestion.name, val)
  db.prepare("UPDATE reward_suggestions SET status='approved' WHERE id=?").run(suggestion.id)
  res.json({ ok: true })
})

router.post('/suggestions/:id/reject', (req, res) => {
  db.prepare("UPDATE reward_suggestions SET status='rejected' WHERE id=?").run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
