// Two indicators that must read differently at a glance:
//   mastery -- a bar that fills up. Permanent, earned, a good thing.
//   health  -- a gauge that drains and refills. Reversible, a warning.
// The chore's point value quietly follows mastery down; we never show it as a cut.

export const HEALTH_STATES = [
  { min: 90, label: 'Thriving', icon: '🌳', color: '#1D9E75' },
  { min: 70, label: 'Healthy',  icon: '🌿', color: '#639922' },
  { min: 40, label: 'Wobbly',   icon: '🌱', color: '#BA7517' },
  { min: 1,  label: 'Wilting',  icon: '🍂', color: '#D85A30' },
  { min: 0,  label: 'Wilted',   icon: '🥀', color: '#E24B4A' },
]

export function healthMeta(health) {
  return HEALTH_STATES.find(s => health >= s.min) || HEALTH_STATES[HEALTH_STATES.length - 1]
}

// A brand-new habit gets a grace period. Its first week we don't judge adherence at
// all -- an untouched-but-freshly-planted habit computes health 0 and would otherwise
// look like it's already dying. Instead it shows a seed while it's getting off the
// ground and a sprout once it's been done a few times, then hands off to the health
// gauge once there's enough history to judge it fairly.
const GRACE_DAYS = 7    // week one: always a seed, no matter what
const SPROUT_REPS = 3   // done this many times -> it's taken root (a sprout)
const ESTABLISHED_REPS = 5  // enough traction to be judged on health from here on

const daysSince = (dateStr) => {
  if (!dateStr) return Infinity
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00:00')) / 86400000)
}

// The growth badge shown in place of the health gauge while a habit is young, or
// null once it should be judged on health like a mature habit.
export function growthMeta(chore) {
  const age = daysSince(chore.decay_start_date)
  const reps = chore.reps || 0
  if (age < GRACE_DAYS && reps < SPROUT_REPS) {
    return { label: 'New', icon: '🌰', color: '#7F77DD', tip: 'Brand-new habit — the first week is a grace period, so it won\'t wilt yet' }
  }
  if (reps >= SPROUT_REPS && reps < ESTABLISHED_REPS) {
    return { label: 'Growing', icon: '🌱', color: '#639922', tip: 'Taking root — keep it up and it\'ll be an established habit' }
  }
  return null
}

export default function HabitMeter({ chore, color, compact = false }) {
  if (!chore.habit_enabled) return null

  const mastered = !!chore.mastered_at
  const growth = mastered ? null : growthMeta(chore)
  const meta = healthMeta(chore.health)
  const pct = Math.round((chore.mastery || 0) * 100)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <span style={{ fontSize:12, fontWeight:700, color: mastered ? '#BA7517' : 'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:0.5 }}>
            {mastered ? '🏆 Mastered' : 'Habit'}
          </span>
          {!mastered && !compact && (
            <span style={{ fontSize:12, color:'var(--cb-text-faint)' }}>{chore.reps}/{chore.mastery_reps}</span>
          )}
        </div>
        <div style={{ height:6, borderRadius:3, background:'var(--cb-border)', overflow:'hidden' }}>
          <div style={{ width:`${mastered ? 100 : pct}%`, height:'100%', borderRadius:3, background: mastered ? '#BA7517' : color, transition:'width 0.3s' }} />
        </div>
      </div>

      {growth ? (
        <div title={growth.tip}
          style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, padding:'3px 8px', borderRadius:20, background: growth.color + '1f', border:`1px solid ${growth.color}55` }}>
          <span style={{ fontSize:13, lineHeight:1 }}>{growth.icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color: growth.color }}>{growth.label}</span>
        </div>
      ) : (
        <div title={`Habit health: ${meta.label} (${chore.health}%)`}
          style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, padding:'3px 8px', borderRadius:20, background: meta.color + '1f', border:`1px solid ${meta.color}55` }}>
          <span style={{ fontSize:13, lineHeight:1 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color: meta.color }}>{chore.health}</span>
        </div>
      )}
    </div>
  )
}
