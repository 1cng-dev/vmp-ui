import React from 'react'
import Icon from '../lib/icons'
import { StatusPill } from '../components/ui/ui'
import { useAddonRequests } from '../store/addonRequestStore'
import { useCustomers } from '../store/customerStore'
import { useVMs } from '../store/vmStore'

interface AddonServicesViewProps {
  openModal?: (kind: string, props?: any) => void
  openTask: (id: string) => void
  setView: (view: string) => void
  setAutoOpenQuote: (value: boolean) => void
  setPrefillCustomerId: (id: string) => void
  setPrefillRequestId: (id: string) => void
  setPrefillRequestType: (type: 'vm' | 'addon') => void
}

const AddonServicesView: React.FC<AddonServicesViewProps> = ({ openTask, setView, setAutoOpenQuote, setPrefillCustomerId, setPrefillRequestId, setPrefillRequestType }) => {
  const { addonRequests } = useAddonRequests()
  const { customers } = useCustomers()
  const { vms } = useVMs()
  const [filter, setFilter] = React.useState<'all' | 'Pending' | 'In Progress' | 'Completed' | 'Rejected'>('all')

  // Create a map of VM data for quick lookup
  const vmData = React.useMemo(() => {
    const map: Record<string, { hostname: string; legacy_id: string }> = {}
    vms.forEach(vm => {
      map[vm.id] = { hostname: vm.hostname || '', legacy_id: vm.legacy_id || vm.id }
    })
    return map
  }, [vms])

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'Pending', label: 'Pending' },
    { id: 'In Progress', label: 'In Progress' },
    { id: 'Completed', label: 'Completed' },
    { id: 'Rejected', label: 'Rejected' },
  ] as const

  const list = addonRequests
    .filter(r => filter === 'all' ? true : r.status === filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Add-on Services</h1>
          <p className="page-subtitle">Manage CPFS/CCIS requests across customers · {addonRequests.length} total</p>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          {filters.map(f => (
            <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(filter === f.id ? 'all' as any : f.id as any)}>
              {f.label}<span className="ct">{f.id === 'all' ? addonRequests.length : addonRequests.filter(r => r.status === f.id).length}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
        </div>

        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Request #</th>
                <th>Customer</th>
                <th>Linked VM</th>
                <th>Services</th>
                <th>Billing Term</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={7}><div className="empty"><div className="title">No add-on requests</div><div className="sub">Try a different filter or create a new request from the customer portal.</div></div></td></tr>
              )}
              {list.map((t: any) => {
                const cust = customers.find(c => c.id === t.customer_id)
                const svc = `${t.cpfs_enabled ? 'CPFS' : ''}${t.cpfs_enabled && t.ccis_enabled ? ' + ' : ''}${t.ccis_enabled ? 'CCIS' : ''}` || '—'
                return (
                  <tr key={t.id} onClick={() => openTask(t.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="fw-6">{t.legacy_id || t.id}</div>
                      <div className="text-xs text-mute">Submitted {new Date(t.created_at).toLocaleDateString()}</div>
                    </td>
                    <td>
                      <div className="fw-6 text-sm">{cust?.name}{cust?.org_name ? ` (${cust.org_name})` : ''}</div>
                    </td>
                    <td className="mono text-sm">{vmData[t.vm_id] ? `${vmData[t.vm_id].hostname} (${vmData[t.vm_id].legacy_id})` : t.vm_id?.slice(0,8) || '—'}</td>
                    <td>{svc}</td>
                    <td className="text-sm">{t.duration ? (t.duration === 1 ? 'Monthly' : t.duration === 3 ? 'Quarterly' : t.duration === 6 ? 'Half Yearly' : t.duration === 12 ? 'Yearly' : `${t.duration} month${t.duration > 1 ? 's' : ''}`) : 'N/A'}</td>
                    <td><StatusPill status={t.status} /></td>
                    <td className="right">
                      <div className="flex center gap-1" onClick={e => e.stopPropagation()}>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => { setPrefillCustomerId(t.customer_id); setPrefillRequestId(t.id); setPrefillRequestType('addon'); setAutoOpenQuote(true); setView('quotes') }}>
                          Quotation
                        </button>
                        <Icon name="chevron-right" size={12} className="text-mute" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AddonServicesView
