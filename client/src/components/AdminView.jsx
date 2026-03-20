import { useState, useEffect } from 'react'
import { createKid, updateKid, deleteKid, createChore, deleteChore, createReward, updateReward, deleteReward, acknowledgeRequest, rejectRequest, approveSuggestion, rejectSuggestion, updatePin, getAuditLog, updateTimezone, updateDefaultPoints, adjustKidPoints, awardShoutout, acknowledgeShoutout, deleteShoutout } from '../api'

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

export default function AdminView({ kids, allChores, rewards, requests, suggestions, pendingShoutouts, timezone, onTimezoneChange, defaultPoints, onDefaultPointsChange, textSize, onTextSizeChange, onRefresh, showToast, setView }) {
  const [tab, setTab] = useState('pending')
  const [newKid, setNewKid] = useState({ name:'', emoji:'🦊', color:'#7F77DD' })
  const [newChore, setNewChore] = useState({ kid_ids:[], name:'', points:defaultPoints, recurring:'0,1,2,3,4,5,6' })
  const [newReward, setNewReward] = useState({ name:'', points:50 })
  const [editingKid, setEditingKid] = useState(null)
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
    setNewChore({ kid_ids:[], name:'', points:defaultPoints, recurring:'0,1,2,3,4,5,6' })
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
    if (res.ok) { onRefresh(); showToast(`${delta > 0 ? '+' : ''}${delta} pts applied!`); setPointsReason('') }
  }

  const tabs = ['kids', 'chores', 'rewards', 'points', 'settings', 'log']

  return (
    <div>
      <div style={{ display:'flex', gap:0, padding:'0 16px', background:'var(--cb-header)', borderBottom:'1px solid var(--cb-border)', overflowX:'auto' }}>
        {tabs.map(t => (
          <div key={t} onClick={() => setTab(t)}
            style={{ padding:'16px 20px', fontSize:17, fontWeight: tab===t?700:400, color: tab===t?'#7F77DD':'var(--cb-text-muted)', borderBottom:`3px solid ${tab===t?'#7F77DD':'transparent'}`, cursor:'pointer', textTransform:'capitalize', whiteSpace:'nowrap', position:'relative' }}>
            {t}
            {t==='rewards'&&(requests.length>0||suggestions.length>0)&&<span style={{ position:'absolute', top:10, right:6, width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
            {t==='points'&&pendingShoutouts.length>0&&<span style={{ position:'absolute', top:10, right:6, width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
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
                    <span style={{ fontSize:28 }}>{k.emoji}</span>
                    <span style={{ flex:1, fontSize:20, color:'var(--cb-text)', fontWeight:600 }}>{k.name}</span>
                    <span style={{ fontSize:17, color:'#7F77DD', fontWeight:600, marginRight:10 }}>{k.points} pts</span>
                    <button onClick={()=>setEditingKid({id:k.id,name:k.name,emoji:k.emoji,color:k.color})}
                      style={{ background:'none', border:'none', color:'#7F77DD', cursor:'pointer', fontSize:22, padding:'0 8px' }}>✎</button>
                    <button onClick={async()=>{await deleteKid(k.id);onRefresh()}}
                      style={{ background:'none', border:'none', color:'var(--cb-text-dim)', cursor:'pointer', fontSize:22, padding:'0 8px' }}>&#x2715;</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop:18, background:'var(--cb-surface2)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:18, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:600 }}>Add kid</div>
              <input value={newKid.name} onChange={e=>setNewKid({...newKid,name:e.target.value})} placeholder="Name" style={inputStyle} />
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
              <button onClick={addKid} style={addBtnStyle}>Add Kid</button>
            </div>
          </div>
        )}

        {tab === 'chores' && (
          <div>
            {kids.map(kid => (
              <div key={kid.id} style={{ marginBottom:24 }}>
                <div style={{ fontSize:17, color:'var(--cb-text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>{kid.emoji} {kid.name}</div>
                {allChores.filter(c=>c.kid_id===kid.id).map(c=>(
                  <div key={c.id} style={{ display:'flex', alignItems:'center', background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:10, padding:'14px 18px', marginBottom:8 }}>
                    <span style={{ flex:1, fontSize:18, color:'var(--cb-text)', fontWeight:600 }}>{c.name}</span>
                    <span style={{ fontSize:15, color:'var(--cb-text-muted)', marginRight:16 }}>{c.points}pts · {recurringLabel(c.recurring)}</span>
                    <button onClick={async()=>{await deleteChore(c.id);onRefresh()}}
                      style={{ background:'none', border:'none', color:'var(--cb-text-dim)', cursor:'pointer', fontSize:22 }}>&#x2715;</button>
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
                <input type="number" value={newChore.points} onChange={e=>setNewChore({...newChore,points:parseInt(e.target.value)||0})} style={{...inputStyle, width:100}} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>Reward Points</span>
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
              <button onClick={addChore} style={addBtnStyle}>Add Chore</button>
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
                          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:10, padding:'12px 14px' }}>
                            <span style={{ fontSize:18, flexShrink:0 }}>⭐</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:16, color:'var(--cb-text)', fontWeight:500 }}>{s.description}</div>
                              <div style={{ fontSize:13, color:'var(--cb-text-faint)', marginTop:2 }}>{s.shoutout_date}</div>
                            </div>
                            <input type="number" min={1} value={pts}
                              onChange={e => setShoutoutPoints(p => ({ ...p, [s.id]: Math.abs(parseInt(e.target.value)||0) }))}
                              style={{ ...inputStyle, width:72, padding:'6px 8px', textAlign:'center' }} />
                            <span style={{ fontSize:14, color:'var(--cb-text-muted)', flexShrink:0 }}>pts</span>
                            <button onClick={async () => {
                              const res = await awardShoutout(s.id, pts)
                              if (res.ok) { onRefresh(); showToast(`+${pts} pts awarded!`) }
                            }} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'#1D9E75', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Award</button>
                            <button onClick={async () => {
                              const res = await acknowledgeShoutout(s.id)
                              if (res.ok) { onRefresh(); showToast('Shoutout recognized, no points') }
                            }} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--cb-border2)', background:'transparent', color:'var(--cb-text-sub)', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0 }}>No pts</button>
                            <button onClick={async () => {
                              await deleteShoutout(s.id); onRefresh(); showToast('Request rejected')
                            }} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #E24B4A', background:'transparent', color:'#E24B4A', fontSize:14, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Reject</button>
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
                      <span style={{ marginLeft:8, fontWeight:400, opacity: active?1:0.7 }}>{k.points} pts</span>
                      {hasPending && <span style={{ position:'absolute', top:4, right:4, width:7, height:7, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
                    </button>
                  )
                })}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="number" value={pointsDelta} min={1} onChange={e=>setPointsDelta(Math.abs(parseInt(e.target.value)||0))}
                  style={{...inputStyle, width:100}} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>Points</span>
              </div>
              <input value={pointsReason} onChange={e=>setPointsReason(e.target.value)} placeholder="Reason (optional)" style={inputStyle} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => applyPoints(1)}
                  style={{ flex:1, padding:'14px 0', background:'#1D9E75', border:'none', borderRadius:8, color:'#fff', fontSize:17, cursor:'pointer', fontWeight:700 }}>+ Add Points</button>
                <button onClick={() => applyPoints(-1)}
                  style={{ flex:1, padding:'14px 0', background:'#E24B4A', border:'none', borderRadius:8, color:'#fff', fontSize:17, cursor:'pointer', fontWeight:700 }}>- Remove Points</button>
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
                        <input type="number" min={1} value={pts}
                          onChange={e => setSuggestionPoints(p => ({ ...p, [s.id]: Math.abs(parseInt(e.target.value)||0) }))}
                          style={{ ...inputStyle, width:90, padding:'8px 10px' }} />
                        <span style={{ fontSize:15, color:'var(--cb-text-muted)' }}>pts to approve</span>
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
                        <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:2 }}>{r.kid_name} · {r.reward_points} pts</div>
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
                      <input type="number" value={editingReward.points} onChange={e=>setEditingReward({...editingReward,points:parseInt(e.target.value)||0})} style={{...inputStyle, width:100}} />
                      <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>Points cost</span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={saveReward} style={{ ...addBtnStyle, flex:1 }}>Save</button>
                      <button onClick={()=>setEditingReward(null)} style={{ flex:1, padding:'12px 0', background:'var(--cb-border)', border:'none', borderRadius:8, color:'var(--cb-text-sub)', fontSize:17, cursor:'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:12, padding:'16px 20px', marginBottom:10 }}>
                    <span style={{ flex:1, fontSize:20, color:'var(--cb-text)', fontWeight:600 }}>{r.name}</span>
                    <span style={{ fontSize:18, color:'#7F77DD', fontWeight:700, marginRight:10 }}>{r.points} pts</span>
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
              <input type="number" value={newReward.points} onChange={e=>setNewReward({...newReward,points:parseInt(e.target.value)||0})} placeholder="Points cost" style={inputStyle} />
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
                <div key={entry.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', background:'var(--cb-surface2)', border:'1px solid var(--cb-border)', borderRadius:10, marginBottom:7 }}>
                  <span style={{ fontSize:18, color:iconColor, width:22, textAlign:'center', flexShrink:0 }}>{icon}</span>
                  <span style={{ fontSize:16, color:'var(--cb-text-sub)', minWidth:110, flexShrink:0, fontWeight:600 }}>{entry.kid_name}</span>
                  <span style={{ flex:1, fontSize:16, color:'var(--cb-text)' }}>{entry.description}</span>
                  <span style={{ fontSize:16, fontWeight:700, color: entry.points > 0 ? '#1D9E75' : '#E24B4A', whiteSpace:'nowrap' }}>
                    {entry.points > 0 ? '+' : ''}{entry.points} pts
                  </span>
                  <span style={{ fontSize:13, color:'var(--cb-text-faint)', whiteSpace:'nowrap', marginLeft:8 }}>{dateLabel}</span>
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
              <div style={{ fontSize:18, color:'var(--cb-text-sub)', fontWeight:700 }}>Default Points</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="number" defaultValue={defaultPoints} key={defaultPoints} min={1}
                  onBlur={async e => {
                    const val = parseInt(e.target.value)
                    if (!val || val < 1) return
                    const res = await updateDefaultPoints(val)
                    if (res.ok) { onDefaultPointsChange(val); showToast('Default points updated!') }
                  }}
                  style={{...inputStyle, width:100}} />
                <span style={{ fontSize:16, color:'var(--cb-text-muted)' }}>points (used when creating chores or adjusting points)</span>
              </div>
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
