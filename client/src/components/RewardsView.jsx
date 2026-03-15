import { useState } from 'react'
import { createRequest } from '../api'

export default function RewardsView({ kids, rewards, onRefresh, showToast }) {
  const [selectedKid, setSelectedKid] = useState(null)
  const kid = kids.find(k => k.id === selectedKid)

  const handleClaim = async (reward) => {
    if (!kid) return
    const res = await createRequest({ kid_id: kid.id, reward_id: reward.id })
    if (res.id) { showToast(`🏆 ${reward.name} claimed!`); onRefresh() }
    else showToast(res.error || 'Could not claim reward')
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        {kids.map(k => (
          <button key={k.id} onClick={() => setSelectedKid(k.id)}
            style={{ padding:'12px 22px', borderRadius:24, border:`2px solid ${selectedKid===k.id?k.color:'var(--cb-border2)'}`, background: selectedKid===k.id?k.color+'22':'var(--cb-surface2)', color: selectedKid===k.id?k.color:'var(--cb-text-sub)', fontSize:18, fontWeight:600, cursor:'pointer' }}>
            {k.emoji} {k.name} <span style={{ fontSize:15, fontWeight:400 }}>({k.points}pts)</span>
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
        {rewards.map(r => {
          const pct = kid ? Math.min((kid.points / r.points) * 100, 100) : 0
          const canAfford = kid && kid.points >= r.points
          return (
            <div key={r.id} style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border)', borderRadius:12, padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:20, color:'var(--cb-text)', fontWeight:700 }}>{r.name}</div>
              <div><span style={{ fontSize:32, fontWeight:700, color:'#7F77DD' }}>{r.points}</span><span style={{ fontSize:16, color:'var(--cb-text-dim)' }}> pts</span></div>

              {kid && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, color:'var(--cb-text-dim)', marginBottom:6 }}>
                    <span>{kid.points} pts</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height:12, background:'var(--cb-border)', borderRadius:6, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background: canAfford ? kid.color : kid.color + '99', borderRadius:6, transition:'width 0.4s' }} />
                  </div>
                </div>
              )}

              <button onClick={() => handleClaim(r)} disabled={!kid || !canAfford}
                style={{ padding:'14px 0', background: canAfford&&kid?'#534AB7':'var(--cb-surface2)', border:'none', borderRadius:8, color: canAfford&&kid?'#fff':'var(--cb-text-faint)', fontSize:17, cursor: canAfford&&kid?'pointer':'not-allowed', fontWeight:700 }}>
                {!kid ? 'Select a kid' : canAfford ? '🏆 Claim Reward' : `Need ${r.points - kid.points} more pts`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
