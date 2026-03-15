import KidColumn from './KidColumn'

export default function Board({ kids, chores, requests, selectedDate, onRefresh, showToast }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${kids.length}, 1fr)`, gap:12, padding:16 }}>
      {kids.map(kid => (
        <KidColumn key={kid.id} kid={kid} chores={chores.filter(c => c.kid_id === kid.id)} awards={requests.filter(r => r.kid_id === kid.id)} selectedDate={selectedDate} onRefresh={onRefresh} showToast={showToast} />
      ))}
    </div>
  )
}