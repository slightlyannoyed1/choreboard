const express = require('express')
const router = express.Router()
const db = require('../database')
const habits = require('../habits')

const {
  today: todayStr, addDays, daysBetween,
  choreIsActiveOnDow, masteryRepsFor, masteryStart, activityStart, snapshot,
  streakForCompletion, computeValue, completionsSince, lifecycleState,
} = habits

function dowForDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay()
}

function settings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'habit_%'").all()
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    masteryDays: parseInt(s.habit_mastery_days) || 60,
    floorPct: parseInt(s.habit_floor_pct) || 40,
    graduationMultiplier: parseFloat(s.habit_graduation_multiplier) || 5,
    consistencyPct: parseInt(s.habit_consistency_pct) || 20,
    healthThreshold: parseInt(s.habit_health_threshold) || 80,
  }
}

// Completion dates for every chore, ascending, keyed by chore id.
function completionsByChore() {
  const rows = db.prepare(
    'SELECT chore_id, completed_date FROM completions ORDER BY chore_id, completed_date ASC'
  ).all()
  const byChore = {}
  for (const row of rows) {
    if (!byChore[row.chore_id]) byChore[row.chore_id] = []
    byChore[row.chore_id].push(row.completed_date)
  }
  return byChore
}

function completionsFor(choreId) {
  return db.prepare(
    'SELECT completed_date FROM completions WHERE chore_id=? ORDER BY completed_date ASC'
  ).all(choreId).map(r => r.completed_date)
}

function logAudit(kidId, type, description, points) {
  const kid = db.prepare('SELECT name FROM kids WHERE id=?').get(kidId)
  if (!kid) return
  db.prepare('INSERT INTO audit_log (kid_id, kid_name, type, description, points) VALUES (?, ?, ?, ?, ?)')
    .run(kidId, kid.name, type, description, points)
}

// A habit untouched for three weeks is gone. Mastery is deliberately preserved on
// the row: if a parent revives it, it comes back at its decayed value. Letting a
// chore die must never be a way to restore its full price.
function sweepDeadHabits(date, byChore) {
  const chores = db.prepare(
    "SELECT * FROM chores WHERE active=1 AND habit_enabled=1 AND state='active'"
  ).all()
  for (const chore of chores) {
    if (lifecycleState(chore, byChore[chore.id] || [], date) !== 'dead') continue
    db.prepare("UPDATE chores SET state='dead', died_at=? WHERE id=?").run(date, chore.id)
    chore.state = 'dead'
    logAudit(chore.kid_id, 'habit_died', `Habit died: ${chore.name}`, 0)
  }
}

// Weekly consistency bonus. Evaluated lazily on the first request of a new week and
// guarded by a unique index, so it pays exactly once even if the server was asleep.
//
// The bonus is a percentage of what the kid's tracked habits actually paid last week,
// so it's expressed in the same currency as everything else -- no thinking in raw
// points -- and it scales on its own as habit payouts decay.
function awardConsistencyBonuses(date, byChore) {
  const { healthThreshold, consistencyPct } = settings()
  if (consistencyPct <= 0) return

  const weekStart = addDays(date, -dowForDate(date))   // Sunday of the current week
  const lastWeekStart = addDays(weekStart, -7)
  const lastWeekEnd = addDays(weekStart, -1)

  const kids = db.prepare('SELECT * FROM kids').all()
  for (const kid of kids) {
    const already = db.prepare(
      "SELECT id FROM bonus_awards WHERE kid_id=? AND type='consistency' AND period_key=?"
    ).get(kid.id, lastWeekStart)
    if (already) continue

    const chores = db.prepare(
      "SELECT * FROM chores WHERE kid_id=? AND active=1 AND habit_enabled=1 AND state='active'"
    ).all(kid.id).filter(c => activityStart(c) <= lastWeekEnd)

    // Nothing to be consistent about: record a zero award so we don't re-check daily.
    const earned = chores.length > 0 && chores.every(c =>
      snapshot(c, byChore[c.id] || [], lastWeekEnd).health >= healthThreshold
    )

    // Base: everything the kid earned from tracked habits during the week just ended.
    const base = earned ? db.prepare(`
      SELECT COALESCE(SUM(cp.points_awarded), 0) AS total
      FROM completions cp JOIN chores c ON c.id = cp.chore_id
      WHERE cp.kid_id = ? AND c.habit_enabled = 1
        AND cp.completed_date >= ? AND cp.completed_date <= ?
    `).get(kid.id, lastWeekStart, lastWeekEnd).total : 0
    const points = earned ? Math.round(base * consistencyPct / 100) : 0

    // The points move only if this insert is the one that claimed the week, so the
    // bonus can never be paid twice.
    const claimed = db.prepare(
      'INSERT OR IGNORE INTO bonus_awards (kid_id, type, period_key, points) VALUES (?, ?, ?, ?)'
    ).run(kid.id, 'consistency', lastWeekStart, points)
    if (claimed.changes === 0 || !earned || points <= 0) continue

    db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(points, kid.id)
    logAudit(kid.id, 'consistency_bonus', `Consistency bonus (${consistencyPct}%): week of ${lastWeekStart}`, points)
  }
}

