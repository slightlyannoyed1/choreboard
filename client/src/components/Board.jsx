import { useState, useEffect } from 'react'
import { getShoutouts } from '../api'
import KidColumn from './KidColumn'

export default function Board({ kids, chores, requests, selectedDate, onRefresh, showToast }) {
  const [shoutouts, setShoutouts] = useState([])

  const loadShoutouts = () => {
    getShoutouts(selectedDate).then(setShoutouts)
  }

  useEffect(() => { loadShoutouts() }, [selectedDate])

  const handleRefresh = () => {
    loadShoutouts()
    onRefresh()
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${kids.length}, 1fr)`, gap:12, padding:16 }}>
      {kids.map(kid => (
        <KidColumn key={kid.id} kid={kid} chores={chores.filter(c => c.kid_id === kid.id)} awards={requests.filter(r => r.kid_id === kid.id)} shoutouts={shoutouts.filter(s => s.kid_id === kid.id)} selectedDate={selectedDate} onRefresh={handleRefresh} showToast={showToast} />
      ))}
    </div>
  )
}
