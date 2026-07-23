import React, { useState, useEffect } from 'react'
import useVMStore from '../store/vmStore'
import useCustomerStore from '../store/customerStore'
import useAddonRequestStore from '../store/addonRequestStore'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { StatusPill, ExpiryCell, CircularSpinner } from '../components/ui/ui'

interface VMListProps {
  openVM: (id: string) => void
  openModal: (kind: string, props?: any) => void
  setView: (view: string) => void
  userRole?: string
}

const VMList: React.FC<VMListProps> = ({ openVM, openModal, setView, userRole }) => {
  const { vms, vmsLoading, loadVMs, updateVM } = useVMStore()
  const { customers } = useCustomerStore()
  const { updateAddonRequest, addonRequests } = useAddonRequestStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState<Set<string>>(new Set(['all']))
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<string | null>(null)

  const handleActivate = async (vm: any) => {
    // Find all add-on requests for this VM
    const vmAddonRequests = addonRequests.filter(a => a.vm_id === vm.id && a.status === 'Completed')
    
    // Activate all associated add-on services
    for (const addon of vmAddonRequests) {
      await updateAddonRequest(addon.id, { operational_status: 'Active' })
    }
    
    // Activate the VM and set power state to Running
    updateVM(vm.id, { status: 'Active' as any, power_state: 'Running' as any })
    
    const addonCount = vmAddonRequests.length
    const message = addonCount > 0 
      ? `VM ${vm.hostname} activated along with ${addonCount} associated add-on service(s)`
      : `VM ${vm.hostname} activated`
    
    toast(message, 'ok')
  }

  // Ensure VMs are loaded when this page is opened
  useEffect(() => {
    if (vms.length === 0) {
      loadVMs()
    }
  }, [loadVMs, vms.length])

  const filters = [
    { id: 'all', label: 'All', count: vms.length },
    { id: 'Active', label: 'Active', count: vms.filter(v => v.status === 'Active').length },
    { id: 'Suspended', label: 'Suspended', count: vms.filter(v => v.status === 'Suspended').length },
    { id: 'Terminated', label: 'Terminated', count: vms.filter(v => v.status === 'Terminated').length },
    { id: 'new', label: 'New', count: vms.filter(v => v.task_type === 'new').length },
    { id: 'change-plan', label: 'Change Plan', count: vms.filter(v => v.task_type === 'change-plan').length },
  ]

  const filtered = vms.filter(v => {
    if (filter.has('all')) return true
    const matches = []
    if (filter.has('Active')) matches.push(v.status === 'Active')
    if (filter.has('Suspended')) matches.push(v.status === 'Suspended')
    if (filter.has('Terminated')) matches.push(v.status === 'Terminated')
    if (filter.has('new')) matches.push(v.task_type === 'new')
    if (filter.has('change-plan')) matches.push(v.task_type === 'change-plan')
    return matches.length > 0 && matches.every(m => m === true)
  }).filter(v => {
    if (!search) return true
    const c = customers.find(c => c.id === v.customer_id)
    return [v.hostname, v.id, v.public_ip, v.task_type, c?.org_name, c?.name].join(' ').toLowerCase().includes(search.toLowerCase())
  })

  const exportToCSV = (vmsToExport: any[], filename: string) => {
    const headers = [
      'Legacy ID',
      'Hostname',
      'Customer Name',
      'Customer Organization',
      'Status',
      'Task Type',
      'vCPU',
      'RAM (GB)',
      'Storage (GB)',
      'Public IP',
      'Private IP',
      'Username',
      'Power State',
      'Assigned VMID',
      'Start Date',
      'End Date',
      'Expiry Date',
      'Created At'
    ]

    const rows = vmsToExport.map(v => {
      const c = customers.find(c => c.id === v.customer_id)
      return [
        v.legacy_id || v.id,
        v.hostname || '',
        c?.name || '',
        c?.org_name || c?.company || '',
        v.status || '',
        v.task_type || 'new',
        v.vcpu || 0,
        v.ram_gb || 0,
        v.storage_gb || 0,
        v.public_ip || '',
        v.private_ip || '',
        v.username || '',
        v.power_state || '',
        (v as any).assigned_vmid || '',
        (v as any).start_date ? new Date((v as any).start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        (v as any).end_date ? new Date((v as any).end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        v.expiry ? new Date(v.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
        v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
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
    exportToCSV(filtered, `vms_export_${new Date().toISOString().split('T')[0]}`)
    toast(`${filtered.length} VMs exported to CSV`, 'ok')
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
          <h1 className="page-title">VM records</h1>
          <p className="page-subtitle">{vms.length} virtual machines · {vms.filter(v => v.status === 'Active').length} running</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleExportAll}><Icon name="download" size={13} />Export CSV</button>
          {userRole === 'Admin' && <button className="btn primary" onClick={() => setView('direct-vm-create')}><Icon name="plus" size={13} />New VM</button>}
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
            <input placeholder="Name, IP, customer…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>VM</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Power State</th>
              <th>Spec</th>
              <th>Public IP / VLAN</th>
              <th>Expires</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {vmsLoading ? (
              <tr><td colSpan={10}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10}><div className="empty"><div className="title">No VMs match these filters</div><div className="sub">Try a different status or clear the search.</div></div></td></tr>
            ) : (
              filtered.map(v => {
              const c = customers.find(c => c.id === v.customer_id)
              return (
                <tr key={v.id} onClick={() => openVM(v.id)}>
                  <td>
                    <div className="flex center gap-2">
                      <div>
                        <div className="fw-6">{v.hostname}</div>
                        <div className="text-xs text-mute mono">{v.legacy_id || v.id}</div>
                        {(v as any).assigned_vmid && <div className="text-xs text-mute">Proxmox ID: {(v as any).assigned_vmid}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="fw-6 text-sm">{c?.org_name}</div>
                    <div className="text-xs text-mute">{c?.name}</div>
                  </td>
                  <td><StatusPill status={v.status} expiry={v.expiry} /></td>
                  <td><span className="pill"><Icon name={v.power_state === 'Running' ? 'play' : 'pause'} size={10}/>{v.power_state || 'Unknown'}</span></td>
                  <td className="mono text-xs">
                    {v.vcpu}c · {v.ram_gb}GB · {v.storage_gb}GB
                  </td>
                  <td className="mono text-xs">
                    {v.public_ip || '—'}
                  </td>
                  <td><ExpiryCell date={v.expiry as any} /></td>
                  <td className="text-sm mono">{(v as any).start_date ? new Date((v as any).start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                  <td className="text-sm mono">{(v as any).end_date ? new Date((v as any).end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                  <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                    {userRole !== 'Finance' && userRole !== 'Sales' && (
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setMenu(menu === v.id ? null : v.id); }}>
                        <Icon name="more" />
                      </button>
                    )}
                    {menu === v.id && (
                      <div onClick={e => e.stopPropagation()} style={{
                        position: 'absolute', right: 14, top: 36, zIndex: 20,
                        background: 'var(--surface)', border: '1px solid var(--line)',
                        borderRadius: 8, boxShadow: 'var(--shadow)',
                        minWidth: 180, padding: 4,
                      }}>
                        <button className="nav-item" onClick={() => { openVM(v.id); setMenu(null); }}><Icon name="eye" size={13} />View details</button>
                        {v.status === 'Active' && userRole !== 'Sales' ? (
                          <>
                            <button className="nav-item" onClick={() => { openModal('terminate', { vm: v }); setMenu(null); }}><Icon name="trash" size={13} />Terminate</button>
                          </>
                        ) : (
                          v.status !== 'Active' && <button className="nav-item" onClick={() => { handleActivate(v); setMenu(null); }}><Icon name="play" size={13} />Activate</button>
                        )}
                        {userRole !== 'Sales' && (
                          <>
                            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                            <button className="nav-item" style={{ color: 'var(--bad)' }} onClick={() => { openModal('delete', { vm: v }); setMenu(null); }}><Icon name="x" size={13} />Delete</button>
                          </>
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

export default VMList