router.get('/all', (_req, res) => {
  const date = todayStr()
  const byChore = completionsByChore()
  const chores = db.prepare('SELECT * FROM chores WHERE active=1 ORDER BY kid_id, id').all()
  res.json(chores.map(c => ({ ...c, ...snapshot(c, byChore[c.id] || [], date) })))
})

// Mastered habits awaiting a parent decision (keep / retire / restart).
router.get('/mastered', (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, k.name as kid_name, k.emoji as kid_emoji, k.color as kid_color
    FROM chores c JOIN kids k ON k.id = c.kid_id
    WHERE c.active=1 AND c.mastered_at IS NOT NULL AND c.mastery_ack=0
    ORDER BY c.mastered_at DESC
  `).all()
  res.json(rows)
})

router.get('/dead', (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*, k.name as kid_name, k.emoji as kid_emoji, k.color as kid_color
    FROM chores c JOIN kids k ON k.id = c.kid_id
    WHERE c.active=1 AND c.state='dead'
    ORDER BY c.died_at DESC
  `).all()
  res.json(rows)
})

router.get('/', (req, res) => {
  const date = req.query.date || todayStr()
  const dow = dowForDate(date)

  let byChore = completionsByChore()
  sweepDeadHabits(todayStr(), byChore)
  awardConsistencyBonuses(todayStr(), byChore)

  const chores = db.prepare(
    "SELECT * FROM chores WHERE active=1 AND state='active' ORDER BY kid_id, id"
  ).all()
  const completions = db.prepare(
    'SELECT chore_id, points_awarded FROM completions WHERE completed_date=?'
  ).all(date)
  const awardedByChore = Object.fromEntries(completions.map(c => [c.chore_id, c.points_awarded]))

  const result = chores
    .filter(c => choreIsActiveOnDow(c.recurring, dow))
    .map(c => {
      const snap = snapshot(c, byChore[c.id] || [], date)
      const done = c.id in awardedByChore
      return {
        ...c,
        ...snap,
        done,
        // A completed chore shows what it actually paid, not what it would pay now.
        points: done ? (awardedByChore[c.id] ?? c.points) : snap.value,
        base_points: c.points,
      }
    })

  res.json(result)
})

