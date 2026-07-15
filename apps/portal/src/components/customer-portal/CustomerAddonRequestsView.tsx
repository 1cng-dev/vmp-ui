import React, { useState, useEffect } from 'react'
import { StatusPill } from '../ui/ui'
import Icon from '../../lib/icons'
import { supabase } from '../../lib/supabase'

interface CustomerAddonRequestsViewProps {
  myAddonRequests: any[]
  setDetailRequest: (request: any) => void
}

export const CustomerAddonRequestsView: React.FC<CustomerAddonRequestsViewProps> = ({ myAddonRequests, setDetailRequest }) => {
  const [vmRequestLegacyIds, setVmRequestLegacyIds] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchVmRequestLegacyIds = async () => {
      const legacyIds: Record<string, string> = {}
      
      for (const request of myAddonRequests) {
        if (request.vm_id) {
          // Fetch VM to get vm_request_id
          const { data: vmData } = await supabase
            .from('vms')
            .select('vm_request_id')
            .eq('id', request.vm_id)
            .single()
          
          if (vmData?.vm_request_id) {
            // Fetch VM request to get legacy_id
            const { data: vmRequestData } = await supabase
              .from('vm_requests')
              .select('legacy_id')
              .eq('id', vmData.vm_request_id)
              .single()
            
            if (vmRequestData?.legacy_id) {
              legacyIds[request.id] = vmRequestData.legacy_id
            }
          }
        }
      }
      
      setVmRequestLegacyIds(legacyIds)
    }

    fetchVmRequestLegacyIds()
  }, [myAddonRequests])

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
            <thead><tr><th>Request ID</th><th>Services</th><th>Submitted</th><th>Billing Term</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {myAddonRequests.length === 0 && <tr><td colSpan={6}><div className="empty"><div className="title">No add-on requests yet</div><div className="sub">Click "Add-on Services" in the sidebar to submit your first.</div></div></td></tr>}
              {myAddonRequests.map((t: any) => (
                <tr key={t.id} onClick={() => setDetailRequest({ ...t, requestType: 'addon' })}>
                  <td>
                    <div className="fw-6">{t.legacy_id || t.id}</div>
                    <div className="text-xs text-mute">VM Request: {vmRequestLegacyIds[t.id] || 'Loading...'}</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {t.cpfs_enabled && <span className="pill subtle">CPFS</span>}
                      {t.ccis_enabled && <span className="pill subtle">CCIS</span>}
                    </div>
                  </td>
                  <td className="tnum text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="text-sm">{t.duration ? (t.duration === 1 ? 'Monthly' : t.duration === 3 ? 'Quarterly' : t.duration === 6 ? 'Half Yearly' : t.duration === 12 ? 'Yearly' : `${t.duration} month${t.duration > 1 ? 's' : ''}`) : 'N/A'}</td>
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
}
