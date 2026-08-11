import React from 'react'
import { StatusPill, ExpiryCell } from '../ui/ui'
import Icon from '../../lib/icons'

interface CustomerAddonRequestsViewProps {
  myAddonRequests: any[]
  setDetailRequest: (request: any) => void
}

// Helper function to format duration string, hiding "0 months" when months is 0
const formatDuration = (duration: string | number | undefined): string => {
  if (!duration) return 'N/A'

  // If it's already a string, parse and format it
  if (typeof duration === 'string') {
    // Parse "X months Y days" format
    const monthsMatch = duration.match(/(\d+)\s*months?/i)
    const daysMatch = duration.match(/(\d+)\s*days?/i)

    const months = monthsMatch ? parseInt(monthsMatch[1]) : 0
    const days = daysMatch ? parseInt(daysMatch[1]) : 0

    if (months === 0 && days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`
    } else if (months > 0 && days === 0) {
      return `${months} month${months > 1 ? 's' : ''}`
    } else if (months > 0 && days > 0) {
      return `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`
    }
    return duration
  }

  // If it's a number, treat as months
  const numMonths = parseInt(String(duration))
  if (numMonths === 1) return 'Monthly'
  if (numMonths === 3) return 'Quarterly'
  if (numMonths === 6) return 'Half Yearly'
  if (numMonths === 12) return 'Yearly'
  return `${numMonths} month${numMonths > 1 ? 's' : ''}`
}

export const CustomerAddonRequestsView: React.FC<CustomerAddonRequestsViewProps> = ({ myAddonRequests, setDetailRequest }) => {
  
  const transformStatus = (status: string) => {
    if (status === 'Pending') return 'Under Review'
    return status
  }

  // Filter out add-on requests that are part of VM renewals
  // These are identified by notes containing "along with VM renewal" or having a related_entity_id
  const standaloneAddonRequests = myAddonRequests.filter((t: any) => {
    const isPartOfRenewal = t.notes?.toLowerCase().includes('along with vm renewal') || 
                            t.related_entity_id || 
                            t.vm_request_id
    return !isPartOfRenewal
  })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">My add-on requests</h1>
          <p className="page-subtitle">Add-on service requests you've submitted · {standaloneAddonRequests.length} total · click any row to see details</p>
        </div>
      </div>
      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Request ID</th><th>Services</th><th>Submitted</th><th>Start Date</th><th>Expiry</th><th>Billing Term</th><th>Provision Status</th><th>Operational Status</th><th></th></tr></thead>
            <tbody>
              {standaloneAddonRequests.length === 0 && <tr><td colSpan={9}><div className="empty"><div className="title">No add-on requests yet</div><div className="sub">Click "Add-on Services" in the sidebar to submit your first.</div></div></td></tr>}
              {standaloneAddonRequests.map((t: any) => (
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
                  <td className="text-sm">{formatDuration(t.duration)}</td>
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
