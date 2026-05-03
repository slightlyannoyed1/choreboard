import { useState } from 'react'
import { createRequest, createSuggestion } from '../api'

export default function RewardsView({ kids, rewards, suggestions, onRefresh, showToast, formatPoints, currencyMode, currencyRate }) {
  const [selectedKid, setSelectedKid] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionKidId, setSuggestionKidId] = useState(null)
  const kid = kids.find(k => k.id === selectedKid)

  const handleClaim = async (reward) => {
    if (!kid) return
    const res = await createRequest({ kid_id: kid.id, reward_id: reward.id })
    if (res.id) { showToast(`🏆 ${reward.name} claimed!`); onRefresh() }
    else showToast(res.error || 'Could not claim reward')
  }

  const handleSuggest = async () => {
    if (!suggestionKidId || !suggestionText.trim()) return
    const res = await createSuggestion({ kid_id: suggestionKidId, name: suggestionText.trim() })
    if (res.ok) { showToast('Suggestion sent!'); setSuggestionText(''); setSuggestionKidId(null); setSuggesting(false); onRefresh() }
    else showToast(res.error || 'Could not send suggestion')
  }

  return (
    <div style={{ padding:'12px 14px' }}>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {kids.map(k => (
          <button key={k.id} onClick={() => { setSelectedKid(k.id); setSuggesting(false); setSuggestionText('') }}
            style={{ padding:'12px 22px', borderRadius:24, border:`2px solid ${selectedKid===k.id?k.color:'var(--cb-border2)'}`, background: selectedKid===k.id?k.color+'22':'var(--cb-surface2)', color: selectedKid===k.id?k.color:'var(--cb-text-sub)', fontSize:18, fontWeight:600, cursor:'pointer' }}>
            {k.emoji} {k.name} <span style={{ fontSize:15, fontWeight:400 }}>({formatPoints(k.points)})</span>
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(280px,100%),1fr))', gap:12 }}>
        {rewards.map(r => {
          const pct = kid ? Math.min((kid.points / r.points) * 100, 100) : 0
          const canAfford = kid && kid.points >= r.points
          return (
            <div key={r.id} style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:20, color:'var(--cb-text)', fontWeight:700 }}>{r.name}</div>
              <div>
                {currencyMode === 'dollars'
                  ? <span style={{ fontSize:32, fontWeight:700, color:'#7F77DD' }}>${(r.points * currencyRate).toFixed(2)}</span>
                  : <><span style={{ fontSize:32, fontWeight:700, color:'#7F77DD' }}>{r.points}</span><span style={{ fontSize:16, color:'var(--cb-text-dim)' }}> pts</span></>
                }
              </div>

              {kid && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'var(--cb-text-dim)', marginBottom:6 }}>
                    <span>{formatPoints(kid.points)}</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height:12, background:'var(--cb-border)', borderRadius:6, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background: canAfford ? kid.color : kid.color + '99', borderRadius:6, transition:'width 0.4s' }} />
                  </div>
                </div>
              )}

              <button onClick={() => handleClaim(r)} disabled={!kid || !canAfford}
                style={{ padding:'14px 0', background: canAfford&&kid?'#534AB7':'var(--cb-surface2)', border:'none', borderRadius:8, color: canAfford&&kid?'#fff':'var(--cb-text-faint)', fontSize:17, cursor: canAfford&&kid?'pointer':'not-allowed', fontWeight:700 }}>
                {!kid ? 'Select a kid' : canAfford ? '🏆 Claim Reward' : `Need ${formatPoints(r.points - kid.points)} more`}
              </button>
            </div>
          )
        })}

        {/* Pending suggestions */}
        {suggestions.map(s => (
          <div key={s.id} style={{ background:'var(--cb-surface)', border:'1px dashed var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:10, opacity:0.7 }}>
            <div style={{ fontSize:13, color:'var(--cb-text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5 }}>Suggested · Pending review</div>
            <div style={{ fontSize:20, color:'var(--cb-text)', fontWeight:700 }}>{s.name}</div>
            <div style={{ fontSize:15, color:'var(--cb-text-faint)' }}>{s.kid_emoji} {s.kid_name} · Waiting for admin</div>
          </div>
        ))}

        {/* Suggest a new reward card */}
        <div style={{ background:'var(--cb-surface)', border:'2px dashed var(--cb-border2)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14, justifyContent:'center' }}>
          {suggesting ? (
            <>
              <div style={{ fontSize:16, color:'var(--cb-text-sub)', fontWeight:600 }}>Who's suggesting?</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {kids.map(k => (
                  <button key={k.id} onClick={() => setSuggestionKidId(k.id)}
                    style={{ padding:'8px 14px', borderRadius:20, border:`2px solid ${suggestionKidId===k.id?k.color:'var(--cb-border2)'}`, background: suggestionKidId===k.id?k.color+'22':'transparent', color: suggestionKidId===k.id?k.color:'var(--cb-text-sub)', fontSize:15, fontWeight:600, cursor:'pointer' }}>
                    {k.emoji} {k.name}
                  </button>
                ))}
              </div>
              <input
                value={suggestionText}
                onChange={e => setSuggestionText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSuggest(); if (e.key === 'Escape') { setSuggesting(false); setSuggestionText(''); setSuggestionKidId(null) } }}
                placeholder="What reward do you want?"
                autoFocus
                style={{ padding:'11px 14px', borderRadius:8, border:'1px solid var(--cb-border2)', background:'var(--cb-input-bg)', color:'var(--cb-text)', fontSize:16, outline:'none' }}
              />
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleSuggest} disabled={!suggestionKidId || !suggestionText.trim()}
                  style={{ flex:1, padding:'12px 0', background: suggestionKidId&&suggestionText.trim() ? '#7F77DD' : 'var(--cb-surface2)', border:'none', borderRadius:8, color: suggestionKidId&&suggestionText.trim() ? '#fff' : 'var(--cb-text-faint)', fontSize:16, fontWeight:700, cursor: suggestionKidId&&suggestionText.trim() ? 'pointer' : 'not-allowed' }}>
                  Send
                </button>
                <button onClick={() => { setSuggesting(false); setSuggestionText(''); setSuggestionKidId(null) }}
                  style={{ padding:'12px 16px', background:'transparent', border:'1px solid var(--cb-border2)', borderRadius:8, color:'var(--cb-text-sub)', fontSize:16, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => setSuggesting(true)}
              style={{ background:'none', border:'none', color:'var(--cb-text-faint)', fontSize:16, fontWeight:600, cursor:'pointer', padding:'20px 0', textAlign:'center' }}>
              + Suggest a new reward
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