router.post('/', (req, res) => {
  const { kid_id, name, points, recurring, habit_enabled } = req.body
  const s = settings()
  const rec = recurring || 'daily'
  const habit = habit_enabled ? 1 : 0
  const result = db.prepare(`
    INSERT INTO chores (kid_id, name, points, recurring, habit_enabled, mastery_reps, floor_pct, decay_start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    kid_id, name, points || 10, rec, habit,
    habit ? masteryRepsFor(rec, s.masteryDays) : null,
    habit ? s.floorPct : null,
    habit ? todayStr() : null,
  )
  res.json({ id: result.lastInsertRowid, kid_id, name, points, recurring: rec, habit_enabled: habit, done: false })
})

// How far back a chore can still be ticked off. Older days stay visible on the
// board -- they're just read-only.
const EDIT_WINDOW_DAYS = 3

router.post('/:id/complete', (req, res) => {
  const date = req.query.date || todayStr()
  const today = todayStr()
  const daysAgo = daysBetween(date, today)
  if (daysAgo > EDIT_WINDOW_DAYS) return res.status(400).json({ error: `Cannot complete chores more than ${EDIT_WINDOW_DAYS} days ago` })
  if (daysAgo < -14) return res.status(400).json({ error: 'Cannot complete chores more than 14 days in advance' })

  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })
  if (chore.state === 'dead') return res.status(400).json({ error: 'This habit has died and cannot be completed' })

  const already = db.prepare(
    'SELECT id FROM completions WHERE chore_id=? AND completed_date=?'
  ).get(chore.id, date)
  if (already) return res.status(400).json({ error: 'Already completed today' })

  const dates = completionsFor(chore.id)
  const doneSet = new Set(dates)
  const reps = chore.habit_enabled ? completionsSince(dates.filter(d => d < date), masteryStart(chore)) : 0
  const streak = streakForCompletion(chore, doneSet, date)
  const awarded = computeValue(chore, { reps, streak })

  db.prepare(
    'INSERT INTO completions (chore_id, kid_id, completed_date, points_awarded) VALUES (?, ?, ?, ?)'
  ).run(chore.id, chore.kid_id, date, awarded)
  db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(awarded, chore.kid_id)
  logAudit(chore.kid_id, 'chore_complete', chore.name, awarded)

  // Graduation: the rep that tips the chore into mastery pays a one-time lump and
  // flags it for a parent decision.
  let graduation = null
  if (chore.habit_enabled && !chore.mastered_at) {
    const totalReps = completionsSince([...dates, date], masteryStart(chore))
    const masteryReps = chore.mastery_reps || masteryRepsFor(chore.recurring, settings().masteryDays)
    if (totalReps >= masteryReps) {
      const bonus = Math.max(1, Math.round(chore.points * settings().graduationMultiplier))
      // Keyed to the habit cycle, not the chore: if a parent restarts the habit later
      // it gets a fresh decay_start_date and can be mastered -- and paid for -- again.
      const cycle = `chore-${chore.id}-${masteryStart(chore)}`
      const claimed = db.prepare(
        'INSERT OR IGNORE INTO bonus_awards (kid_id, type, period_key, points) VALUES (?, ?, ?, ?)'
      ).run(chore.kid_id, 'graduation', cycle, bonus)

      db.prepare('UPDATE chores SET mastered_at=?, mastery_ack=0 WHERE id=?').run(date, chore.id)
      if (claimed.changes > 0) {
        db.prepare('UPDATE kids SET points = points + ? WHERE id=?').run(bonus, chore.kid_id)
        logAudit(chore.kid_id, 'graduation_bonus', `Mastered: ${chore.name}`, bonus)
        graduation = { bonus, chore_name: chore.name }
      }
    }
  }

  res.json({ ok: true, points_awarded: awarded, graduation })
})

router.delete('/:id/complete', (req, res) => {
  const date = req.query.date || todayStr()
  // Unchecking is bounded by the same window: outside it a kid could strip the points
  // off an old completion and then be unable to tick it back on.
  if (daysBetween(date, todayStr()) > EDIT_WINDOW_DAYS) {
    return res.status(400).json({ error: `Cannot change chores more than ${EDIT_WINDOW_DAYS} days ago` })
  }

  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })

  const completion = db.prepare(
    'SELECT id, points_awarded FROM completions WHERE chore_id=? AND completed_date=?'
  ).get(chore.id, date)
  if (!completion) return res.status(400).json({ error: 'Not completed on that date' })

  // Refund exactly what was paid. Legacy rows predate points_awarded and were paid
  // the chore's flat value.
  const refund = completion.points_awarded ?? chore.points

  db.prepare('DELETE FROM completions WHERE id=?').run(completion.id)
  db.prepare('UPDATE kids SET points = points - ? WHERE id=?').run(refund, chore.kid_id)
  logAudit(chore.kid_id, 'chore_uncomplete', chore.name, -refund)

  res.json({ ok: true, points_removed: refund })
})

// Turn habit tracking on or off. Switching it on starts the mastery clock today, so
// a chore with months of history doesn't land at the floor the moment you enable it.
router.post('/:id/habit', (req, res) => {
  const { enabled, mastery_days, floor_pct } = req.body
  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })

  if (!enabled) {
    db.prepare("UPDATE chores SET habit_enabled=0, state='active', died_at=NULL WHERE id=?").run(chore.id)
    return res.json({ ok: true, habit_enabled: 0 })
  }

  const s = settings()
  const days = parseInt(mastery_days) || s.masteryDays
  const floor = floor_pct != null ? parseInt(floor_pct) : s.floorPct
  db.prepare(`
    UPDATE chores SET habit_enabled=1, mastery_reps=?, floor_pct=?,
      decay_start_date=COALESCE(decay_start_date, ?), state='active', died_at=NULL
    WHERE id=?
  `).run(masteryRepsFor(chore.recurring, days), floor, todayStr(), chore.id)
  res.json({ ok: true, habit_enabled: 1 })
})

// Parent's call once a habit is mastered.
router.post('/:id/mastery', (req, res) => {
  const { action } = req.body
  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })

  if (action === 'keep') {
    db.prepare('UPDATE chores SET mastery_ack=1 WHERE id=?').run(chore.id)
  } else if (action === 'retire') {
    db.prepare('UPDATE chores SET mastery_ack=1, active=0 WHERE id=?').run(chore.id)
    logAudit(chore.kid_id, 'habit_retired', `Retired: ${chore.name}`, 0)
  } else if (action === 'restart') {
    restartHabit(chore)
  } else {
    return res.status(400).json({ error: 'Unknown action' })
  }
  res.json({ ok: true })
})

// Bring a dead habit back. Mastery is preserved -- it returns at its decayed value
// with health and streak reset, so dying is a pure loss.
router.post('/:id/revive', (req, res) => {
  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })
  db.prepare("UPDATE chores SET state='active', died_at=NULL, revived_at=? WHERE id=?")
    .run(todayStr(), chore.id)
  res.json({ ok: true })
})

// Start the habit over from scratch: full base value again, mastery wiped. Only a
// parent can do this -- it's the one path that undoes decay.
function restartHabit(chore) {
  db.prepare(`
    UPDATE chores SET state='active', died_at=NULL, revived_at=?, decay_start_date=?,
      mastered_at=NULL, mastery_ack=0, active=1
    WHERE id=?
  `).run(todayStr(), todayStr(), chore.id)
  logAudit(chore.kid_id, 'habit_restarted', `Restarted habit: ${chore.name}`, 0)
}

router.post('/:id/restart', (req, res) => {
  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })
  restartHabit(chore)
  res.json({ ok: true })
})

router.put('/:id', (req, res) => {
  const { name, points, recurring } = req.body
  const chore = db.prepare('SELECT * FROM chores WHERE id=?').get(req.params.id)
  if (!chore) return res.status(404).json({ error: 'Chore not found' })

  db.prepare('UPDATE chores SET name=?, points=?, recurring=? WHERE id=?')
    .run(name, points, recurring, req.params.id)

  // The schedule drives how many reps make a habit, so re-derive the target if the
  // days changed.
  if (chore.habit_enabled && recurring !== chore.recurring) {
    db.prepare('UPDATE chores SET mastery_reps=? WHERE id=?')
      .run(masteryRepsFor(recurring, settings().masteryDays), req.params.id)
  }
  res.json({ ok: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE chores SET active=0 WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
