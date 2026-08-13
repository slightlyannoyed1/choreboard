const express = require('express')
const router = express.Router()
const db = require('../database')

function logAudit(kidId, type, description, points) {
  const kid = db.prepare('SELECT name FROM kids WHERE id=?').get(kidId)
  if (!kid) return
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(kidId, kid.name, type, description, points)
}

// Board list: every bounty still in play (open or awaiting verification), with the
// claiming kid's identity so the column can show who's on the hook for it.
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT b.*, k.name as kid_name, k.emoji as kid_emoji, k.color as kid_color
    FROM bounties b
    LEFT JOIN kids k ON k.id = b.claimed_by_kid_id
    WHERE b.status IN ('open', 'claimed')
    ORDER BY b.created_at ASC
  `).all()
  res.json(rows)
})

// Bounties finished on a given date, for the board's date-scoped "done" cards.
// Mirrors the rewards "redeemed" endpoint: the client passes its local date.
router.get('/completed', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10)
  const rows = db.prepare(`
    SELECT b.*, k.name as kid_name, k.emoji as kid_emoji, k.color as kid_color
    FROM bounties b
    JOIN kids k ON k.id = b.claimed_by_kid_id
    WHERE b.status = 'done' AND date(b.completed_at) = ?
    ORDER BY b.completed_at ASC
  `).all(date)
  res.json(rows)
})

// Claims awaiting a parent's yes/no — drives the admin badge and verify list.
router.get('/pending', (_req, res) => {
  const rows = db.prepare(`
    SELECT b.*, k.name as kid_name, k.emoji as kid_emoji, k.color as kid_color
    FROM bounties b
    JOIN kids k ON k.id = b.claimed_by_kid_id
    WHERE b.status = 'claimed'
    ORDER BY b.claimed_at ASC
  `).all()
  res.json(rows)
})

// Admin posts a bounty anyone can grab.
router.post('/', (req, res) => {
  const { name, points } = req.body
  const val = parseInt(points)
  if (!name || !name.trim() || !val || val < 1) return res.status(400).json({ error: 'Invalid bounty' })
  const result = db.prepare('INSERT INTO bounties (name, points) VALUES (?, ?)').run(name.trim(), val)
  res.json({ ok: true, id: result.lastInsertRowid })
})

// Kid claims it — no points move yet; the parent verifies the work first.
router.post('/:id/claim', (req, res) => {
  const { kid_id } = req.body
  const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(kid_id)
  if (!kid) return res.status(404).json({ error: 'Kid not found' })
  const bounty = db.prepare('SELECT * FROM bounties WHERE id=?').get(req.params.id)
  if (!bounty) return res.status(404).json({ error: 'Bounty not found' })
  if (bounty.status !== 'open') return res.status(400).json({ error: 'Bounty already claimed' })
  db.prepare("UPDATE bounties SET status='claimed', claimed_by_kid_id=?, claimed_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(kid_id, bounty.id)
  res.json({ ok: true })
})

// Kid changes their mind before it's verified — puts the bounty back up for grabs.
// Mirrors unchecking a chore: only works while it's still just a pending claim.
router.post('/:id/unclaim', (req, res) => {
  const bounty = db.prepare('SELECT * FROM bounties WHERE id=?').get(req.params.id)
  if (!bounty) return res.status(404).json({ error: 'Bounty not found' })
  if (bounty.status !== 'claimed') return res.status(400).json({ error: 'Bounty is not claimed' })
  db.prepare("UPDATE bounties SET status='open', claimed_by_kid_id=NULL, claimed_at=NULL WHERE id=?").run(bounty.id)
  res.json({ ok: true })
})

// Parent's verdict. Approve pays the claiming kid and closes it out; reject wipes
// the claim and puts the bounty back on the board for anyone to grab again.
router.post('/:id/verify', (req, res) => {
  const { approved } = req.body
  const bounty = db.prepare('SELECT * FROM bounties WHERE id=?').get(req.params.id)
  if (!bounty) return res.status(404).json({ error: 'Bounty not found' })
  if (bounty.status !== 'claimed') return res.status(400).json({ error: 'Bounty is not awaiting verification' })

  if (approved) {
    const kid = db.prepare('SELECT * FROM kids WHERE id=?').get(bounty.claimed_by_kid_id)
    if (!kid) return res.status(404).json({ error: 'Kid not found' })
    db.prepare("UPDATE bounties SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=?").run(bounty.id)
    db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(bounty.points, kid.id)
    logAudit(kid.id, 'bounty_claimed', `Bounty: ${bounty.name}`, bounty.points)
  } else {
    db.prepare("UPDATE bounties SET status='open', claimed_by_kid_id=NULL, claimed_at=NULL WHERE id=?").run(bounty.id)
  }
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const { name, points } = req.body
  const val = parseInt(points)
  if (!name || !name.trim() || !val || val < 1) return res.status(400).json({ error: 'Invalid bounty' })
  db.prepare('UPDATE bounties SET name=?, points=? WHERE id=?').run(name.trim(), val, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bounties WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
