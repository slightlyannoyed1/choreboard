import { useState, useEffect } from 'react'
import { getShoutouts, getRedeemed } from '../api'
import KidColumn from './KidColumn'

export default function Board({ kids, chores, requests, selectedDate, onRefresh, showToast }) {
  const [shoutouts, setShoutouts] = useState([])
  const [redeemed, setRedeemed] = useState([])

  const loadData = () => {
    getShoutouts(selectedDate).then(setShoutouts)
    getRedeemed(selectedDate).then(setRedeemed)
  }

  useEffect(() => { loadData() }, [selectedDate])

  const handleRefresh = () => {
    loadData()
    onRefresh()
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${kids.length}, 1fr)`, gap:12, padding:16 }}>
      {kids.map(kid => (
        <KidColumn key={kid.id} kid={kid} chores={chores.filter(c => c.kid_id === kid.id)} awards={requests.filter(r => r.kid_id === kid.id)} redeemed={redeemed.filter(r => r.kid_id === kid.id)} shoutouts={shoutouts.filter(s => s.kid_id === kid.id)} selectedDate={selectedDate} onRefresh={handleRefresh} showToast={showToast} />
      ))}
    </div>
  )
}
