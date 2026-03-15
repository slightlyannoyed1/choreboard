const BASE = '/api'

export const getKids = () => fetch(`${BASE}/kids`).then(r => r.json())
export const createKid = (data) => fetch(`${BASE}/kids`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const updateKid = (id, data) => fetch(`${BASE}/kids/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const deleteKid = (id) => fetch(`${BASE}/kids/${id}`, { method:'DELETE' }).then(r=>r.json())

export const getChores = (date) => fetch(`${BASE}/chores${date ? `?date=${date}` : ''}`).then(r => r.json())
export const getAllChores = () => fetch(`${BASE}/chores/all`).then(r => r.json())
export const createChore = (data) => fetch(`${BASE}/chores`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const updateChore = (id, data) => fetch(`${BASE}/chores/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const deleteChore = (id) => fetch(`${BASE}/chores/${id}`, { method:'DELETE' }).then(r=>r.json())
export const completeChore = (id, date) => fetch(`${BASE}/chores/${id}/complete${date ? `?date=${date}` : ''}`, { method:'POST' }).then(r=>r.json())
export const uncompleteChore = (id, date) => fetch(`${BASE}/chores/${id}/complete${date ? `?date=${date}` : ''}`, { method:'DELETE' }).then(r=>r.json())

export const getRewards = () => fetch(`${BASE}/rewards`).then(r => r.json())
export const createReward = (data) => fetch(`${BASE}/rewards`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const updateReward = (id, data) => fetch(`${BASE}/rewards/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const deleteReward = (id) => fetch(`${BASE}/rewards/${id}`, { method:'DELETE' }).then(r=>r.json())

export const getRequests = () => fetch(`${BASE}/rewards/requests`).then(r => r.json())
export const createRequest = (data) => fetch(`${BASE}/rewards/requests`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json())
export const acknowledgeRequest = (id) => fetch(`${BASE}/rewards/requests/${id}/acknowledge`, { method:'POST' }).then(r=>r.json())

export const verifyPin = (pin) => fetch(`${BASE}/pin/verify?pin=${pin}`).then(r=>r.json())
export const updatePin = (pin) => fetch(`${BASE}/pin`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pin }) }).then(r=>r.json())

export const getAuditLog = () => fetch(`${BASE}/audit`).then(r => r.json())

export const getSettings = () => fetch(`${BASE}/settings`).then(r => r.json())
export const updateTimezone = (timezone) => fetch(`${BASE}/settings/timezone`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ timezone }) }).then(r => r.json())