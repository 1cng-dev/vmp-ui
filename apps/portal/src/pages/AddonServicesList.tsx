import React, { useState, useEffect } from 'react'
import useAddonServiceStore from '../store/addonServiceStore'
import useVMStore from '../store/vmStore'
import useCustomerStore from '../store/customerStore'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { StatusPill, ExpiryCell, CircularSpinner } from '../components/ui/ui'

interface AddonServicesListProps {
  userRole?: string
}

const AddonServicesList: React.FC<AddonServicesListProps> = ({ userRole }) => {
  const { addonServices, addonServicesLoading, loadAddonServices, updateAddonService } = useAddonServiceStore()
  const { vms } = useVMStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState<Set<string>>(new Set(['all']))
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<string | null>(null)

  const handleTerminate = async (addon: any) => {
    await updateAddonService(addon.id, { operational_status: 'Terminated' })
    toast(`Add-on service ${addon.legacy_id || addon.id} terminated`, 'warn')
    setMenu(null)
  }

  const handleActivate = async (addon: any) => {
    await updateAddonService(addon.id, { operational_status: 'Active' })
    toast(`Add-on service ${addon.legacy_id || addon.id} activated`, 'ok')
    setMenu(null)
  }

  // Ensure addon services are loaded when this page is opened
  useEffect(() => {
    if (addonServices.length === 0) {
      loadAddonServices()
    }
  }, [loadAddonServices, addonServices.length])

  const filters = [
    { id: 'all', label: 'All', count: addonServices.length },
    { id: 'Active', label: 'Active', count: addonServices.filter(a => a.operational_status === 'Active').length },
    { id: 'Terminated', label: 'Terminated', count: addonServices.filter(a => a.operational_status === 'Terminated').length },
    { id: 'Expired', label: 'Expired', count: addonServices.filter(a => a.operational_status === 'Expired').length },
  ]

  const filtered = addonServices.filter(a => {
    if (filter.has('all')) return true
    const matches = []
    if (filter.has('Active')) matches.push(a.operational_status === 'Active')
    if (filter.has('Terminated')) matches.push(a.operational_status === 'Terminated')
    if (filter.has('Expired')) matches.push(a.operational_status === 'Expired')
    return matches.length > 0 && matches.every(m => m === true)
  }).filter(a => {
    if (!search) return true
    const vm = vms.find(v => v.id === a.vm_id)
    const c = vm ? customers.find(c => c.id === vm.customer_id) : null
    return [a.legacy_id, a.id, vm?.hostname, c?.org_name, c?.name].join(' ').toLowerCase().includes(search.toLowerCase())
  })

  const exportToCSV = (addonsToExport: any[], filename: string) => {
    const headers = [
      'Legacy ID',
      'VM ID',
      'VM Hostname',
      'Customer Name',
      'Customer Organization',
      'CPFS Enabled',
      'CPFS Package',
      'CCIS Enabled',
      'CCIS Package',
      'Status',
      'Operational Status',
      'Start Date',
      'End Date',
      'Expiry Date',
      'Duration',
      'Created At'
    ]

    const rows = addonsToExport.map(a => {
      const vm = vms.find(v => v.id === a.vm_id)
      const c = vm ? customers.find(c => c.id === vm.customer_id) : null
      return [
        a.legacy_id || a.id,
        a.vm_id || '',
        vm?.hostname || '',
        c?.name || '',
        c?.org_name || c?.company || '',
        a.cpfs_enabled ? 'Yes' : 'No',
        a.cpfs_package || '',
        a.ccis_enabled ? 'Yes' : 'No',
        a.ccis_package || '',
        a.status || '',
        a.operational_status || '',
        a.start_date ? new Date(a.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        a.end_date ? new Date(a.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        a.expiry ? new Date(a.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        a.duration || '',
        a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportAll = () => {
    exportToCSV(filtered, `addon_services_export_${new Date().toISOString().split('T')[0]}`)
    toast(`${filtered.length} add-on services exported to CSV`, 'ok')
  }

  useEffect(() => {
    const close = () => setMenu(null)
    if (menu) {
      window.addEventListener('click', close)
      return () => window.removeEventListener('click', close)
    }
  }, [menu])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Add-on Services</h1>
          <p className="page-subtitle">{addonServices.length} add-on services · {addonServices.filter(a => a.operational_status === 'Active').length} active</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleExportAll}><Icon name="download" size={13} />Export CSV</button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          {filters.map(f => (
            <button key={f.id}
              className={`filter-chip ${filter.has(f.id) ? 'active' : ''}`}
              onClick={() => {
                const next = new Set(filter)
                if (f.id === 'all') {
                  setFilter(new Set(['all']))
                } else {
                  if (next.has(f.id)) {
                    next.delete(f.id)
                    if (next.size === 0) next.add('all')
                  } else {
                    next.add(f.id)
                    next.delete('all')
                  }
                  setFilter(next)
                }
              }}>
              {f.label}<span className="ct">{f.count}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="search" style={{ width: 220 }}>
            <Icon name="search" size={13} className="search-icon" />
            <input placeholder="ID, VM, customer…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Add-on Service</th>
              <th>VM</th>
              <th>Customer</th>
              <th>Services</th>
              <th>Billing Term</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>Expires</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {addonServicesLoading ? (
              <tr><td colSpan={9}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9}><div className="empty"><div className="title">No add-on services match these filters</div><div className="sub">Try a different status or clear the search.</div></div></td></tr>
            ) : (
              filtered.map(a => {
              const vm = vms.find(v => v.id === a.vm_id)
              const c = vm ? customers.find(c => c.id === vm.customer_id) : null
              return (
                <tr key={a.id}>
                  <td>
                    <div className="fw-6">{a.legacy_id || a.id}</div>
                  </td>
                  <td>
                    <div className="fw-6 text-sm">{vm?.hostname || 'Unknown VM'}</div>
                    <div className="text-xs text-mute mono">{vm?.legacy_id || vm?.id || ''}</div>
                  </td>
                  <td>
                    <div className="fw-6 text-sm">{c?.org_name}</div>
                    <div className="text-xs text-mute">{c?.name}</div>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {a.cpfs_enabled && <span className="pill subtle">CPFS ({a.cpfs_package})</span>}
                      {a.ccis_enabled && <span className="pill subtle">CCIS ({a.ccis_package})</span>}
                    </div>
                  </td>
                  <td className="text-sm">{a.duration || '—'}</td>
                  <td><StatusPill status={a.operational_status || a.status} expiry={a.expiry} /></td>
                  <td className="text-sm">{a.start_date ? new Date(a.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                  <td><ExpiryCell date={a.expiry as any} /></td>
                  <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                    {userRole !== 'Finance' && userRole !== 'Sales' && (
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setMenu(menu === a.id ? null : a.id); }}>
                        <Icon name="more" />
                      </button>
                    )}
                    {menu === a.id && (
                      <div onClick={e => e.stopPropagation()} style={{
                        position: 'absolute', right: 14, top: 36, zIndex: 20,
                        background: 'var(--surface)', border: '1px solid var(--line)',
                        borderRadius: 8, boxShadow: 'var(--shadow)',
                        minWidth: 180, padding: 4,
                      }}>
                        {a.operational_status === 'Active' && userRole !== 'Sales' ? (
                          <button className="nav-item" onClick={() => { handleTerminate(a); }}><Icon name="trash" size={13} />Terminate</button>
                        ) : (
                          a.operational_status !== 'Active' && <button className="nav-item" onClick={() => { handleActivate(a); }}><Icon name="play" size={13} />Activate</button>
                        )}
                      </div>
                    )}
                  </td>
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

export default AddonServicesList
