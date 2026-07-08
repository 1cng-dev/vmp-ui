import React from 'react'
import Icon from '../../lib/icons'
import { StatusPill } from '../ui/ui'

interface CustomerRequestDetailProps {
  request: any
  onClose: () => void
}

export const CustomerRequestDetail: React.FC<CustomerRequestDetailProps> = ({ request, onClose }) => {
  const t = request

  const timeline = [
    { ts: t.created_at, who: 'You', event: 'Request submitted', kind: 'customer' },
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
          <h1 className="page-title">{t.hostname}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={t.status}/>
            <span className="pill subtle">{t.request_type === 'trial' ? '14-day Trial' : 'Paid'}</span>
            <span className="pill accent"><span className="dot"/>Submitted {new Date(t.created_at).toLocaleDateString()}</span>
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
                <dt>Purpose</dt><dd className="mono">{t.purpose || 'No purpose specified'}</dd>
                <dt>Hostname</dt><dd className="mono">{t.hostname}</dd>
                <dt>vCPU</dt><dd className="mono">{t.vcpu} cores</dd>
                <dt>Memory</dt><dd className="mono">{t.ram_gb} GB</dd>
                <dt>Storage</dt><dd className="mono">{t.storage} GB</dd>
                <dt>Quantity</dt><dd className="mono">{t.qty}</dd>
                {t.duration && (
                  <>
                    <dt>Duration</dt><dd className="mono">{t.duration} month{t.duration > 1 ? 's' : ''}</dd>
                  </>
                )}
                <dt>Specification Type</dt><dd className="mono" style={{ color: t.sizing === 'Standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{t.sizing}</dd>
                <dt>OS</dt><dd className="mono">{t.os_name} {t.os_version}</dd>
                <dt>Zone</dt><dd className="mono">{t.zone}</dd>
                <dt>Public IP</dt><dd className="mono">{t.public_ip_required ? 'Yes' : 'No'}</dd>
                {t.nics && t.nics.length > 0 && (
                  <>
                    <dt>NICs</dt>
                    <dd className="mono">{t.nics.map((n: any) => `${n.label} (${n.type}, VLAN: ${n.vlan})`).join(', ')}</dd>
                  </>
                )}
                {t.backup_enabled && (
                  <>
                    <dt>Backup</dt><dd className="mono">{t.backup_type}</dd>
                  </>
                )}
                {t.monitoring && (
                  <>
                    <dt>Monitoring</dt><dd className="mono">Yes</dd>
                  </>
                )}
                {t.notes && (
                  <>
                    <dt>Notes</dt><dd>{t.notes}</dd>
                  </>
                )}
                {t.storage_partitions && (
                  <>
                    <dt>Storage Partitions</dt><dd className="mono">{t.storage_partitions}</dd>
                  </>
                )}
                {t.firewall_ports && t.firewall_ports.length > 0 && (
                  <>
                    <dt>Firewall Ports</dt><dd className="mono">{t.firewall_ports.join(', ')}</dd>
                  </>
                )}
                {t.port_forwarding && t.port_forwarding.length > 0 && (
                  <>
                    <dt>Port Forwarding</dt>
                    <dd className="mono">
                      {t.port_forwarding.map((pf: any) => `${pf.srcPort} → ${pf.dstPort} (${pf.protocol})`).join(', ')}
                    </dd>
                  </>
                )}
                {t.legacy_id && (
                  <>
                    <dt>Request ID</dt><dd className="mono">{t.legacy_id}</dd>
                  </>
                )}
                {t.billing_term && (
                  <>
                    <dt>Billing Term</dt><dd>{t.billing_term}</dd>
                  </>
                )}
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
                    <div className="meta">{e.who} · {new Date(e.ts).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
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
              <div style={{ padding: 14, background: t.status === 'Completed' ? 'var(--ok-soft)' : t.status === 'Rejected' ? 'var(--bad-soft)' : 'var(--accent-soft)', borderRadius: 8 }}>
                <div className="fw-7" style={{ color: t.status === 'Completed' ? 'var(--ok)' : t.status === 'Rejected' ? 'var(--bad)' : 'var(--accent-strong)' }}>{t.status}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
                  {t.status === 'Pending' && 'Awaiting review by Sales. Typical response: within 1 business day.'}
                  {t.status === 'In Progress' && 'Sales is working on your request. They\'ll reach out shortly.'}
                  {t.status === 'Rejected' && 'Your request was rejected. Please contact support for details.'}
                  {t.status === 'Completed' && 'Your request was completed. Check My VMs.'}
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
