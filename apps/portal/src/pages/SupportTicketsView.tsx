import React, { useState, useEffect, useRef } from 'react'
import useTicketStore from '../store/ticketStore'
import useCustomerStore from '../store/customerStore'
import Icon from '../lib/icons'
import { TeamTicketDetail } from '../components/ops/TeamTicketDetail'
import NewTicketModal from '../components/modals/NewTicketModal'
import { Spinner } from '../components/ui/ui'

interface SupportTicketsViewProps {
  openModal?: (kind: string, props?: any) => void
}

export const SupportTicketsView: React.FC<SupportTicketsViewProps> = ({ openModal }) => {
  const { tickets, ticketsLoading } = useTicketStore()
  const { customers } = useCustomerStore()
  const [filter, setFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [showNew, setShowNew] = useState(false)
  const selectedTicketIdRef = useRef<string | null>(null)

  // Update selectedTicket when tickets change to get the latest data
  useEffect(() => {
    if (selectedTicketIdRef.current) {
      const updatedTicket = tickets.find((t: any) => t.id === selectedTicketIdRef.current)
      if (updatedTicket) {
        setSelectedTicket(updatedTicket)
      }
    }
  }, [tickets])

  useEffect(() => {
    if (selectedTicket) {
      selectedTicketIdRef.current = selectedTicket.id
    } else {
      selectedTicketIdRef.current = null
    }
  }, [selectedTicket])

  const statusConfig: any = {
    'Open': { color: 'oklch(0.62 0.15 230)', bg: 'var(--info-soft)', icon: 'mail', desc: 'Awaiting team response' },
    'Closed': { color: 'var(--ink-3)', bg: 'var(--surface-3)', icon: 'lock', desc: 'Conversation closed' },
  }

  const stats = ['Open', 'Closed'].map((s: string) => ({
    status: s,
    count: tickets.filter((t: any) => t.status === s).length,
    ...statusConfig[s],
  }))

  let list = filter === 'all' ? tickets : tickets.filter((t: any) => t.status === filter)

  if (selectedTicket) {
    return <TeamTicketDetail ticket={selectedTicket} onClose={() => setSelectedTicket(null)} openModal={openModal} />
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Support tickets</h1>
          <p className="page-subtitle">{tickets.length} total · Manage customer support requests</p>
        </div>
      </div>

      <div className="grid-4 mb-4">
        {stats.map((s: any) => {
          const active = filter === s.status
          return (
            <button
              key={s.status}
              onClick={() => setFilter(filter === s.status ? 'all' : s.status)}
              style={{
                textAlign: 'left',
                padding: 16,
                background: active ? s.bg : 'var(--surface)',
                border: '1.5px solid',
                borderColor: active ? s.color : 'var(--line)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'inherit', color: 'var(--ink)',
                transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                boxShadow: active ? `0 0 0 3px ${s.bg}` : 'none',
              }}
            >
              <div className="flex center between mb-2">
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${s.color}1a`, color: s.color,
                  display: 'grid', placeItems: 'center',
                }}><Icon name={s.icon} size={14}/></div>
                {active && <Icon name="check" size={14} style={{ color: s.color }}/>}
              </div>
              <div className="tnum fw-7" style={{ fontSize: 24, lineHeight: 1.1 }}>{s.count}</div>
              <div className="fw-6 text-sm mt-1" style={{ color: s.color }}>{s.status}</div>
              <div className="text-xs text-mute mt-1">{s.desc}</div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 wrap mb-3">
        <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All<span className="ct">{tickets.length}</span></button>
        {['Open', 'Closed'].map((s: string) => (
          <button key={s} className={`filter-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s}<span className="ct">{stats.find((x: any) => x.status === s).count}</span>
          </button>
        ))}
      </div>
      <div className="card">
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Subject</th>
                  <th>Customer</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Replies</th>
                  <th>Updated</th>
                  <th style={{ width: 20 }}></th>
                </tr>
              </thead>
              <tbody>
                {ticketsLoading ? (
                  <tr><td colSpan={8}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
                ) : list.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty"><div className="title">No tickets {filter !== 'all' ? `in ${filter}` : 'yet'}</div><div className="sub">Tickets will appear here when customers submit support requests.</div></div></td></tr>
                ) : (
                  list.map((t: any) => {
                    const cfg = statusConfig[t.status]
                    const customer = customers.find((c: any) => c.id === t.customer_id)
                    return (
                      <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicket(t)}>
                        <td>
                          <div className="mono text-xs">{t.legacy_id || t.id}</div>
                        </td>
                        <td>
                          <div className="fw-6">{t.subject}</div>
                        </td>
                        <td>
                        <div className="fw-6 text-sm">{customer?.org_name ? customer.org_name : customer?.name || 'Unknown'}</div>
                        {customer?.org_name && <div className="text-xs text-mute">{customer?.name}</div>}
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
                      <td></td>
                    </tr>
                  )
                })
                )}
              </tbody>
            </table>
          </div>
        </div>
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={() => setShowNew(false)} />}
    </div>
  )
}

export default SupportTicketsView
