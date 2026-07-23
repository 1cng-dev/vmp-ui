import React from 'react'
import { StatusPill, ExpiryCell } from '../ui/ui'
import Icon from '../../lib/icons'

interface CustomerAddonRequestsViewProps {
  myAddonRequests: any[]
  setDetailRequest: (request: any) => void
}

export const CustomerAddonRequestsView: React.FC<CustomerAddonRequestsViewProps> = ({ myAddonRequests, setDetailRequest }) => {
  
  const transformStatus = (status: string) => {
    if (status === 'Pending') return 'Under Review'
    return status
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">My add-on requests</h1>
          <p className="page-subtitle">Add-on service requests you've submitted · {myAddonRequests.length} total · click any row to see details</p>
        </div>
      </div>
      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Request ID</th><th>Services</th><th>Submitted</th><th>Start Date</th><th>Expiry</th><th>Billing Term</th><th>Provision Status</th><th>Operational Status</th><th></th></tr></thead>
            <tbody>
              {myAddonRequests.length === 0 && <tr><td colSpan={9}><div className="empty"><div className="title">No add-on requests yet</div><div className="sub">Click "Add-on Services" in the sidebar to submit your first.</div></div></td></tr>}
              {myAddonRequests.map((t: any) => (
                <tr key={t.id} onClick={() => setDetailRequest({ ...t, requestType: 'addon' })}>
                  <td>
                    <div className="fw-6">{t.legacy_id || t.id}</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {t.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                      {t.ccis_enabled && <span className="pill subtle">CCIS</span>}
                    </div>
                  </td>
                  <td className="tnum text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="tnum text-sm">{t.start_date ? new Date(t.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                  <td><ExpiryCell date={t.expiry || ''} /></td>
                  <td className="text-sm">{t.duration || 'N/A'}</td>
                  <td><StatusPill status={t.status} transformStatus={transformStatus}/></td>
                  <td><StatusPill status={t.operational_status || 'Active'} expiry={t.expiry} /></td>
                  <td className="right"><Icon name="chevron-right" size={12} className="text-mute"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
