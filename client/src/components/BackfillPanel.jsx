import { useState, useEffect } from 'react'
import { getChores, completeChore, uncompleteChore } from '../api'

// Mirrors ADMIN_BACKFILL_DAYS on the server, which is what actually enforces it.
const BACKFILL_DAYS = 30

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const daysAgoStr = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateStr(d)
}

const dayLabel = (n, dateStr) => {
  if (n === 0) return 'Today'
  if (n === 1) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Lets a parent tick off chores a kid did but forgot to mark, on any day in the
// last two weeks -- further back than the board itself allows.
export default function BackfillPanel({ kids, adminPin, formatPoints, onRefresh, showToast }) {
  const [kidId, setKidId] = useState('')
  const [date, setDate] = useState(daysAgoStr(1))
  const [chores, setChores] = useState([])
  const [busy, setBusy] = useState(false)

  const load = () => getChores(date).then(setChores)
  useEffect(() => { load() }, [date])

  const kid = kids.find(k => String(k.id) === kidId)
  const kidChores = kid ? chores.filter(c => c.kid_id === kid.id) : []

  const toggle = async (chore) => {
    if (busy) return
    setBusy(true)
    try {
      const res = chore.done
        ? await uncompleteChore(chore.id, date, adminPin)
        : await completeChore(chore.id, date, adminPin)
      if (res.ok) {
        // Editing a past day can ripple into later streak pay and weekly bonuses.
        const ripple = (res.later_adjustment || 0) + (res.bonus_adjustment || 0)
        const rippleText = ripple ? ` (${ripple > 0 ? '+' : '-'}${formatPoints(Math.abs(ripple))} later days & bonuses)` : ''
        showToast((chore.done
          ? `-${formatPoints(res.points_removed)} from ${kid.name}`
          : `+${formatPoints(res.points_awarded)} for ${kid.name}`) + rippleText)
        await load()
        onRefresh()
      } else if (res.error) {
        showToast(res.error)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:600 }}>Backfill completed chores</div>
      <div style={{ fontSize:14, color:'var(--cb-text-muted)', marginTop:-6 }}>Check off chores that were done but not marked, up to {BACKFILL_DAYS} days back.</div>

      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {kids.map(k => {
          const active = kidId === String(k.id)
          return (
            <button key={k.id} type="button" onClick={() => setKidId(String(k.id))}
              style={{ padding:'10px 14px', borderRadius:8, border:'none', background: active?'#7F77DD':'var(--cb-border)', color: active?'#ffffff':'var(--cb-text-faint)', fontSize:15, fontWeight:700, cursor:'pointer', opacity: active?1:0.6 }}>
              {k.emoji} {k.name}
            </button>
          )
        })}
      </div>

      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
        {Array.from({ length: BACKFILL_DAYS + 1 }, (_, n) => {
          const d = daysAgoStr(n)
          const active = d === date
          return (
            <button key={d} type="button" onClick={() => setDate(d)}
              style={{ padding:'8px 12px', borderRadius:8, border:`2px solid ${active?'#7F77DD':'var(--cb-border2)'}`, background: active?'#7F77DD22':'var(--cb-surface)', color: active?'#7F77DD':'var(--cb-text-sub)', fontSize:14, fontWeight: active?700:500, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              {dayLabel(n, d)}
            </button>
          )
        })}
      </div>

      {!kid ? (
        <div style={{ fontSize:15, color:'var(--cb-text-faint)' }}>Pick a kid to see their chores for that day.</div>
      ) : kidChores.length === 0 ? (
        <div style={{ fontSize:15, color:'var(--cb-text-faint)' }}>No chores scheduled for {kid.name} that day.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {kidChores.map(c => (
            <button key={c.id} type="button" onClick={() => toggle(c)} disabled={busy}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, border:'1px solid var(--cb-border)', background:'var(--cb-surface)', cursor: busy ? 'default' : 'pointer', textAlign:'left' }}>
              <span style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff', background: c.done ? kid.color : 'transparent', border: c.done ? 'none' : `3px solid ${kid.color}66`, boxSizing:'border-box' }}>{c.done ? '✓' : ''}</span>
              <span style={{ flex:1, fontSize:16, fontWeight:600, color: c.done ? 'var(--cb-text-dim)' : 'var(--cb-text)', textDecoration: c.done ? 'line-through' : 'none' }}>{c.name}</span>
              <span style={{ fontSize:14, color:'var(--cb-text-muted)', flexShrink:0 }}>{formatPoints(c.points)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
