import React, { useState } from 'react'
import Icon from '../../lib/icons'
import NewCustomerTicketModal from '../modals/NewCustomerTicketModal'
import { useTickets } from '../../store/ticketStore'

interface CustomerTicketsViewProps {
  me: any
  setOpenTicket: (ticket: any) => void
}

export const CustomerTicketsView: React.FC<CustomerTicketsViewProps> = ({ me, setOpenTicket }) => {
  const { tickets } = useTickets()
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('updated')

  // Filter tickets for current customer
  const myTickets = tickets.filter((t: any) => t.customer_id === me.id)

  const statusConfig: any = {
    'Open': { color: 'oklch(0.62 0.15 230)', bg: 'var(--info-soft)', icon: 'mail', desc: 'Awaiting team response' },
    'Closed': { color: 'var(--ink-3)', bg: 'var(--surface-3)', icon: 'lock', desc: 'Conversation closed' },
  }

  const stats = ['Open', 'Closed'].map((s: string) => ({
    status: s,
    count: myTickets.filter((t: any) => t.status === s).length,
    ...statusConfig[s],
  }))

  let list = filter === 'all' ? myTickets : myTickets.filter((t: any) => t.status === filter)
  
  // Priority order: Urgent > High > Normal > Low
  const priorityOrder: Record<string, number> = {
    'Urgent': 0,
    'High': 1,
    'Normal': 2,
    'Low': 3
  }
  
  list = [...list].sort((a: any, b: any) => {
    if (sort === 'updated') {
      const aDate = a.updated_at || a.created_at || ''
      const bDate = b.updated_at || b.created_at || ''
      return bDate.localeCompare(aDate)
    } else {
      const aPriority = priorityOrder[a.priority] ?? 2
      const bPriority = priorityOrder[b.priority] ?? 2
      return aPriority - bPriority
    }
  })

  return (
    <div className="content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Support tickets</h1>
          <p className="page-subtitle">{myTickets.length} total · responses within 4 hours during business hours</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setShowNew(true)}><Icon name="plus" size={13}/>New ticket</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-4">
        {stats.map((s: any) => (
          <div key={s.status} className="metric">
            <div className="label">{s.status}</div>
            <div className="value tnum">{s.count}</div>
            <div className="trend">{s.desc}</div>
          </div>
        ))}
      </div>

      {showNew && (
        <NewCustomerTicketModal me={me} onClose={() => setShowNew(false)} onCreated={() => setShowNew(false)} />
      )}

      {/* Filter bar */}
      <div className="flex center between mb-3">
        <div className="flex gap-2 wrap">
          <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All<span className="ct">{myTickets.length}</span></button>
          {['Open', 'Closed'].map((s: string) => (
            <button key={s} className={`filter-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s}<span className="ct">{stats.find((x: any) => x.status === s).count}</span>
            </button>
          ))}
        </div>
        <div className="flex center gap-2">
          <span className="text-xs text-mute">Sort by</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ padding: '5px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', fontSize: 12 }}>
            <option value="updated">Recently updated</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Ticket cards — IaaS style */}
      {list.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="title">No tickets {filter !== 'all' ? `in ${filter}` : 'yet'}</div>
            <div className="sub">Click "New ticket" to open one.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Replies</th>
                  <th>Updated</th>
                  <th style={{ width: 20 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.map((t: any) => {
                  const cfg = statusConfig[t.status]
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setOpenTicket(t)}>
                      <td>
                        <div className="mono text-xs">{t.legacy_id || t.id}</div>
                      </td>
                      <td>
                        <div className="fw-6">{t.subject}</div>
                      </td>
                      <td>
                        <span className={`pill ${t.priority === 'Urgent' ? 'bad' : t.priority === 'Low' ? 'subtle' : 'warn'}`} style={{ fontSize: 10 }}>
                          <span className="dot"/>{t.priority}
                        </span>
                      </td>
                      <td>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', borderRadius: 999,
                          background: cfg.bg, color: cfg.color,
                          fontSize: 11, fontWeight: 700,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }}/>
                          {t.status}
                        </div>
                      </td>
                      <td className="tnum">{(t.replies || []).length}</td>
                      <td className="tnum text-xs text-mute">{new Date(t.updated_at).toLocaleDateString()}</td>
                      <td className="right"><Icon name="chevron-right" size={12} className="text-mute"/></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
