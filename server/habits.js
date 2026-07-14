// Habit engine: mastery decay, streaks, and habit health.
//
// Everything here is derived from the completions table -- nothing is cached in
// a counter column -- so a parent unchecking a chore, a backdated completion, or
// a server that was offline for a week all stay consistent automatically.
//
// Three separate forces, deliberately kept apart:
//   mastery  ratchets up with reps and never comes back down. It pulls the
//            chore's value down toward the floor as the habit forms.
//   streak   is the reversible part: it halves on a missed occurrence and is
//            re-earned by showing up. It scales the decayed value.
//   health   is a rolling adherence gauge over the last two weeks of scheduled
//            occurrences. It drives the lifecycle (wilted -> dead), not the payout.

const MS_PER_DAY = 86400000

const STREAK_FULL = 7          // occurrences to reach full value
const STREAK_FLOOR = 0.7       // value multiplier with no streak at all
const HEALTH_WINDOW_DAYS = 14  // adherence window, also the wilt deadline
const WILT_DAYS = 14           // untouched this long -> health 0, still revivable
const DEATH_DAYS = 21          // untouched this long -> dead, cannot be completed
const MAX_LOOKBACK_DAYS = 400  // bound on how far back we ever walk

const toDate = s => new Date(s + 'T12:00:00')
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

function today() { return fmtDate(new Date()) }
function addDays(dateStr, n) {
  const d = toDate(dateStr)
  d.setDate(d.getDate() + n)
  return fmtDate(d)
}
function daysBetween(from, to) { return Math.round((toDate(to) - toDate(from)) / MS_PER_DAY) }
function maxDate(...dates) {
  return dates.filter(Boolean).sort().pop() || null
}
function dowForDate(dateStr) { return toDate(dateStr).getDay() }

function choreIsActiveOnDow(recurring, dow) {
  if (recurring === 'daily') return true
  if (recurring === 'weekdays') return dow >= 1 && dow <= 5
  if (recurring === 'weekly') return dow === 1
  return recurring.split(',').map(Number).includes(dow)
}

// Every date the chore was scheduled on, inclusive, oldest first.
function scheduledDates(recurring, from, to) {
  const out = []
  if (daysBetween(from, to) < 0) return out
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) {
    if (choreIsActiveOnDow(recurring, dowForDate(d))) out.push(d)
  }
  return out
}

function occurrencesInDays(recurring, days) {
  let n = 0
  for (let i = 0; i < days; i++) if (choreIsActiveOnDow(recurring, i % 7)) n++
  return n
}

// How many completions constitute "habit formed", normalized across schedules:
// masteryDays of calendar time, expressed in scheduled occurrences.
function masteryRepsFor(recurring, masteryDays) {
  return Math.max(5, occurrencesInDays(recurring, masteryDays))
}

function healthWindow(recurring) {
  return Math.max(2, occurrencesInDays(recurring, HEALTH_WINDOW_DAYS))
}

// Two clocks, deliberately separate.
//
// Mastery counts reps from the day decay was switched on, and only a parent's
// explicit restart ever moves it. Reviving a dead habit must NOT reset this: if it
// did, a kid could let a mature chore die for three weeks to get its full value back.
function masteryStart(chore) {
  return chore.decay_start_date || today()
}

// Health, streak, and the idle timer, by contrast, start fresh on revival -- a habit
// that comes back from the dead starts at zero streak and full health, and isn't
// instantly re-killed by the gap it just sat through.
function activityStart(chore) {
  return maxDate(chore.decay_start_date, chore.revived_at) || today()
}

function windowStart(chore, asOf) {
  return maxDate(activityStart(chore), addDays(asOf, -MAX_LOOKBACK_DAYS))
}

// Today doesn't count as a miss until the day is over, so the streak and health
// gauges hold steady on an as-yet-uncompleted chore instead of dipping at midnight.
function anchorDate(chore, doneSet, asOf) {
  const scheduledToday = choreIsActiveOnDow(chore.recurring, dowForDate(asOf))
  if (scheduledToday && !doneSet.has(asOf)) return addDays(asOf, -1)
  return asOf
}

