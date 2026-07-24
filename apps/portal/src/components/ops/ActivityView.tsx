import React, { useState } from 'react'
import useActivityStore from '../../store/activityStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { Spinner } from '../ui/ui'

export const ActivityView: React.FC = () => {
  const { activity, activityLoading } = useActivityStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const kinds = ['All', 'VM', 'Finance', 'Task', 'Alert', 'Customer']
  const map: Record<string, string> = { 'VM': 'vm', 'Finance': 'finance', 'Task': 'task', 'Alert': 'alert', 'Customer': 'customer' }


  const filtered = activity.filter(a => {
    if (filter !== 'All' && a.kind !== map[filter]) return false
    if (search && ![a.text, a.actor, a.kind].join(' ').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleExport = () => {
    const headers = ['Timestamp', 'Actor', 'Kind', 'Text']
    const rows = filtered.map(a => [a.ts, a.actor, a.kind, a.text])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `activity-log-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast(`Exported ${filtered.length} events to CSV`, 'ok')
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Activity log</h1>
          <p className="page-subtitle">{activity.length} events · who, what, when across the system</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleExport}><Icon name="download" size={13}/>Export</button>
        </div>
      </div>
      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          {kinds.map(f => {
            const cnt = f === 'All' ? activity.length : activity.filter(a => a.kind === map[f]).length
            return (
              <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f}<span className="ct">{cnt}</span>
              </button>
            )
          })}
          <div style={{ flex: 1 }}/>
          <div className="search" style={{ width: 220 }}>
            <Icon name="search" size={13} className="search-icon"/>
            <input placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>
        <div className="card-body" style={{ padding: '6px 22px' }}>
          {activityLoading ? (
            <div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><Spinner /></div>
          ) : (
            <>
              {filtered.map((a, i) => (
                <div key={i} style={{
                  borderRadius: 8,
                  transition: 'background 0.12s',
                  margin: '0 -10px', padding: '0 10px',
                }}>
                  <div className="feed-item">
                    <span className={`dot ${a.kind}`}/>
                    <div className="body">
                      {a.text}
                      <div className="meta">
                        <span className="fw-6">{a.actor}</span>
                        <span> · </span>
                        <span className="tnum">{a.ts}</span>
                        <span> · </span>
                        <span style={{ textTransform: 'capitalize' }}>{a.kind}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="empty"><div className="sub">No events for this filter.</div></div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
