import React, { useState } from 'react'
import useAlertStore from '../../store/alertStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'

export const AlertsView: React.FC = () => {
  const { alerts, markAlertRead, markAllAlertsRead } = useAlertStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState('All')
  const [sev, setSev] = useState('All')
  const [search, setSearch] = useState('')
  const sevColor: Record<string, string> = { urgent: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)' }
  const sevLabel: Record<string, string> = { urgent: 'Urgent', warn: 'Warning', info: 'Info' }
  const typeIcon: Record<string, string> = { expiry: 'clock', kyc: 'shield', finance: 'invoice', task: 'tasks', system: 'settings', vm: 'server', addon: 'plus' }

  const filtered = alerts.filter(a => {
    if (filter === 'Unread' && a.read) return false
    if (filter !== 'All' && filter !== 'Unread' && a.type !== filter.toLowerCase()) return false
    if (sev !== 'All' && a.sev !== sev) return false
    if (search && ![a.title, a.body, a.type].join(' ').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const open = (a: any) => markAlertRead(a.id)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{alerts.filter(a => !a.read).length} unread · {alerts.filter(a => a.sev === 'urgent').length} urgent · {alerts.length} total</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={markAllAlertsRead}><Icon name="check" size={13} />Mark all read</button>
          <button className="btn" onClick={() => toast('Notification settings opened', 'info')}><Icon name="settings" size={13} />Settings</button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          {['All', 'Unread', 'Expiry', 'Kyc', 'Finance', 'Task', 'Addon'].map(f => {
            const cnt = f === 'All' ? alerts.length : f === 'Unread' ? alerts.filter(a => !a.read).length : alerts.filter(a => a.type === f.toLowerCase()).length
            return (
              <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'Kyc' ? 'KYC' : f}<span className="ct">{cnt}</span>
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <div className="search" style={{ width: 200 }}>
            <Icon name="search" size={13} className="search-icon" />
            <input placeholder="Search notifications…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="filter-bar" style={{ paddingTop: 8, paddingBottom: 8, gap: 6 }}>
          <span className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 4 }}>Severity</span>
          {['All', 'urgent', 'warn', 'info'].map(s => (
            <button key={s} className={`filter-chip ${sev === s ? 'active' : ''}`} onClick={() => setSev(s)}>
              {s !== 'All' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: sevColor[s] }} />}
              {s === 'All' ? 'All' : sevLabel[s]}
            </button>
          ))}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="empty"><div className="title">No notifications</div><div className="sub">No alerts match your filters.</div></div>
          ) : (
            filtered.map(a => (
              <div key={a.id} onClick={() => open(a)} style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                gap: 12,
                background: !a.read ? 'var(--surface-2)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: `${sevColor[a.sev]}1a`, color: sevColor[a.sev],
                display: 'grid', placeItems: 'center', marginTop: 1,
              }}>
                <Icon name={typeIcon[a.type] || 'bell'} size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex center between">
                  <span className="fw-6 text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                  <span className="text-xs text-mute" style={{ flexShrink: 0, marginLeft: 8 }}>{a.ts}</span>
                </div>
                <div className="text-sm text-mute mt-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.body}
                  {a.actor_name && <span className="text-xs text-mute"> · by {a.actor_name}</span>}
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="pill subtle" style={{ textTransform: 'capitalize' }}>{a.type}</span>
                  <span className="pill" style={{ background: `${sevColor[a.sev]}1a`, color: sevColor[a.sev] }}><span className="dot" style={{ background: sevColor[a.sev] }} />{sevLabel[a.sev]}</span>
                  {!a.read && <span className="pill accent"><span className="dot" />Unread</span>}
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
