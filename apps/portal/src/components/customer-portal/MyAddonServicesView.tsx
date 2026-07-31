import React from 'react'
import { StatusPill, ExpiryCell } from '../ui/ui'

interface MyAddonServicesViewProps {
  myVMs: any[]
  myAddonServices: any[]
}

export const MyAddonServicesView: React.FC<MyAddonServicesViewProps> = ({ myVMs, myAddonServices }) => {
  // Filter active addon services
  const activeAddons = myAddonServices.filter(a =>
    a.status === 'Active' &&
    a.operational_status !== 'Terminated'
  )

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">My Add-on Services</h1>
          <p className="page-subtitle">{activeAddons.length} add-on services · {activeAddons.filter(a => a.operational_status === 'Active').length} active</p>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Add-on Service</th>
              <th>VM</th>
              <th>Services</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {activeAddons.length === 0 ? (
              <tr><td colSpan={6}><div className="empty"><div className="title">No active add-on services</div><div className="sub">Go to "Add-on Services" to request one.</div></div></td></tr>
            ) : (
              activeAddons.map((addon) => {
                const vm = myVMs.find((v: any) => v.id === addon.vm_id)
                return (
                  <tr key={addon.id}>
                    <td>
                      <div className="fw-6">{addon.legacy_id || addon.id}</div>
                    </td>
                    <td>
                      <div className="fw-6 text-sm">{vm?.hostname || 'Unknown VM'}</div>
                      <div className="text-xs text-mute mono">{vm?.legacy_id || vm?.id || ''}</div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {addon.cpfs_enabled && <span className="pill subtle">CPFS ({addon.cpfs_package})</span>}
                        {addon.ccis_enabled && <span className="pill subtle">CCIS ({addon.ccis_package})</span>}
                      </div>
                    </td>
                    <td><StatusPill status={addon.operational_status || addon.status} expiry={addon.expiry} /></td>
                    <td className="text-sm">{addon.start_date ? new Date(addon.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td><ExpiryCell date={addon.expiry as any} /></td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
