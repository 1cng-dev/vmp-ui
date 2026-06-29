import React from 'react'
import useTaskStore from '../../store/taskStore'
import useCustomerStore from '../../store/customerStore'
import Icon from '../../lib/icons'
import { StatusPill } from '../ui/ui'

interface CustomerRequestDetailProps {
  request: any
  onClose: () => void
}

export const CustomerRequestDetail: React.FC<CustomerRequestDetailProps> = ({ request: initial, onClose }) => {
  const { tasks } = useTaskStore()
  const { customers } = useCustomerStore()
    const t = tasks.find((x: any) => x.id === initial.id) || initial
  const c = customers.find((c: any) => c.id === t.customer)

  // Parse notes block into key-value pairs
  const notesLines = (t.notes || '').split('\n').filter(Boolean)
  const meta: Record<string, string> = {}
  notesLines.forEach((l: string) => {
    const m = l.match(/^(\w[\w\s]*?):\s*(.+)$/)
    if (m) meta[m[1].trim()] = m[2].trim()
  })

  const timeline = [
    { ts: t.created, who: c?.name || 'You', event: 'Request submitted', kind: 'customer' },
    t.assignee !== '—' ? { ts: t.created, who: 'System', event: `Assigned to ${t.assignee}`, kind: 'task' } : null,
    t.status === 'In Progress' ? { ts: t.created, who: t.assignee, event: 'Moved to In Progress', kind: 'task' } : null,
    t.status === 'Done' ? { ts: t.created, who: t.assignee, event: 'Completed', kind: 'task' } : null,
    t.status === 'Blocked' ? { ts: t.created, who: t.assignee, event: 'Blocked — additional info needed', kind: 'alert' } : null,
  ].filter(Boolean)

  return (
    <div className="content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to requests</button>
            <span className="mono text-xs text-mute">{t.id}</span>
          </div>
          <h1 className="page-title">{t.title}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={t.status}/>
            <span className="pill subtle">{t.type}</span>
            {t.priority === 'Urgent' && <span className="pill bad"><span className="dot"/>Urgent</span>}
            <span className="pill accent"><span className="dot"/>Submitted {t.created}</span>
          </div>
        </div>
      </div>

      <div className="grid-asym" style={{ gap: 24 }}>
        <div className="flex col" style={{ gap: 16 }}>
          {/* Configuration submitted */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Configuration submitted</h3></div>
            <div className="card-body">
              <dl className="dl">
                {Object.entries(meta).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt>{k}</dt>
                    <dd className={/Hostname|Spec|Plan|OS|Region/i.test(k) ? 'mono' : ''}>{v}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Timeline</h3></div>
            <div className="card-body" style={{ padding: '6px 18px' }}>
              {timeline.map((e: any, i: number) => (
                <div key={i} className="feed-item">
                  <span className={`dot ${e.kind}`}/>
                  <div className="body">
                    <span className="fw-6">{e.event}</span>
                    <div className="meta">{e.who} · {e.ts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex col" style={{ gap: 16 }}>
          {/* Status card */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Status</h3></div>
            <div className="card-body">
              <div style={{ padding: 14, background: t.status === 'Done' ? 'var(--ok-soft)' : t.status === 'Blocked' ? 'var(--bad-soft)' : 'var(--accent-soft)', borderRadius: 8 }}>
                <div className="fw-7" style={{ color: t.status === 'Done' ? 'var(--ok)' : t.status === 'Blocked' ? 'var(--bad)' : 'var(--accent-strong)' }}>{t.status}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
                  {t.status === 'Pending' && 'Awaiting review by Sales. Typical response: within 1 business day.'}
                  {t.status === 'In Progress' && 'Sales is working on your request. They\'ll reach out shortly.'}
                  {t.status === 'Blocked' && 'We need more info — check your email or Support tickets.'}
                  {t.status === 'Done' && 'Your request was completed. Check My VMs.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
