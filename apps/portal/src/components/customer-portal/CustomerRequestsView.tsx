import React from 'react'
import { StatusPill } from '../ui/ui'
import Icon from '../../lib/icons'

interface CustomerRequestsViewProps {
  myRequests: any[]
  setDetailRequest: (request: any) => void
}

export const CustomerRequestsView: React.FC<CustomerRequestsViewProps> = ({ myRequests, setDetailRequest }) => (
  <div className="content">
    <div className="page-head">
      <div>
        <h1 className="page-title">My requests</h1>
        <p className="page-subtitle">Requests you've submitted to our Sales team · {myRequests.length} total · click any row to see details</p>
      </div>
    </div>
    <div className="card">
      <div className="card-body flush">
        <table className="tbl">
          <thead><tr><th>Hostname</th><th>Request Type</th><th>Task Type</th><th>Submitted</th><th>Billing Term</th><th>Spec Type</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {myRequests.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="title">No requests yet</div><div className="sub">Click "Request VM" in the sidebar to submit your first.</div></div></td></tr>}
            {myRequests.map((t: any) => (
              <tr key={t.id} onClick={() => setDetailRequest(t)}>
                <td>
                  <div className="fw-6">{t.hostname}</div>
                  <div className="text-xs text-mute">{t.purpose || 'No purpose'}</div>
                </td>
                <td><span className="pill subtle">{t.request_type === 'trial' ? 'Trial' : 'Paid'}</span></td>
                <td><span className={`pill ${t.task_type === 'change-plan' ? 'accent' : 'subtle'}`}>{t.task_type || 'new'}</span></td>
                <td className="tnum text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="text-sm">{t.duration ? (t.duration === 1 ? 'Monthly' : t.duration === 3 ? 'Quarterly' : t.duration === 6 ? 'Half Yearly' : t.duration === 12 ? 'Yearly' : `${t.duration} month${t.duration > 1 ? 's' : ''}`) : 'N/A'}</td>
                <td className="text-sm" style={{ color: t.sizing === 'Standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{t.sizing}</td>
                <td><StatusPill status={t.status}/></td>
                <td className="right"><Icon name="chevron-right" size={12} className="text-mute"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)
