import { useState, useEffect } from 'react'
import { createKid, updateKid, deleteKid, createChore, deleteChore, createReward, updateReward, deleteReward, acknowledgeRequest, rejectRequest, approveSuggestion, rejectSuggestion, updatePin, getAuditLog, updateTimezone, updateDefaultPoints, updateCurrencyMode, updateCurrencyRate, adjustKidPoints, awardShoutout, acknowledgeShoutout, deleteShoutout, setChoreHabit, resolveMastery, reviveChore, restartChore, updateHabitSettings } from '../api'
import HabitMeter from './HabitMeter'

const tzLabel = (tz) => {
  const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ''
  return `${offset.replace('GMT', 'UTC')}  ${tz.replace(/_/g, ' ')}`
}

const TIMEZONES = [
  { group: 'US & Canada', zones: ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu','America/Toronto','America/Vancouver'] },
  { group: 'Europe',      zones: ['Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid','Europe/Stockholm','Europe/Moscow'] },
  { group: 'Asia',        zones: ['Asia/Dubai','Asia/Kolkata','Asia/Bangkok','Asia/Shanghai','Asia/Tokyo','Asia/Seoul'] },
  { group: 'Pacific',     zones: ['Australia/Sydney','Australia/Perth','Pacific/Auckland'] },
]

const EMOJIS = ['🦊','🦁','🐯','🐻','🐼','🐨','🦄','🐸','🐢','🐙','🦋','🐬','🦈','🐘','🦒','🦘','🦝','🦦','🐺','🦅','🐧','🦜','🦩','🦕','🦖','🐳','🦔','🐊','🦙','🐠']
const COLORS = ['#7F77DD','#1D9E75','#D85A30','#D4537E','#378ADD','#639922','#BA7517','#E24B4A']

const TEXT_SIZES = ['small', 'medium', 'large', 'big']

export default function AdminView({ kids, allChores, rewards, requests, suggestions, pendingShoutouts, masteredChores, deadChores, habitSettings, onHabitSettingsChange, timezone, onTimezoneChange, defaultPoints, onDefaultPointsChange, currencyMode, onCurrencyModeChange, currencyRate, onCurrencyRateChange, formatPoints, textSize, onTextSizeChange, isDark, onToggleTheme, onRefresh, showToast, setView }) {
  const [tab, setTab] = useState('pending')
  const [newKid, setNewKid] = useState({ name:'', emoji:'🦊', color:'#7F77DD' })
  const [newChore, setNewChore] = useState({ kid_ids:[], name:'', points:defaultPoints, recurring:'0,1,2,3,4,5,6', habit_enabled:false })
  const [newReward, setNewReward] = useState({ name:'', points:50 })
  const [editingKid, setEditingKid] = useState(null)
  const [addingKid, setAddingKid] = useState(false)
  const [editingReward, setEditingReward] = useState(null)
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [auditLog, setAuditLog] = useState([])
  const [shoutoutPoints, setShoutoutPoints] = useState({})
  const [suggestionPoints, setSuggestionPoints] = useState({})

  useEffect(() => {
    if (tab === 'log') getAuditLog().then(setAuditLog)
  }, [tab])

  const addKid = async () => {
    if (!newKid.name) return
    await createKid(newKid); onRefresh(); showToast('Kid added!')
    setNewKid({ name:'', emoji:'🦊', color:'#7F77DD' })
  }

  const saveKid = async () => {
    if (!editingKid.name) return
    await updateKid(editingKid.id, { name: editingKid.name, emoji: editingKid.emoji, color: editingKid.color })
    onRefresh(); showToast('Saved!'); setEditingKid(null)
  }

  const addChore = async () => {
    if (!newChore.kid_ids.length || !newChore.name) return
    await Promise.all(newChore.kid_ids.map(kid_id => createChore({ ...newChore, kid_id })))
    onRefresh(); showToast('Chore added!')
    setNewChore({ kid_ids:[], name:'', points:defaultPoints, recurring:'0,1,2,3,4,5,6', habit_enabled:false })
  }

  const toggleHabit = async (chore) => {
    const enabled = !chore.habit_enabled
    const res = await setChoreHabit(chore.id, { enabled })
    if (res.ok) {
      onRefresh()
      showToast(enabled ? `"${chore.name}" is now a tracked habit` : `Habit tracking off for "${chore.name}"`)
    }
  }

  const saveHabitSettings = async (patch) => {
    const next = { ...habitSettings, ...patch }
    const res = await updateHabitSettings(patch)
    if (res.ok) { onHabitSettingsChange(next); showToast('Habit settings updated!') }
    else showToast(res.error || 'Invalid value')
  }

  const saveReward = async () => {
    if (!editingReward.name) return
    await updateReward(editingReward.id, { name: editingReward.name, points: editingReward.points })
    onRefresh(); showToast('Saved!'); setEditingReward(null)
  }

  const addReward = async () => {
    if (!newReward.name) return
    await createReward(newReward); onRefresh(); showToast('Reward added!')
    setNewReward({ name:'', points:50 })
  }

  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(newPin)) { showToast('PIN must be 4 digits'); return }
    const res = await updatePin(newPin)
    if (res.ok) { showToast('PIN updated!'); setPinSaved(true); setNewPin('') }
    else showToast(res.error || 'Failed to update PIN')
  }

  const [pointsKidId, setPointsKidId] = useState('')
  const [pointsDelta, setPointsDelta] = useState(defaultPoints)
  const [pointsReason, setPointsReason] = useState('')

  const applyPoints = async (sign) => {
    if (!pointsKidId) return
    const delta = sign * (parseInt(pointsDelta) || 0)
    if (delta === 0) return
    const res = await adjustKidPoints(pointsKidId, { delta, reason: pointsReason || undefined })
    if (res.ok) { onRefresh(); showToast(`${delta > 0 ? '+' : ''}${formatPoints(delta)} applied!`); setPointsReason('') }
  }

  const tabs = ['kids', 'chores', 'habits', 'rewards', 'points', 'settings', 'log']

  return (
    <div>
      <div style={{ display:'flex', gap:0, padding:'0 16px', background:'var(--cb-header)', borderBottom:'1px solid var(--cb-border)', overflowX:'auto' }}>
        {tabs.map(t => (
          <div key={t} onClick={() => setTab(t)}
            style={{ padding:'16px 20px', fontSize:17, fontWeight: tab===t?700:400, color: tab===t?'#7F77DD':'var(--cb-text-muted)', borderBottom:`3px solid ${tab===t?'#7F77DD':'transparent'}`, cursor:'pointer', textTransform:'capitalize', whiteSpace:'nowrap', position:'relative' }}>
            {t === 'points' && currencyMode === 'dollars' ? 'money' : t}
            {t==='rewards'&&(requests.length>0||suggestions.length>0)&&<span style={{ position:'absolute', top:10, right:6, width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
            {t==='points'&&pendingShoutouts.length>0&&<span style={{ position:'absolute', top:10, right:6, width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
            {t==='habits'&&masteredChores.length>0&&<span style={{ position:'absolute', top:10, right:6, width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
          </div>
        ))}
        <div style={{ marginLeft:'auto', padding:'10px 0', flexShrink:0 }}>
          <button onClick={() => setView('board')} style={{ padding:'10px 22px', borderRadius:8, border:'1px solid var(--cb-border2)', background:'var(--cb-surface2)', color:'var(--cb-text-sub)', fontSize:16, fontWeight:600, cursor:'pointer' }}>Done</button>
        </div>
      </div>

      <div style={{ padding:16 }}>

        {tab === 'kids' && (
          <div>
            {kids.map(k => (
              <div key={k.id}>
                {editingKid?.id === k.id ? (
                  <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, marginBottom:10, display:'flex', flexDirection:'column', gap:12 }}>
                    <input value={editingKid.name} onChange={e=>setEditingKid({...editingKid,name:e.target.value})} placeholder="Name" style={inputStyle} />
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {EMOJIS.map(e=>(
                        <button key={e} onClick={()=>setEditingKid({...editingKid,emoji:e})}
                          style={{ fontSize:28, background: editingKid.emoji===e?'var(--cb-border2)':'transparent', border:`1px solid ${editingKid.emoji===e?'var(--cb-text-muted)':'transparent'}`, borderRadius:8, padding:'6px 8px', cursor:'pointer' }}>{e}</button>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {COLORS.map(c=>(
                        <div key={c} onClick={()=>setEditingKid({...editingKid,color:c})}
                          style={{ width:36, height:36, borderRadius:'50%', background:c, cursor:'pointer', outline: editingKid.color===c?`3px solid ${c}`:'none', outlineOffset:3 }} />
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={saveKid} style={{ ...addBtnStyle, flex:1 }}>Save</button>
                      <button onClick={()=>setEditingKid(null)} style={{ flex:1, padding:'12px 0', background:'var(--cb-border)', border:'none', borderRadius:8, color:'var(--cb-text-sub)', fontSize:17, cursor:'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:12, padding:'16px 20px', marginBottom:10, gap:14 }}>
                    <span style={{ fontSize:28, flexShrink:0, lineHeight:1 }}>{k.emoji}</span>
                    <span style={{ flex:1, fontSize:20, color:'var(--cb-text)', fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.name}</span>
                    <span style={{ fontSize:17, color:'#7F77DD', fontWeight:600, marginRight:10, flexShrink:0, whiteSpace:'nowrap' }}>{formatPoints(k.points)}</span>
                    <button onClick={()=>setEditingKid({id:k.id,name:k.name,emoji:k.emoji,color:k.color})}
                      style={{ background:'none', border:'none', color:'#7F77DD', cursor:'pointer', fontSize:22, padding:'0 8px' }}>✎</button>
                    <button onClick={async()=>{await deleteKid(k.id);onRefresh()}}
                      style={{ background:'none', border:'none', color:'var(--cb-text-dim)', cursor:'pointer', fontSize:22, padding:'0 8px' }}>&#x2715;</button>
                  </div>
                )}
              </div>
            ))}
            {!addingKid ? (
              <button onClick={() => setAddingKid(true)} style={{ marginTop:18, width:'100%', padding:'14px 0', background:'var(--cb-surface2)', border:'2px dashed var(--cb-border2)', borderRadius:12, color:'var(--cb-text-muted)', fontSize:17, fontWeight:600, cursor:'pointer' }}>+ Add Kid</button>
            ) : (
              <div style={{ marginTop:18, background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:600 }}>Add kid</div>
                <input value={newKid.name} onChange={e=>setNewKid({...newKid,name:e.target.value})} placeholder="Name" style={inputStyle} autoFocus />
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {EMOJIS.map(e=>(
                    <button key={e} onClick={()=>setNewKid({...newKid,emoji:e})}
                      style={{ fontSize:28, background: newKid.emoji===e?'var(--cb-border2)':'transparent', border:`1px solid ${newKid.emoji===e?'var(--cb-text-muted)':'transparent'}`, borderRadius:8, padding:'6px 8px', cursor:'pointer' }}>{e}</button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {COLORS.map(c=>(
                    <div key={c} onClick={()=>setNewKid({...newKid,color:c})}
                      style={{ width:36, height:36, borderRadius:'50%', background:c, cursor:'pointer', outline: newKid.color===c?`3px solid ${c}`:'none', outlineOffset:3 }} />
                  ))}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={async () => { await addKid(); setAddingKid(false) }} style={{ ...addBtnStyle, flex:1 }}>Add Kid</button>
                  <button onClick={() => { setAddingKid(false); setNewKid({ name:'', emoji:'🦊', color:'#7F77DD' }) }} style={{ flex:1, padding:'14px 0', background:'var(--cb-border)', border:'none', borderRadius:8, color:'var(--cb-text-sub)', fontSize:17, cursor:'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'chores' && (
          <div>
            {kids.map(kid => (
              <div key={kid.id} style={{ marginBottom:24 }}>
                <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>{kid.emoji} {kid.name}</div>
                {allChores.filter(c=>c.kid_id===kid.id).map(c=>(
                  <div key={c.id} style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:10, padding:'14px 18px', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center' }}>
                      <span style={{ flex:1, fontSize:18, color:'var(--cb-text)', fontWeight:600, minWidth:0 }}>
                        {c.name}
                        {c.state === 'dead' && <span style={{ marginLeft:8, fontSize:13, color:'#E24B4A', fontWeight:700 }}>💀 dead</span>}
                      </span>
                      <span style={{ fontSize:15, color:'var(--cb-text-muted)', marginRight:12, flexShrink:0 }}>{formatPoints(c.points)} · {recurringLabel(c.recurring)}</span>
                      <button onClick={() => toggleHabit(c)} title={c.habit_enabled ? 'Stop tracking as a habit' : 'Track as a habit (value decays as it becomes routine)'}
                        style={{ padding:'6px 10px', marginRight:6, borderRadius:20, border:`1px solid ${c.habit_enabled ? '#1D9E75' : 'var(--cb-border2)'}`, background: c.habit_enabled ? '#1D9E7522' : 'transparent', color: c.habit_enabled ? '#1D9E75' : 'var(--cb-text-dim)', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                        🌱 Habit {c.habit_enabled ? 'on' : 'off'}
                      </button>
                      <button onClick={async()=>{await deleteChore(c.id);onRefresh()}}
                        style={{ background:'none', border:'none', color:'var(--cb-text-dim)', cursor:'pointer', fontSize:22, flexShrink:0 }}>&#x2715;</button>
                    </div>
                    {c.habit_enabled && <HabitMeter chore={c} color={kid.color} />}
                  </div>
                ))}
                {allChores.filter(c=>c.kid_id===kid.id).length === 0 && (
                  <div style={{ fontSize:16, color:'var(--cb-text-faint)', padding:'8px 0' }}>No chores yet.</div>
                )}
              </div>
            ))}
            <div style={{ marginTop:8, background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:600 }}>Add chore</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {kids.map(k => {
                  const active = newChore.kid_ids.includes(String(k.id))
                  return (
                    <button key={k.id} type="button" onClick={() => {
                      const ids = newChore.kid_ids
                      setNewChore({...newChore, kid_ids: active ? ids.filter(x=>x!==String(k.id)) : [...ids, String(k.id)]})
                    }}
                      style={{ padding:'10px 14px', borderRadius:8, border:'none', background: active?'#7F77DD':'var(--cb-border)', color: active?'#ffffff':'var(--cb-text-faint)', fontSize:15, fontWeight:700, cursor:'pointer', opacity: active?1:0.5 }}>
                      {k.emoji} {k.name}
                    </button>
                  )
                })}
              </div>
              <input value={newChore.name} onChange={e=>setNewChore({...newChore,name:e.target.value})} placeholder="Chore name" style={inputStyle} />
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <AmountInput points={newChore.points} onPoints={v=>setNewChore({...newChore,points:v})} currencyMode={currencyMode} currencyRate={currencyRate} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>{currencyMode === 'dollars' ? 'Reward amount' : 'Reward Points'}</span>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => {
                  const active = newChore.recurring.split(',').map(Number).includes(i)
                  return (
                    <button key={i} type="button" onClick={() => {
                      const days = newChore.recurring.split(',').map(Number)
                      const next = active ? days.filter(x=>x!==i) : [...days,i].sort((a,b)=>a-b)
                      if (next.length > 0) setNewChore({...newChore, recurring: next.join(',')})
                    }} style={{ padding:'10px 14px', borderRadius:8, border:'none', background: active?'#7F77DD':'var(--cb-border)', color: active?'#ffffff':'var(--cb-text-faint)', fontSize:15, fontWeight:700, cursor:'pointer', opacity: active?1:0.5 }}>
                      {d}
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setNewChore({...newChore, habit_enabled: !newChore.habit_enabled})}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:8, border:`2px solid ${newChore.habit_enabled ? '#1D9E75' : 'var(--cb-border2)'}`, background: newChore.habit_enabled ? '#1D9E7515' : 'var(--cb-surface)', cursor:'pointer', textAlign:'left' }}>
                <span style={{ fontSize:20 }}>🌱</span>
                <span style={{ flex:1 }}>
                  <span style={{ display:'block', fontSize:16, fontWeight:700, color: newChore.habit_enabled ? '#1D9E75' : 'var(--cb-text-sub)' }}>Track as a habit</span>
                  <span style={{ display:'block', fontSize:14, color:'var(--cb-text-muted)', marginTop:2 }}>Pays less as it becomes routine, with a bonus for mastering it</span>
                </span>
                <span style={{ width:44, height:26, borderRadius:13, background: newChore.habit_enabled ? '#1D9E75' : 'var(--cb-border2)', position:'relative', flexShrink:0 }}>
                  <span style={{ position:'absolute', top:3, left: newChore.habit_enabled ? 21 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.15s' }} />
                </span>
              </button>
              {newChore.habit_enabled && (
                <DecayPreview points={newChore.points} habitSettings={habitSettings} formatPoints={formatPoints} />
              )}
              <button onClick={addChore} style={addBtnStyle}>Add Chore</button>
            </div>
          </div>
        )}

        {tab === 'habits' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {masteredChores.length > 0 && (
              <div style={{ background:'var(--cb-surface2)', border:'1px solid #BA751566', borderRadius:12, padding:18 }}>
                <div style={{ fontSize:17, color:'#BA7517', fontWeight:700, marginBottom:4 }}>🏆 Mastered habits</div>
                <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginBottom:14 }}>
                  These are part of life now and pay their floor value. Your call on what happens next.
                </div>
                {masteredChores.map(c => (
                  <div key={c.id} style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                    <div style={{ fontSize:18, color:'var(--cb-text)', fontWeight:700 }}>{c.name}</div>
                    <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:2, marginBottom:12 }}>
                      {c.kid_emoji} {c.kid_name} · mastered {c.mastered_at} · now pays {formatPoints(Math.max(1, Math.round(c.points * habitSettings.habit_floor_pct / 100)))}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={async () => { await resolveMastery(c.id, 'keep'); onRefresh(); showToast(`Keeping "${c.name}"`) }}
                        style={{ flex:1, minWidth:110, padding:'11px 0', background:'#1D9E75', border:'none', borderRadius:8, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>Keep it</button>
                      <button onClick={async () => { await resolveMastery(c.id, 'retire'); onRefresh(); showToast(`Retired "${c.name}"`) }}
                        style={{ flex:1, minWidth:110, padding:'11px 0', background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:8, color:'var(--cb-text-sub)', fontSize:15, fontWeight:700, cursor:'pointer' }}>Retire</button>
                      <button onClick={async () => {
                          if (!confirm(`Restart "${c.name}"?\n\nThis wipes its mastery and puts it back to full value (${formatPoints(c.points)}). Only do this if you want it to be a brand-new habit again.`)) return
                          await resolveMastery(c.id, 'restart'); onRefresh(); showToast(`Restarted "${c.name}"`)
                        }}
                        style={{ flex:1, minWidth:110, padding:'11px 0', background:'transparent', border:'1px solid #BA7517', borderRadius:8, color:'#BA7517', fontSize:15, fontWeight:700, cursor:'pointer' }}>Start fresh</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {deadChores.length > 0 && (
              <div style={{ background:'var(--cb-surface2)', border:'1px solid #E24B4A55', borderRadius:12, padding:18 }}>
                <div style={{ fontSize:17, color:'#E24B4A', fontWeight:700, marginBottom:4 }}>💀 Dead habits</div>
                <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginBottom:14 }}>
                  Untouched for three weeks. Reviving brings a habit back at the value it had decayed to — dying never restores full price.
                </div>
                {deadChores.map(c => (
                  <div key={c.id} style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                    <div style={{ fontSize:18, color:'var(--cb-text)', fontWeight:700 }}>{c.name}</div>
                    <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:2, marginBottom:12 }}>
                      {c.kid_emoji} {c.kid_name} · died {c.died_at}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={async () => { await reviveChore(c.id); onRefresh(); showToast(`Revived "${c.name}"`) }}
                        style={{ flex:1, minWidth:110, padding:'11px 0', background:'#1D9E75', border:'none', borderRadius:8, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>Revive</button>
                      <button onClick={async () => {
                          if (!confirm(`Restart "${c.name}"?\n\nThis wipes its mastery and puts it back to full value (${formatPoints(c.points)}).`)) return
                          await restartChore(c.id); onRefresh(); showToast(`Restarted "${c.name}"`)
                        }}
                        style={{ flex:1, minWidth:110, padding:'11px 0', background:'transparent', border:'1px solid #BA7517', borderRadius:8, color:'#BA7517', fontSize:15, fontWeight:700, cursor:'pointer' }}>Start fresh</button>
                      <button onClick={async () => { await deleteChore(c.id); onRefresh(); showToast('Chore deleted') }}
                        style={{ flex:1, minWidth:110, padding:'11px 0', background:'transparent', border:'1px solid #E24B4A', borderRadius:8, color:'#E24B4A', fontSize:15, fontWeight:700, cursor:'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>How habits work</div>
                <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:6, lineHeight:1.5 }}>
                  A tracked chore pays full value at first. As the kid racks up completions its value slides down to the floor
                  over {habitSettings.habit_mastery_days} days — the habit is built, so the payout shrinks. Keeping a streak
                  holds the value at the top of that band; missing halves the streak and costs about 30% until it's rebuilt.
                  Untouched for 14 days a habit wilts, and at 21 days it dies.
                </div>
              </div>

              <HabitSetting label="Habit forms after" suffix="days"
                value={habitSettings.habit_mastery_days} min={7} max={365}
                onCommit={v => saveHabitSettings({ habit_mastery_days: v })}
                hint="How long a habit takes to fully form. New chores use this; existing habits keep the target they started with." />

              <HabitSetting label="Floor value" suffix="% of full price"
                value={habitSettings.habit_floor_pct} min={0} max={100}
                onCommit={v => saveHabitSettings({ habit_floor_pct: v })}
                hint="What a fully mastered chore still pays." />

              <HabitSetting label="Graduation bonus" suffix="× the chore's value"
                value={habitSettings.habit_graduation_multiplier} min={0} max={50} step={0.5}
                onCommit={v => saveHabitSettings({ habit_graduation_multiplier: v })}
                hint="One-time lump the moment a habit is mastered. Softens the drop and makes decay feel like leveling up." />

              <HabitSetting label="Weekly consistency bonus" suffix="% of the week's habit earnings"
                value={habitSettings.habit_consistency_pct} min={0} max={100}
                onCommit={v => saveHabitSettings({ habit_consistency_pct: v })}
                hint="Paid when every tracked habit ends the week healthy, as a percentage of what those habits earned that week. This is what keeps mature habits worth doing — turn it up if income feels too thin." />

              <HabitSetting label="Healthy means" suffix="% health or better"
                value={habitSettings.habit_health_threshold} min={0} max={100}
                onCommit={v => saveHabitSettings({ habit_health_threshold: v })}
                hint="The bar every habit must clear to earn the weekly consistency bonus." />
            </div>
          </div>
        )}

        {tab === 'points' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Kid shoutout review */}
            {pendingShoutouts.length > 0 && (() => {
              const kidIdsWithShoutouts = [...new Set(pendingShoutouts.map(s => s.kid_id))]
              const selectedKidShoutouts = pointsKidId ? pendingShoutouts.filter(s => s.kid_id === parseInt(pointsKidId)) : []
              return (
                <div style={{ background:'var(--cb-surface2)', border:'1px solid #7F77DD44', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ fontSize:17, color:'#7F77DD', fontWeight:700 }}>⭐ Shoutouts to review</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {kids.filter(k => kidIdsWithShoutouts.includes(k.id)).map(k => {
                      const active = pointsKidId === String(k.id)
                      const count = pendingShoutouts.filter(s => s.kid_id === k.id).length
                      return (
                        <button key={k.id} onClick={() => setPointsKidId(String(k.id))}
                          style={{ padding:'8px 14px', borderRadius:8, border:`2px solid ${active?'#7F77DD':'var(--cb-border2)'}`, background: active?'#7F77DD':'var(--cb-surface)', color: active?'#fff':'var(--cb-text)', fontSize:15, fontWeight:600, cursor:'pointer', position:'relative' }}>
                          {k.emoji} {k.name}
                          <span style={{ marginLeft:6, background:'#E24B4A', color:'#fff', borderRadius:10, fontSize:12, fontWeight:700, padding:'1px 6px' }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                  {selectedKidShoutouts.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                      {selectedKidShoutouts.map(s => {
                        const pts = shoutoutPoints[s.id] ?? defaultPoints
                        return (
                          <div key={s.id} style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <span style={{ fontSize:18, flexShrink:0 }}>⭐</span>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:16, color:'var(--cb-text)', fontWeight:500 }}>{s.description}</div>
                                <div style={{ fontSize:13, color:'var(--cb-text-faint)', marginTop:2 }}>{s.shoutout_date}</div>
                              </div>
                              <AmountInput points={pts} onPoints={v=>setShoutoutPoints(p=>({ ...p, [s.id]: v }))} currencyMode={currencyMode} currencyRate={currencyRate} width={84} />
                              <span style={{ fontSize:14, color:'var(--cb-text-muted)', flexShrink:0 }}>{currencyMode === 'dollars' ? 'to award' : 'pts'}</span>
                            </div>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={async () => {
                                const res = await awardShoutout(s.id, pts)
                                if (res.ok) { onRefresh(); showToast(`+${formatPoints(pts)} awarded!`) }
                              }} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', background:'#1D9E75', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>Award</button>
                              <button onClick={async () => {
                                const res = await acknowledgeShoutout(s.id)
                                if (res.ok) { onRefresh(); showToast('Shoutout recognized, no points') }
                              }} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid var(--cb-border2)', background:'transparent', color:'var(--cb-text-sub)', fontSize:14, fontWeight:700, cursor:'pointer' }}>No pts</button>
                              <button onClick={async () => {
                                await deleteShoutout(s.id); onRefresh(); showToast('Request rejected')
                              }} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid #E24B4A', background:'transparent', color:'#E24B4A', fontSize:14, fontWeight:700, cursor:'pointer' }}>Reject</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Manual points adjustment */}
            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:600 }}>Manual adjustment</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {kids.map(k => {
                  const active = pointsKidId === String(k.id)
                  const hasPending = pendingShoutouts.some(s => s.kid_id === k.id)
                  return (
                    <button key={k.id} type="button" onClick={() => setPointsKidId(String(k.id))}
                      style={{ padding:'10px 14px', borderRadius:8, border:'none', background: active?'#7F77DD':'var(--cb-border)', color: active?'#ffffff':'var(--cb-text-faint)', fontSize:15, fontWeight:700, cursor:'pointer', opacity: active?1:0.6, position:'relative' }}>
                      {k.emoji} {k.name}
                      <span style={{ marginLeft:8, fontWeight:400, opacity: active?1:0.7 }}>{formatPoints(k.points)}</span>
                      {hasPending && <span style={{ position:'absolute', top:4, right:4, width:7, height:7, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
                    </button>
                  )
                })}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <AmountInput points={pointsDelta} onPoints={setPointsDelta} currencyMode={currencyMode} currencyRate={currencyRate} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>{currencyMode === 'dollars' ? 'Amount' : 'Points'}</span>
              </div>
              <input value={pointsReason} onChange={e=>setPointsReason(e.target.value)} placeholder="Reason (optional)" style={inputStyle} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => applyPoints(1)}
                  style={{ flex:1, padding:'14px 0', background:'#1D9E75', border:'none', borderRadius:8, color:'#fff', fontSize:17, cursor:'pointer', fontWeight:700 }}>+ Add {currencyMode === 'dollars' ? 'Money' : 'Points'}</button>
                <button onClick={() => applyPoints(-1)}
                  style={{ flex:1, padding:'14px 0', background:'#E24B4A', border:'none', borderRadius:8, color:'#fff', fontSize:17, cursor:'pointer', fontWeight:700 }}>- Remove {currencyMode === 'dollars' ? 'Money' : 'Points'}</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <div>
            {suggestions.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:15, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Reward suggestions</div>
                {suggestions.map(s => {
                  const pts = suggestionPoints[s.id] ?? defaultPoints
                  return (
                    <div key={s.id} style={{ background:'var(--cb-surface2)', border:'1px solid #7F77DD44', borderRadius:12, padding:'16px 18px', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                        <span style={{ fontSize:22 }}>🌟</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:18, color:'var(--cb-text)', fontWeight:700 }}>{s.name}</div>
                          <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:2 }}>{s.kid_emoji} {s.kid_name}</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                        <AmountInput points={pts} onPoints={v=>setSuggestionPoints(p=>({ ...p, [s.id]: v }))} currencyMode={currencyMode} currencyRate={currencyRate} width={100} />
                        <span style={{ fontSize:15, color:'var(--cb-text-muted)' }}>{currencyMode === 'dollars' ? 'to approve' : 'pts to approve'}</span>
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        <button onClick={async () => { const res = await approveSuggestion(s.id, pts); if (res.ok) { onRefresh(); showToast(`Added "${s.name}"!`) } }}
                          style={{ flex:1, padding:'11px 0', background:'#1D9E75', border:'none', borderRadius:8, color:'#fff', fontSize:15, cursor:'pointer', fontWeight:700 }}>
                          ✓ Approve
                        </button>
                        <button onClick={async () => { await rejectSuggestion(s.id); onRefresh(); showToast('Suggestion rejected') }}
                          style={{ flex:1, padding:'11px 0', background:'var(--cb-surface)', border:'1px solid #E24B4A', borderRadius:8, color:'#E24B4A', fontSize:15, cursor:'pointer', fontWeight:700 }}>
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {requests.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:15, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Pending requests</div>
                {requests.map(r => (
                  <div key={r.id} style={{ background:'var(--cb-surface2)', border:'1px solid #7F77DD44', borderRadius:12, padding:'16px 18px', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <span style={{ fontSize:26 }}>🏆</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:18, color:'var(--cb-text)', fontWeight:700 }}>{r.reward_name}</div>
                        <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:2 }}>{r.kid_name} · {formatPoints(r.reward_points)}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={async () => { await acknowledgeRequest(r.id); onRefresh(); showToast('Prize handed out!') }}
                        style={{ flex:1, padding:'12px 0', background:'#1D9E75', border:'none', borderRadius:8, color:'#fff', fontSize:16, cursor:'pointer', fontWeight:700 }}>
                        ✓ Prize given
                      </button>
                      <button onClick={async () => { await rejectRequest(r.id); onRefresh(); showToast('Request rejected') }}
                        style={{ flex:1, padding:'12px 0', background:'var(--cb-surface)', border:'1px solid #E24B4A', borderRadius:8, color:'#E24B4A', fontSize:16, cursor:'pointer', fontWeight:700 }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rewards.map(r=>(
              <div key={r.id}>
                {editingReward?.id === r.id ? (
                  <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, marginBottom:10, display:'flex', flexDirection:'column', gap:12 }}>
                    <input value={editingReward.name} onChange={e=>setEditingReward({...editingReward,name:e.target.value})} placeholder="Reward name" style={inputStyle} />
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <AmountInput points={editingReward.points} onPoints={v=>setEditingReward({...editingReward,points:v})} currencyMode={currencyMode} currencyRate={currencyRate} />
                      <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>{currencyMode === 'dollars' ? 'Cost' : 'Points cost'}</span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={saveReward} style={{ ...addBtnStyle, flex:1 }}>Save</button>
                      <button onClick={()=>setEditingReward(null)} style={{ flex:1, padding:'12px 0', background:'var(--cb-border)', border:'none', borderRadius:8, color:'var(--cb-text-sub)', fontSize:17, cursor:'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:12, padding:'16px 20px', marginBottom:10, gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:20, color:'var(--cb-text)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize:15, color:'#7F77DD', fontWeight:700, marginTop:2 }}>{formatPoints(r.points)}</div>
                    </div>
                    <button onClick={()=>setEditingReward({id:r.id,name:r.name,points:r.points})}
                      style={{ background:'none', border:'none', color:'#7F77DD', cursor:'pointer', fontSize:22, padding:'0 8px' }}>✎</button>
                    <button onClick={async()=>{await deleteReward(r.id);onRefresh()}}
                      style={{ background:'none', border:'none', color:'var(--cb-text-dim)', cursor:'pointer', fontSize:22, padding:'0 8px' }}>&#x2715;</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop:18, background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:600 }}>Add reward</div>
              <input value={newReward.name} onChange={e=>setNewReward({...newReward,name:e.target.value})} placeholder="Reward name" style={inputStyle} />
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <AmountInput points={newReward.points} onPoints={v=>setNewReward({...newReward,points:v})} currencyMode={currencyMode} currencyRate={currencyRate} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>{currencyMode === 'dollars' ? 'Cost' : 'Points cost'}</span>
              </div>
              <button onClick={addReward} style={addBtnStyle}>Add Reward</button>
            </div>
          </div>
        )}

        {tab === 'log' && (
          <div>
            <div style={{ fontSize:15, color:'var(--cb-text-faint)', marginBottom:14 }}>Past 30 days · {auditLog.length} entries</div>
            {auditLog.length === 0 && <div style={{ color:'var(--cb-text-dim)', fontSize:18 }}>No activity yet.</div>}
            {auditLog.map(entry => {
              const d = new Date(entry.created_at)
              const opts = { timeZone: timezone }
              const todayStr = new Date().toLocaleDateString('en-US', opts)
              const entryStr = d.toLocaleDateString('en-US', opts)
              const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('en-US', opts)
              const isToday = entryStr === todayStr
              const isYesterday = entryStr === yesterdayStr
              const time = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone: timezone })
              const dateLabel = isToday ? `Today ${time}` : isYesterday ? `Yesterday ${time}` : d.toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone: timezone }) + ' ' + time
              const icon = entry.type === 'chore_complete' ? '✓' : entry.type === 'chore_uncomplete' ? '↩' : entry.type === 'prize_given' ? '🎁' : entry.type === 'points_added' ? '⬆' : entry.type === 'points_removed' ? '⬇' : '🏆'
              const iconColor = entry.type === 'chore_complete' ? '#1D9E75' : entry.type === 'chore_uncomplete' ? 'var(--cb-text-muted)' : entry.type === 'points_added' ? '#1D9E75' : entry.type === 'points_removed' ? '#E24B4A' : '#7F77DD'
              return (
                <div key={entry.id} style={{ padding:'12px 14px', background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:10, marginBottom:7 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18, color:iconColor, width:22, textAlign:'center', flexShrink:0 }}>{icon}</span>
                    <span style={{ fontSize:15, color:'var(--cb-text-sub)', fontWeight:600, flexShrink:0 }}>{entry.kid_name}</span>
                    <span style={{ fontSize:15, fontWeight:700, color: entry.points > 0 ? '#1D9E75' : '#E24B4A', whiteSpace:'nowrap', marginLeft:'auto' }}>
                      {entry.points > 0 ? '+' : ''}{formatPoints(entry.points)}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4, paddingLeft:32 }}>
                    <span style={{ fontSize:15, color:'var(--cb-text)' }}>{entry.description}</span>
                    <span style={{ fontSize:12, color:'var(--cb-text-faint)', whiteSpace:'nowrap', marginLeft:10, flexShrink:0 }}>{dateLabel}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'settings' && (
          <div>
            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>Timezone</div>
              <select value={timezone} onChange={async e => {
                const tz = e.target.value
                const res = await updateTimezone(tz)
                if (res.ok) { onTimezoneChange(tz); showToast('Timezone updated!') }
              }} style={inputStyle}>
                {TIMEZONES.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.zones.map(z => <option key={z} value={z}>{tzLabel(z)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>{currencyMode === 'dollars' ? 'Default Amount' : 'Default Points'}</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <AmountInput points={defaultPoints} onPoints={onDefaultPointsChange} currencyMode={currencyMode} currencyRate={currencyRate}
                  onCommit={async val => {
                    if (!val || val < 1) return
                    const res = await updateDefaultPoints(val)
                    if (res.ok) { onDefaultPointsChange(val); showToast('Default updated!') }
                  }} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>{currencyMode === 'dollars' ? '(used when creating chores or adjusting)' : 'points (used when creating chores or adjusting points)'}</span>
              </div>
            </div>

            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>Display Mode</div>
              <div style={{ display:'flex', gap:8 }}>
                {['points', 'dollars'].map(m => (
                  <button key={m} onClick={async () => {
                    if (currencyMode === m) return
                    const res = await updateCurrencyMode(m)
                    if (res.ok) { onCurrencyModeChange(m); showToast(`Now showing ${m}`) }
                  }} style={{ flex:1, padding:'10px 0', borderRadius:8, border:`2px solid ${currencyMode === m ? '#7F77DD' : 'var(--cb-border2)'}`, background: currencyMode === m ? '#7F77DD' : 'var(--cb-surface)', color: currencyMode === m ? '#fff' : 'var(--cb-text-sub)', fontSize:15, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                    {m}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:15, color:'var(--cb-text-muted)' }}>Currency rate</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:16, color:'var(--cb-text)' }}>100 points = $</span>
                <input type="number" step="0.01" min="0.01"
                  defaultValue={(currencyRate * 100).toFixed(2)} key={currencyRate}
                  onBlur={async e => {
                    const dollars = parseFloat(e.target.value)
                    if (!isFinite(dollars) || dollars <= 0) return
                    const newRate = dollars / 100
                    const res = await updateCurrencyRate(newRate)
                    if (res.ok) { onCurrencyRateChange(newRate); showToast('Currency rate updated!') }
                  }}
                  style={{...inputStyle, width:110}} />
              </div>
            </div>

            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>Appearance</div>
              <button onClick={onToggleTheme}
                style={{ alignSelf:'flex-start', padding:'10px 20px', borderRadius:8, border:'1px solid var(--cb-border2)', background:'var(--cb-surface)', color:'var(--cb-text)', fontSize:16, cursor:'pointer', fontWeight:600 }}>
                {isDark ? '☀️  Switch to Light Mode' : '🌙  Switch to Dark Mode'}
              </button>
            </div>

            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>Text Size</div>
              <div style={{ display:'flex', gap:8 }}>
                {TEXT_SIZES.map(size => (
                  <button key={size} onClick={() => {
                    onTextSizeChange(size); showToast(`Text size: ${size}`)
                  }} style={{ flex:1, padding:'10px 0', borderRadius:8, border:`2px solid ${textSize === size ? '#7F77DD' : 'var(--cb-border2)'}`, background: textSize === size ? '#7F77DD' : 'var(--cb-surface)', color: textSize === size ? '#fff' : 'var(--cb-text-sub)', fontSize:15, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14, marginTop:14 }}>
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>Change Admin PIN</div>
              <input type="text" inputMode="numeric" maxLength={4} value={newPin}
                onChange={e => { setPinSaved(false); setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
                placeholder="New 4-digit PIN" style={inputStyle} />
              {pinSaved && <div style={{ fontSize:16, color:'#1D9E75' }}>PIN updated successfully.</div>}
              <button onClick={handleSavePin} style={addBtnStyle}>Save PIN</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

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

const inputStyle = { padding:'13px 14px', background:'var(--cb-input-bg)', border:'1px solid var(--cb-border2)', borderRadius:8, color:'var(--cb-text)', fontSize:17, width:'100%', boxSizing:'border-box' }
const addBtnStyle = { padding:'14px 0', background:'#7F77DD', border:'none', borderRadius:8, color:'#fff', fontSize:17, cursor:'pointer', fontWeight:700 }

// Shows the parent exactly what they're signing up for before they enable decay.
// Mirrors computeValue() on the server at three points on the curve, assuming the
// kid keeps a streak going (the top of the band).
function DecayPreview({ points, habitSettings, formatPoints }) {
  const { habit_mastery_days: days, habit_floor_pct: floorPct, habit_graduation_multiplier: mult } = habitSettings
  const at = mastery => Math.max(1, Math.round(points * (1 - (1 - floorPct / 100) * mastery)))
  const steps = [
    { label: 'Day 1', value: at(0) },
    { label: `Day ${Math.round(days / 2)}`, value: at(0.5) },
    { label: `Day ${days}`, value: at(1), mastered: true },
  ]
  return (
    <div style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:8, padding:'12px 14px' }}>
      <div style={{ fontSize:13, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>What it will pay</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
        {steps.map(s => (
          <div key={s.label} style={{ flex:1, textAlign:'center' }}>
            <div style={{ fontSize:17, fontWeight:700, color: s.mastered ? '#BA7517' : 'var(--cb-text)' }}>{formatPoints(s.value)}</div>
            <div style={{ height:6, borderRadius:3, background: s.mastered ? '#BA7517' : '#7F77DD', opacity: 0.35 + 0.65 * (s.value / Math.max(1, points)), margin:'6px 0 4px' }} />
            <div style={{ fontSize:13, color:'var(--cb-text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:13, color:'var(--cb-text-muted)', marginTop:10, lineHeight:1.5 }}>
        🏆 Mastering it pays a one-time {formatPoints(Math.max(1, Math.round(points * mult)))} bonus.
        Break the streak and it pays ~30% less until it's rebuilt.
      </div>
    </div>
  )
}

// Number field that only commits on blur, so a half-typed value never hits the API.
function HabitSetting({ label, suffix, hint, value, min, max, step = 1, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:16, color:'var(--cb-text)', fontWeight:600, flex:1, minWidth:150 }}>{label}</span>
        <input type="number" min={min} max={max} step={step} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            const n = parseFloat(draft)
            if (!isFinite(n) || n < min || n > max) { setDraft(String(value)); return }
            if (n !== value) onCommit(n)
          }}
          style={{ ...inputStyle, width:90, flexShrink:0, padding:'9px 10px', fontSize:16 }} />
        <span style={{ fontSize:15, color:'var(--cb-text-muted)', flexShrink:0 }}>{suffix}</span>
      </div>
      {hint && <div style={{ fontSize:14, color:'var(--cb-text-faint)', marginTop:5, lineHeight:1.45 }}>{hint}</div>}
    </div>
  )
}

// Numeric input that shows and accepts dollars in dollars mode (with a $ prefix)
// and whole points in points mode. Always emits the stored value in points, so
// callers never deal with the conversion or do the math themselves.
function AmountInput({ points, onPoints, onCommit, currencyMode, currencyRate, width = 100 }) {
  const dollars = currencyMode === 'dollars'
  const fmt = pts => dollars ? (Number(pts || 0) * currencyRate).toFixed(2) : String(pts ?? 0)
  const parse = str => {
    const n = parseFloat(str)
    if (!isFinite(n)) return 0
    return Math.max(0, Math.round(dollars ? n / currencyRate : n))
  }
  const [draft, setDraft] = useState(() => fmt(points))
  const [focused, setFocused] = useState(false)
  // Re-sync the field from the stored value only while the user isn't typing,
  // so switching modes or external changes reformat it, but decimals type freely.
  useEffect(() => { if (!focused) setDraft(fmt(points)) }, [points, currencyMode, currencyRate, focused])
  return (
    <div style={{ position:'relative', width, flexShrink:0 }}>
      {dollars && <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--cb-text-muted)', fontSize:17, pointerEvents:'none' }}>$</span>}
      <input type="text" inputMode="decimal" value={draft}
        onFocus={() => setFocused(true)}
        onChange={e => { setDraft(e.target.value); onPoints && onPoints(parse(e.target.value)) }}
        onBlur={() => { setFocused(false); const p = parse(draft); onPoints && onPoints(p); onCommit && onCommit(p) }}
        style={{ ...inputStyle, paddingLeft: dollars ? 24 : 14 }} />
    </div>
  )
}
