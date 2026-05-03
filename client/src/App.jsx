import { useState, useEffect, useCallback, useRef } from 'react'
import Board from './components/Board'
import RewardsView from './components/RewardsView'
import AdminView from './components/AdminView'
import { getKids, getChores, getAllChores, getRewards, getRequests, getSuggestions, verifyPin, getSettings, getPendingShoutouts } from './api'

const TEXT_ZOOM = { small: 0.85, medium: 1, large: 1.15, big: 1.3 }

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const shiftDate = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

const formatDate = (dateStr) => {
  const today = localDateStr()
  if (dateStr === today) return 'Today'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const DARK = {
  '--cb-bg':         '#1a1a1a',
  '--cb-header':     '#111111',
  '--cb-surface':    '#222222',
  '--cb-surface2':   '#2a2a2a',
  '--cb-border':     '#333333',
  '--cb-border2':    '#444444',
  '--cb-text':       '#eeeeee',
  '--cb-text-sub':   '#aaaaaa',
  '--cb-text-muted': '#888888',
  '--cb-text-dim':   '#666666',
  '--cb-text-faint': '#555555',
  '--cb-input-bg':   '#1a1a1a',
  '--cb-award-bg':   'linear-gradient(135deg, #2a2040, #1e1a30)',
}

const LIGHT = {
  '--cb-bg':         '#f0f2f5',
  '--cb-header':     '#ffffff',
  '--cb-surface':    '#ffffff',
  '--cb-surface2':   '#f5f6f8',
  '--cb-border':     '#e0e0e0',
  '--cb-border2':    '#cccccc',
  '--cb-text':       '#111111',
  '--cb-text-sub':   '#555555',
  '--cb-text-muted': '#777777',
  '--cb-text-dim':   '#999999',
  '--cb-text-faint': '#bbbbbb',
  '--cb-input-bg':   '#ffffff',
  '--cb-award-bg':   'linear-gradient(135deg, #ece9ff, #f0eeff)',
}

export default function App() {
  const [view, setView] = useState('board')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [selectedDate, setSelectedDate] = useState(localDateStr())
  const [kids, setKids] = useState([])
  const [chores, setChores] = useState([])
  const [allChores, setAllChores] = useState([])
  const [rewards, setRewards] = useState([])
  const [requests, setRequests] = useState([])
  const [toast, setToast] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState(false)
  const [now, setNow] = useState(new Date())
  const [timezone, setTimezone] = useState('America/New_York')
  const [isDark, setIsDark] = useState(() => localStorage.getItem('cb-theme') !== 'light')
  const [defaultPoints, setDefaultPoints] = useState(10)
  const [currencyMode, setCurrencyMode] = useState('points')
  const [currencyRate, setCurrencyRate] = useState(0.05)
  const [textSize, setTextSize] = useState(() => localStorage.getItem('cb-text-size') || 'medium')
  const [pendingShoutouts, setPendingShoutouts] = useState([])
  const [suggestions, setSuggestions] = useState([])

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
    if (!menuOpen) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  const toggleTheme = () => setIsDark(d => {
    const next = !d
    localStorage.setItem('cb-theme', next ? 'dark' : 'light')
    return next
  })

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    getSettings().then(s => {
      if (s.timezone) setTimezone(s.timezone)
      if (s.default_points) setDefaultPoints(s.default_points)
      if (s.currency_mode) setCurrencyMode(s.currency_mode)
      if (s.currency_rate) setCurrencyRate(s.currency_rate)
    })
  }, [])

  const formatPoints = useCallback((points) => {
    if (currencyMode === 'dollars') {
      const d = points * currencyRate
      return d < 0 ? `-$${Math.abs(d).toFixed(2)}` : `$${d.toFixed(2)}`
    }
    return `${points} pts`
  }, [currencyMode, currencyRate])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const refresh = useCallback(async () => {
    const [k, c, ac, r, req, ps, sg] = await Promise.all([getKids(), getChores(selectedDate), getAllChores(), getRewards(), getRequests(), getPendingShoutouts(), getSuggestions()])
    setKids(k); setChores(c); setAllChores(ac); setRewards(r); setRequests(req); setPendingShoutouts(ps); setSuggestions(sg)
  }, [selectedDate])

  useEffect(() => { refresh() }, [refresh])

  const handleAdminClick = () => { setPinInput(''); setPinError(false); setShowPin(true) }

  const adminTimeoutRef = useRef(null)

  const resetAdminTimeout = useCallback(() => {
    if (adminTimeoutRef.current) clearTimeout(adminTimeoutRef.current)
    adminTimeoutRef.current = setTimeout(() => setView('board'), 5 * 60 * 1000)
  }, [])

  useEffect(() => {
    if (view === 'admin') {
      resetAdminTimeout()
      window.addEventListener('pointerdown', resetAdminTimeout)
      window.addEventListener('keydown', resetAdminTimeout)
    } else {
      clearTimeout(adminTimeoutRef.current)
      window.removeEventListener('pointerdown', resetAdminTimeout)
      window.removeEventListener('keydown', resetAdminTimeout)
    }
    return () => {
      clearTimeout(adminTimeoutRef.current)
      window.removeEventListener('pointerdown', resetAdminTimeout)
      window.removeEventListener('keydown', resetAdminTimeout)
    }
  }, [view, resetAdminTimeout])

  const handlePin = async (digit) => {
    if (digit === 'del') { setPinInput(p => p.slice(0, -1)); return }
    const next = pinInput + digit
    setPinInput(next)
    if (next.length === 4) {
      const { valid } = await verifyPin(next)
      if (valid) { setShowPin(false); setView('admin') }
      else { setPinError(true); setTimeout(() => { setPinInput(''); setPinError(false) }, 800) }
    }
  }

  const theme = isDark ? DARK : LIGHT
  const daysBack = Math.round((new Date(localDateStr()+'T12:00:00') - new Date(selectedDate+'T12:00:00')) / 86400000)
  const daysFwd  = Math.round((new Date(selectedDate+'T12:00:00') - new Date(localDateStr()+'T12:00:00')) / 86400000)

  return (
    <div style={{ ...theme, minHeight:'100vh', background:'var(--cb-bg)', transition:'background 0.2s, color 0.2s', zoom: TEXT_ZOOM[textSize] }}>
      {isMobile ? (
        <div style={{ background:'var(--cb-header)', borderBottom:'1px solid var(--cb-border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px' }}>
            <div onClick={() => { setView('board'); setMenuOpen(false) }} style={{ fontSize:20, fontWeight:700, color:'var(--cb-text)', cursor:'pointer' }}>Chore<span style={{color:'#7F77DD'}}>Board</span></div>
            <div ref={menuRef} style={{ position:'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)}
                style={{ ...navBtnSm, fontSize:20, lineHeight:1, position:'relative' }}>
                &#9776;
                {(requests.length > 0 || pendingShoutouts.length > 0 || suggestions.length > 0) && <span style={{ position:'absolute', top:3, right:3, width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
              </button>
              {menuOpen && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--cb-surface)', border:'1px solid var(--cb-border2)', borderRadius:10, overflow:'hidden', zIndex:50, minWidth:140, boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
                  {[
                    { label:'Board', action: () => { setView('board'); setMenuOpen(false) }, active: view==='board' },
                    { label:'Rewards', action: () => { setView('rewards'); setMenuOpen(false) }, active: view==='rewards' },
                    { label:'Admin', action: () => { setMenuOpen(false); handleAdminClick() }, active: view==='admin', badge: requests.length > 0 || pendingShoutouts.length > 0 || suggestions.length > 0 },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'14px 18px', background: item.active ? '#7F77DD22' : 'transparent', border:'none', borderBottom:'1px solid var(--cb-border)', color: item.active ? '#7F77DD' : 'var(--cb-text)', fontSize:16, fontWeight: item.active ? 700 : 400, cursor:'pointer', textAlign:'left' }}>
                      {item.label}
                      {item.badge && <span style={{ width:8, height:8, background:'#E24B4A', borderRadius:'50%', display:'block', flexShrink:0 }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {view === 'board' && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'0 14px 10px' }}>
              <button onClick={() => setSelectedDate(d => shiftDate(d, -1))} disabled={daysBack >= 7}
                style={{ ...navBtnSm, opacity: daysBack >= 7 ? 0.3 : 1 }}>&#8592;</button>
              <button onClick={() => setSelectedDate(localDateStr())} style={{ ...navBtnSm, minWidth:90, fontWeight:600 }}>
                {formatDate(selectedDate)}
                {selectedDate === localDateStr() && <span style={{ color:'var(--cb-text-muted)', marginLeft:6 }}>{now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone: timezone })}</span>}
              </button>
              <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} disabled={daysFwd >= 31}
                style={{ ...navBtnSm, opacity: daysFwd >= 31 ? 0.3 : 1 }}>&#8594;</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'var(--cb-header)', borderBottom:'1px solid var(--cb-border)' }}>
          <div onClick={() => setView('board')} style={{ fontSize:26, fontWeight:700, color:'var(--cb-text)', cursor:'pointer' }}>Chore<span style={{color:'#7F77DD'}}>Board</span></div>

          {view === 'board' && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={() => setSelectedDate(d => shiftDate(d, -1))} disabled={daysBack >= 7}
                style={{ ...navBtn, opacity: daysBack >= 7 ? 0.3 : 1 }}>&#8592;</button>
              <button onClick={() => setSelectedDate(localDateStr())} style={{ ...navBtn, minWidth:100, fontSize:16, fontWeight:600 }}>
                {formatDate(selectedDate)}
                {selectedDate === localDateStr() && <span style={{ color:'var(--cb-text-muted)', marginLeft:8 }}>{now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone: timezone })}</span>}
              </button>
              <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} disabled={daysFwd >= 31}
                style={{ ...navBtn, opacity: daysFwd >= 31 ? 0.3 : 1 }}>&#8594;</button>
            </div>
          )}

          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={() => setView('board')} style={primaryBtnStyle(view==='board')}>Board</button>
            <button onClick={() => setView('rewards')} style={primaryBtnStyle(view==='rewards')}>Rewards</button>
            <button onClick={handleAdminClick} style={{ ...navBtn, fontSize:16, position:'relative' }}>
              Admin
              {(requests.length > 0 || pendingShoutouts.length > 0 || suggestions.length > 0) && <span style={{ position:'absolute', top:4, right:4, width:9, height:9, background:'#E24B4A', borderRadius:'50%', display:'block' }} />}
            </button>
          </div>
        </div>
      )}

      {view === 'board' && <Board kids={kids} chores={chores} requests={requests} selectedDate={selectedDate} onRefresh={refresh} showToast={showToast} formatPoints={formatPoints} />}
      {view === 'rewards' && <RewardsView kids={kids} rewards={rewards} suggestions={suggestions} onRefresh={refresh} showToast={showToast} formatPoints={formatPoints} currencyMode={currencyMode} currencyRate={currencyRate} />}
      {view === 'admin' && <AdminView kids={kids} allChores={allChores} rewards={rewards} requests={requests} suggestions={suggestions} pendingShoutouts={pendingShoutouts} timezone={timezone} onTimezoneChange={setTimezone} defaultPoints={defaultPoints} onDefaultPointsChange={setDefaultPoints} currencyMode={currencyMode} onCurrencyModeChange={setCurrencyMode} currencyRate={currencyRate} onCurrencyRateChange={setCurrencyRate} formatPoints={formatPoints} textSize={textSize} onTextSizeChange={size => { setTextSize(size); localStorage.setItem('cb-text-size', size) }} isDark={isDark} onToggleTheme={toggleTheme} onRefresh={refresh} showToast={showToast} setView={setView} />}

      {showPin && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'var(--cb-surface)', border:'1px solid var(--cb-border2)', borderRadius:12, padding:24, width:280 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontSize:16, fontWeight:500, color:'var(--cb-text)' }}>Admin PIN</span>
              <button onClick={() => setShowPin(false)} style={{ background:'none', border:'none', color:'var(--cb-text-muted)', fontSize:20, cursor:'pointer' }}>&#x2715;</button>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:20 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${pinError?'#E24B4A':pinInput.length>i?'#7F77DD':'var(--cb-border2)'}`, background: pinInput.length>i?(pinError?'#E24B4A':'#7F77DD'):'transparent' }} />
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'del'].map((d,i) => (
                <button key={i} onClick={() => d!=='' && handlePin(String(d))}
                  style={{ padding:'14px 0', background: d===''?'transparent':'var(--cb-surface2)', border:`1px solid ${d===''?'transparent':'var(--cb-border2)'}`, borderRadius:8, color:'var(--cb-text)', fontSize:18, cursor: d===''?'default':'pointer' }}>
                  {d==='del'?'⌫':d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#1D9E75', color:'#fff', padding:'10px 20px', borderRadius:8, fontSize:14, zIndex:200, whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const primaryBtnStyle = (active) => ({
  padding: '8px 20px', borderRadius:8, border:`2px solid ${active?'#7F77DD':'var(--cb-border2)'}`,
  background: active?'#7F77DD':'var(--cb-surface2)', color: active?'#fff':'var(--cb-text-sub)',
  fontSize:16, fontWeight:600, cursor:'pointer'
})

const navBtn = {
  padding: '8px 14px', borderRadius:8, border:'1px solid var(--cb-border2)',
  background:'var(--cb-surface2)', color:'var(--cb-text-sub)', fontSize:16, cursor:'pointer'
}

const navBtnSm = {
  padding: '6px 10px', borderRadius:8, border:'1px solid var(--cb-border2)',
  background:'var(--cb-surface2)', color:'var(--cb-text-sub)', fontSize:13, cursor:'pointer'
}