// Streak halves on a miss rather than resetting, so one bad day doesn't erase a
// month and a young kid can climb back in a few days.
function foldStreak(chore, doneSet, asOf, through) {
  let streak = 0
  for (const d of scheduledDates(chore.recurring, windowStart(chore, asOf), through)) {
    streak = doneSet.has(d) ? streak + 1 : Math.floor(streak / 2)
  }
  return streak
}

// The streak a completion on `date` earns, including that completion itself: a
// first-ever completion is a streak of 1, not 0.
function streakForCompletion(chore, doneSet, date) {
  return foldStreak(chore, doneSet, date, addDays(date, -1)) + 1
}

// Of the last N scheduled occurrences, how many were done? A chore too young to
// fill the window is judged only on the occurrences it has actually had.
function computeHealth(chore, doneSet, asOf) {
  const anchor = anchorDate(chore, doneSet, asOf)
  const dates = scheduledDates(chore.recurring, windowStart(chore, asOf), anchor)
  const win = dates.slice(-healthWindow(chore.recurring))
  if (win.length === 0) return 100
  const done = win.filter(d => doneSet.has(d)).length
  return Math.round(100 * done / win.length)
}

// Days since the habit was last fed -- by a completion, or by being started/revived.
function idleDays(chore, completionDates, asOf) {
  const last = completionDates.length ? completionDates[completionDates.length - 1] : null
  const ref = maxDate(activityStart(chore), last)
  return Math.max(0, daysBetween(ref, asOf))
}

function lifecycleState(chore, completionDates, asOf) {
  const idle = idleDays(chore, completionDates, asOf)
  if (idle >= DEATH_DAYS) return 'dead'
  if (idle >= WILT_DAYS) return 'wilted'
  return 'alive'
}

function completionsSince(completionDates, start) {
  return completionDates.filter(d => d >= start).length
}

// payout = decayed base * streak factor.
// The streak factor is a penalty you avoid rather than a bonus you stack, which
// keeps the value curve monotonically declining as the habit matures.
function computeValue(chore, { reps, streak }) {
  if (!chore.habit_enabled) return chore.points
  const masteryReps = chore.mastery_reps || masteryRepsFor(chore.recurring, 60)
  const floor = (chore.floor_pct ?? 40) / 100
  const mastery = Math.min(reps / masteryReps, 1)
  const decayed = chore.points * (1 - (1 - floor) * mastery)
  const factor = STREAK_FLOOR + (1 - STREAK_FLOOR) * Math.min(streak / STREAK_FULL, 1)
  return Math.max(1, Math.round(decayed * factor))
}

// Everything the board and the endpoints need to know about one chore on one day.
// `completionDates` must be sorted ascending and belong to this chore only.
function snapshot(chore, completionDates, asOf) {
  const doneSet = new Set(completionDates)
  const anchor = anchorDate(chore, doneSet, asOf)

  const reps = chore.habit_enabled ? completionsSince(completionDates, masteryStart(chore)) : 0
  const masteryReps = chore.mastery_reps || masteryRepsFor(chore.recurring, 60)
  const streak = foldStreak(chore, doneSet, asOf, anchor)

  return {
    streak,
    reps,
    mastery_reps: masteryReps,
    mastery: chore.habit_enabled ? Math.min(reps / masteryReps, 1) : 0,
    health: chore.habit_enabled ? computeHealth(chore, doneSet, asOf) : 100,
    lifecycle: chore.habit_enabled ? lifecycleState(chore, completionDates, asOf) : 'alive',
    idle_days: chore.habit_enabled ? idleDays(chore, completionDates, asOf) : 0,
    // Value shown on the board is what completing it right now would pay, which
    // means the streak that completion would earn -- not the streak carried today.
    value: computeValue(chore, {
      reps,
      streak: doneSet.has(asOf) ? streak : streak + 1,
    }),
  }
}

module.exports = {
  STREAK_FULL, STREAK_FLOOR, WILT_DAYS, DEATH_DAYS,
  today, addDays, daysBetween, fmtDate,
  choreIsActiveOnDow, scheduledDates, occurrencesInDays,
  masteryRepsFor, healthWindow, masteryStart, activityStart,
  foldStreak, streakForCompletion, computeHealth, computeValue,
  idleDays, lifecycleState, completionsSince, snapshot,
}
