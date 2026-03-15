import { useState } from 'react'
import { completeChore, uncompleteChore, createShoutout, deleteShoutout } from '../api'

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function recurringLabel(recurring) {
  if (recurring === 'daily') return 'Daily'
  if (recurring === 'weekdays') return 'Weekdays'
  if (recurring === 'weekly') return 'Weekly'
  const nums = recurring.split(',').map(Number).sort((a,b)=>a-b)
  if (nums.length === 7) return 'Daily'
  if (nums.length === 5 && nums.join(',') === '1,2,3,4,5') return 'Weekdays'
  return nums.map(n => DAY_NAMES[n]).join(', ')
}

function burst(color) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const palette = [color, '#FFD700', '#FF69B4', '#00CED1', '#ffffff']
  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.4,
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * 4 + 1,
    color: palette[Math.floor(Math.random() * palette.length)],
    w: Math.random() * 10 + 6,
    h: Math.random() * 6 + 4,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.15,
  }))
  let raf
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rotV
      if (p.y < canvas.height + 20) alive = true
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (alive) raf = requestAnimationFrame(draw)
    else { cancelAnimationFrame(raf); canvas.remove() }
  }
  draw()
}

export default function KidColumn({ kid, chores, awards, shoutouts, selectedDate, onRefresh, showToast }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const done = chores.filter(c => c.done)
  const todo = chores.filter(c => !c.done)

  const handleComplete = async (chore) => {
    const res = await completeChore(chore.id, selectedDate)
    if (res.ok) {
      burst(kid.color)
      showToast(`+${chore.points} pts for ${kid.name}!`)
      onRefresh()
    }
  }

  const handleUncomplete = async (chore) => {
    const res = await uncompleteChore(chore.id, selectedDate)
    if (res.ok) {
      showToast(`-${chore.points} pts from ${kid.name}`)
      onRefresh()
    }
  }

  const handleAddShoutout = async () => {
    if (!text.trim()) return
    await createShoutout({ kid_id: kid.id, description: text.trim(), date: selectedDate })
    setText('')
    setAdding(false)
    onRefresh()
  }

  const handleDeleteShoutout = async (id) => {
    await deleteShoutout(id)
    onRefresh()
  }

  return (
    <div style={{ background:'var(--cb-surface)', borderRadius:12, border:'1px solid var(--cb-border)', overflow:'hidden' }}>
      <div style={{ padding:'18px 20px', background: kid.color + '22', borderBottom:'1px solid var(--cb-border)', display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background: kid.color + '33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, flexShrink:0 }}>{kid.emoji}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:22, fontWeight:600, color:'var(--cb-text)' }}>{kid.name}</div>
          <div style={{ fontSize:15, color:'var(--cb-text-sub)', marginTop:4 }}>
            {done.length}/{chores.length} done &nbsp;
            <span style={{ background: kid.color + '33', color: kid.color, padding:'3px 10px', borderRadius:20, fontSize:14, fontWeight:600 }}>{kid.points} pts</span>
          </div>
        </div>
        <button
          onClick={() => { setAdding(v => !v); setText('') }}
          title="Add a shoutout"
          style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${kid.color}`, background: adding ? kid.color : 'transparent', color: adding ? '#fff' : kid.color, fontSize:26, lineHeight:1, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:0 }}
        >+</button>
      </div>

      {adding && (
        <div style={{ padding:'10px 12px', background:'var(--cb-surface2)', borderBottom:'1px solid var(--cb-border)' }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddShoutout(); if (e.key === 'Escape') { setAdding(false); setText('') } }}
            placeholder={`What did you do, ${kid.name}? ⭐`}
            autoFocus
            style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--cb-border)', background:'var(--cb-surface)', color:'var(--cb-text)', fontSize:15, boxSizing:'border-box', outline:'none' }}
          />
          <div style={{ display:'flex', gap:8, marginTop:6, justifyContent:'flex-end' }}>
            <button
              onClick={() => { setAdding(false); setText('') }}
              style={{ padding:'7px 12px', borderRadius:8, border:'1px solid var(--cb-border)', background:'transparent', color:'var(--cb-text-sub)', fontSize:14, cursor:'pointer' }}
            >Cancel</button>
            <button
              onClick={handleAddShoutout}
              style={{ padding:'7px 16px', borderRadius:8, border:'none', background: kid.color, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}
            >Add</button>
          </div>
        </div>
      )}

      <div style={{ padding:'10px 12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {awards && awards.map(a => (
          <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--cb-award-bg)', border:'1px solid #7F77DD55', borderRadius:10 }}>
            <span style={{ fontSize:26, flexShrink:0 }}>🏆</span>
            <div>
              <div style={{ fontSize:13, color:'#7F77DD', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Special Prize Awarded!</div>
              <div style={{ fontSize:16, color:'var(--cb-text)', marginTop:2 }}>{a.reward_name}</div>
            </div>
          </div>
        ))}

        {shoutouts && shoutouts.length > 0 && (
          <>
            <div style={{ fontSize:12, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, padding:'6px 4px' }}>Shoutouts</div>
            {shoutouts.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background: kid.color + '11', border:`1px solid ${kid.color}33`, borderRadius:10 }}>
                <span style={{ fontSize:22, flexShrink:0 }}>⭐</span>
                <div style={{ flex:1, fontSize:16, color:'var(--cb-text)', fontWeight:500 }}>{s.description}</div>
                {s.awarded_points > 0
                  ? <span style={{ background: kid.color + '33', color: kid.color, padding:'3px 10px', borderRadius:20, fontSize:14, fontWeight:700, flexShrink:0 }}>+{s.awarded_points} pts</span>
                  : <button onClick={() => handleDeleteShoutout(s.id)} title="Remove" style={{ background:'none', border:'none', color:'var(--cb-text-faint)', fontSize:16, cursor:'pointer', padding:'0 4px', lineHeight:1, flexShrink:0 }}>×</button>
                }
              </div>
            ))}
          </>
        )}

        {todo.length > 0 && <div style={{ fontSize:12, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, padding:'6px 4px' }}>To do</div>}
        {todo.map(chore => (
          <div key={chore.id} onClick={() => handleComplete(chore)}
            style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px', background:'var(--cb-surface2)', borderRadius:10, cursor:'pointer', border:'1px solid var(--cb-border)', userSelect:'none' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', border:`3px solid ${kid.color}66`, flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:22, color:'var(--cb-text)', fontWeight:700 }}>{chore.name}</div>
              <div style={{ fontSize:16, color:'var(--cb-text-muted)', marginTop:3 }}><span style={{ color: kid.color, fontWeight:700 }}>{chore.points} pts</span> · {recurringLabel(chore.recurring)}</div>
            </div>
            {chore.streak >= 2 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:20 }}>🔥</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#D85A30' }}>{chore.streak}</span>
              </div>
            )}
          </div>
        ))}

        {done.length > 0 && <div style={{ fontSize:12, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, padding:'6px 4px' }}>Done</div>}
        {done.map(chore => (
          <div key={chore.id} onClick={() => handleUncomplete(chore)}
            style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px', background:'var(--cb-surface2)', borderRadius:10, border:'1px solid var(--cb-border)', opacity:0.55, cursor:'pointer', userSelect:'none' }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background: kid.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#fff', flexShrink:0 }}>✓</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:22, color:'var(--cb-text-dim)', fontWeight:700, textDecoration:'line-through' }}>{chore.name}</div>
              <div style={{ fontSize:16, color:'var(--cb-text-faint)', marginTop:3 }}>{chore.points} pts · {recurringLabel(chore.recurring)}</div>
            </div>
            {chore.streak >= 2 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:20 }}>🔥</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#D85A30' }}>{chore.streak}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
