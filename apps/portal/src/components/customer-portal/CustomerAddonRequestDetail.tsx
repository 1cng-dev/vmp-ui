import React from 'react'
import Icon from '../../lib/icons'
import { StatusPill } from '../ui/ui'

interface CustomerAddonRequestDetailProps {
  request: any
  onClose: () => void
}

export const CustomerAddonRequestDetail: React.FC<CustomerAddonRequestDetailProps> = ({ request, onClose }) => {
  const t = request

  const timeline = [
    { ts: t.created_at, who: 'You', event: 'Add-on request submitted', kind: 'customer' },
    t.status === 'In Progress' ? { ts: t.updated_at, who: 'System', event: 'Moved to In Progress', kind: 'task' } : null,
    t.status === 'Completed' ? { ts: t.updated_at, who: 'System', event: 'Completed', kind: 'task' } : null,
    t.status === 'Rejected' ? { ts: t.updated_at, who: 'System', event: 'Rejected', kind: 'alert' } : null,
  ].filter(Boolean)

  return (
    <div className="content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to requests</button>
          </div>
          <h1 className="page-title">{t.legacy_id || t.id}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={t.status}/>
            <span className="pill accent">Add-on Service</span>
            <span className="pill accent"><span className="dot"/>Submitted {new Date(t.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="grid-asym" style={{ gap: 24 }}>
        <div className="flex col" style={{ gap: 16 }}>
          {/* Configuration submitted */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Add-on Services</h3></div>
            <div className="card-body">
              <dl className="dl">
                {t.cpfs_enabled && (
                  <>
                    <dt>CPFS</dt>
                    <dd className="mono">Cloud Protection Firewall Service - {t.cpfs_package || 'standard'}</dd>
                  </>
                )}
                {t.ccis_enabled && (
                  <>
                    <dt>CCIS</dt>
                    <dd className="mono">Cloud Container Image Service - {t.ccis_package || 'standard'}</dd>
                  </>
                )}
                <dt>Duration</dt><dd className="mono">{t.duration ? `${t.duration} month${t.duration > 1 ? 's' : ''}` : 'N/A'}</dd>
                <dt>VM ID</dt><dd className="mono">{t.vm_id}</dd>
                <dt>Notes</dt><dd className="mono">{t.notes || 'No notes'}</dd>
              </dl>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Timeline</h3></div>
            <div className="card-body">
              {timeline.map((evt: any, idx: number) => (
                <div key={idx} className="flex gap-3" style={{ marginBottom: idx < timeline.length - 1 ? 16 : 0 }}>
                  <div style={{ minWidth: 40, textAlign: 'center' }}>
                    <div className={`dot ${evt.kind === 'alert' ? 'bad' : evt.kind === 'task' ? 'ok' : ''}`} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--line)', margin: '6px auto' }}/>
                  </div>
                  <div>
                    <div className="text-sm fw-6">{evt.event}</div>
                    <div className="text-xs text-mute">{evt.who} · {new Date(evt.ts).toLocaleString()}</div>
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
              <div className="flex center between mb-2">
                <span className="text-sm text-mute">Current status</span>
                <StatusPill status={t.status}/>
              </div>
              <div className="text-xs text-mute">
                {t.status === 'Pending' && 'Your request is being reviewed by our team'}
                {t.status === 'In Progress' && 'Your request is being processed'}
                {t.status === 'Completed' && 'Your add-on service has been activated'}
                {t.status === 'Rejected' && 'Your request was rejected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
