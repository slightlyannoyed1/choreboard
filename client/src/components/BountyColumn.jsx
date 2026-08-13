import { useState } from 'react'
import { claimBounty, unclaimBounty } from '../api'

const GOLD = '#BA7517'

// A standalone board column for chore bounties. Anyone can grab an open one; claiming
// asks which kid did the work, then hands it to admin for a yes/no verification. A
// pending claim can be released by clicking it again, mirroring un-checking a chore.
export default function BountyColumn({ kids, bounties, completedBounties, locked, onRefresh, showToast, formatPoints }) {
  const [claimingId, setClaimingId] = useState(null)

  const open = bounties.filter(b => b.status === 'open')
  const claimed = bounties.filter(b => b.status === 'claimed')
  const completed = completedBounties || []

  const handleClaim = async (bounty, kid) => {
    if (locked) { showToast('That day is closed'); return }
    const res = await claimBounty(bounty.id, kid.id)
    if (res.ok) {
      setClaimingId(null)
      showToast(`${kid.emoji} ${kid.name} claimed "${bounty.name}"! Waiting for a grown-up to check it.`)
      onRefresh()
    } else {
      showToast(res.error || 'Could not claim bounty')
    }
  }

  const handleUnclaim = async (bounty) => {
    if (locked) { showToast('That day is closed'); return }
    const res = await unclaimBounty(bounty.id)
    if (res.ok) {
      showToast(`"${bounty.name}" is back up for grabs`)
      onRefresh()
    } else {
      showToast(res.error || 'Could not release bounty')
    }
  }

  return (
    <div style={{ background:'var(--cb-surface)', borderRadius:12, border:`1px solid ${GOLD}55`, overflow:'hidden' }}>
      <div style={{ padding:'18px 20px', background: GOLD + '22', borderBottom:`1px solid ${GOLD}44`, display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background: GOLD + '33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, flexShrink:0 }}>🏆</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:22, fontWeight:600, color:'var(--cb-text)' }}>Bounties</div>
          <div style={{ fontSize:15, color:'var(--cb-text-sub)', marginTop:4 }}>Up for grabs — anyone can claim!</div>
        </div>
      </div>

      <div style={{ padding:'10px 12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {completed.map(b => (
          <div key={`done-${b.id}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'linear-gradient(135deg, #fff8e1, #fff3cd)', border:`1px solid ${GOLD}66`, borderRadius:10 }}>
            <span style={{ fontSize:26, flexShrink:0 }}>🎉</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:'#B8860B', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5 }}>Bounty done!</div>
              <div style={{ fontSize:17, color:'#5a4000', fontWeight:700, marginTop:2 }}>{b.name}</div>
              <div style={{ fontSize:15, color:'#7a5a10', marginTop:2 }}>
                {b.kid_emoji} {b.kid_name} · <span style={{ fontWeight:700 }}>+{formatPoints(b.points)}</span>
              </div>
            </div>
          </div>
        ))}

        {claimed.map(b => (
          <div key={b.id} onClick={() => handleUnclaim(b)} title="Claimed the wrong one? Tap to release it"
            style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background: GOLD + '11', border:`1px solid ${GOLD}44`, borderRadius:10, cursor: locked ? 'default' : 'pointer', userSelect:'none' }}>
            <span style={{ fontSize:26, flexShrink:0 }}>⏳</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:18, color:'var(--cb-text)', fontWeight:700 }}>{b.name}</div>
              <div style={{ fontSize:15, color:'var(--cb-text-muted)', marginTop:2 }}>
                {b.kid_emoji} {b.kid_name} claimed it · <span style={{ color: GOLD, fontWeight:700 }}>{formatPoints(b.points)}</span>
              </div>
              <div style={{ fontSize:13, color:'var(--cb-text-faint)', marginTop:3 }}>Waiting for a grown-up to check it · tap to undo</div>
            </div>
          </div>
        ))}

        {open.length > 0 && (claimed.length > 0 || completed.length > 0) && (
          <div style={{ fontSize:12, color:'var(--cb-text-faint)', textTransform:'uppercase', letterSpacing:1, padding:'6px 4px' }}>Up for grabs</div>
        )}

        {open.map(b => (
          <div key={b.id} style={{ padding:'16px', background:'var(--cb-surface2)', borderRadius:10, border:`1px solid ${GOLD}44` }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <span style={{ fontSize:24, flexShrink:0 }}>💰</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:20, color:'var(--cb-text)', fontWeight:700 }}>{b.name}</div>
                <div style={{ fontSize:16, color:'var(--cb-text-muted)', marginTop:3 }}>
                  <span style={{ color: GOLD, fontWeight:700 }}>{formatPoints(b.points)}</span> reward
                </div>
              </div>
            </div>

            {claimingId === b.id ? (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:14, color:'var(--cb-text-sub)', fontWeight:600, marginBottom:8 }}>Who did it?</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {kids.map(k => (
                    <button key={k.id} onClick={() => handleClaim(b, k)}
                      style={{ padding:'8px 14px', borderRadius:20, border:`2px solid ${k.color}`, background: k.color + '22', color: k.color, fontSize:15, fontWeight:600, cursor:'pointer' }}>
                      {k.emoji} {k.name}
                    </button>
                  ))}
                  <button onClick={() => setClaimingId(null)}
                    style={{ padding:'8px 14px', borderRadius:20, border:'1px solid var(--cb-border2)', background:'transparent', color:'var(--cb-text-sub)', fontSize:15, cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { if (locked) { showToast('That day is closed'); return } setClaimingId(b.id) }}
                style={{ marginTop:12, width:'100%', padding:'12px 0', background: GOLD, border:'none', borderRadius:8, color:'#fff', fontSize:16, fontWeight:700, cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.5 : 1 }}>
                🙋 Claim this bounty
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
