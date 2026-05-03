import { useState, useEffect, useRef } from 'react'
import { getShoutouts, getRedeemed } from '../api'
import KidColumn from './KidColumn'

export default function Board({ kids, chores, requests, selectedDate, onRefresh, showToast, formatPoints }) {
  const [shoutouts, setShoutouts] = useState([])
  const [redeemed, setRedeemed] = useState([])
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600)
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef(null)

  const loadData = () => {
    getShoutouts(selectedDate).then(setShoutouts)
    getRedeemed(selectedDate).then(setRedeemed)
  }

  useEffect(() => { loadData() }, [selectedDate])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 600)
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isMobile) return
    const handler = () => setActiveIdx(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [isMobile])

  const handleRefresh = () => {
    loadData()
    onRefresh()
  }

  if (isMobile) {
    return (
      <div>
        <div ref={scrollRef} className="board-scroll"
          style={{ overflowX: 'auto', display: 'flex', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {kids.map(kid => (
            <div key={kid.id} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: 12, boxSizing: 'border-box' }}>
              <KidColumn kid={kid} chores={chores.filter(c => c.kid_id === kid.id)} awards={requests.filter(r => r.kid_id === kid.id)} redeemed={redeemed.filter(r => r.kid_id === kid.id)} shoutouts={shoutouts.filter(s => s.kid_id === kid.id)} selectedDate={selectedDate} onRefresh={handleRefresh} showToast={showToast} formatPoints={formatPoints} />
            </div>
          ))}
        </div>
        {kids.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '6px 0 14px' }}>
            {kids.map((kid, idx) => (
              <div key={kid.id}
                onClick={() => scrollRef.current?.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })}
                style={{ width: activeIdx === idx ? 20 : 8, height: 8, borderRadius: 4, background: activeIdx === idx ? kid.color : 'var(--cb-border2)', cursor: 'pointer', transition: 'width 0.2s, background 0.2s' }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${kids.length}, 1fr)`, gap:12, padding:16 }}>
      {kids.map(kid => (
        <KidColumn key={kid.id} kid={kid} chores={chores.filter(c => c.kid_id === kid.id)} awards={requests.filter(r => r.kid_id === kid.id)} redeemed={redeemed.filter(r => r.kid_id === kid.id)} shoutouts={shoutouts.filter(s => s.kid_id === kid.id)} selectedDate={selectedDate} onRefresh={handleRefresh} showToast={showToast} formatPoints={formatPoints} />
      ))}
    </div>
  )
}
