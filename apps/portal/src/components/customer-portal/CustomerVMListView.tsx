import React, { useState } from 'react'
import { StatusPill, ExpiryCell } from '../ui/ui'
import Icon from '../../lib/icons'

interface CustomerVMListViewProps {
  myVMs: any[]
  setDetailVm: (vm: any) => void
  setRenewVm: (vm: any) => void
  // Set when the last VM list load failed — shown instead of the "no VMs
  // yet" empty state, which would otherwise misleadingly imply the account
  // genuinely has none.
  loadError?: string | null
  onRetry?: () => void
}

export const CustomerVMListView: React.FC<CustomerVMListViewProps> = ({ myVMs, setDetailVm, setRenewVm, loadError, onRetry }) => {
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filters = [
    { id: 'all', label: 'All', count: myVMs.length },
    { id: 'Active', label: 'Active', count: myVMs.filter(v => v.status === 'Active').length },
    { id: 'Terminated', label: 'Terminated', count: myVMs.filter(v => v.status === 'Terminated').length },
  ]

  const filtered = myVMs.filter(vm => {
    if (filter !== 'all' && vm.status !== filter) return false
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const hostname = (vm.hostname || '').toLowerCase()
      const legacyId = (vm.legacy_id || vm.id || '').toLowerCase()
      if (!hostname.includes(searchLower) && !legacyId.includes(searchLower)) return false
    }
    return true
  })

  return (
  <div className="content">
    <div className="page-head">
      <div>
        <h1 className="page-title">My VMs</h1>
        <p className="page-subtitle">{myVMs.length} virtual machines · click any row to see details and control</p>
      </div>
    </div>
    <div className="grid-3 mb-4">
      <div className="metric"><div className="label">Active</div><div className="value tnum">{myVMs.filter((v: any) => v.status === 'Active').length}</div></div>
      <div className="metric"><div className="label">Total vCPU</div><div className="value tnum">{myVMs.reduce((a: number, v: any) => a + (v.status === 'Active' ? v.vcpu : 0), 0)}</div></div>
      <div className="metric"><div className="label">Total RAM</div><div className="value tnum">{myVMs.reduce((a: number, v: any) => a + (v.status === 'Active' ? v.ram_gb : 0), 0)} <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>GB</span></div></div>
    </div>
    <div className="card">
      <div className="filter-bar">
        {filters.map(f => (
          <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(filter === f.id ? 'all' : f.id)}>
            {f.label}<span className="ct">{f.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div className="search" style={{ width: 220 }}>
          <Icon name="search" size={13} className="search-icon" />
          <input 
            placeholder="VM name, ID…" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="card-body flush">
        <table className="tbl">
          <thead><tr><th>VM</th><th>Status</th><th>Type</th><th>Power</th><th>Spec</th><th>Public IP</th><th>Expires</th><th></th></tr></thead>
          <tbody>
            {myVMs.length === 0 && loadError && (
              <tr><td colSpan={8}>
                <div className="empty">
                  <div className="title">Couldn't load your VMs</div>
                  <div className="sub">Something went wrong loading your virtual machines. Please try again.</div>
                  {onRetry && <button className="btn sm mt-2" onClick={onRetry}><Icon name="refresh" size={11}/>Retry</button>}
                </div>
              </td></tr>
            )}
            {filtered.length === 0 && !loadError && <tr><td colSpan={8}><div className="empty"><div className="title">No VMs yet</div><div className="sub">Click "Request VM" in the sidebar to deploy your first virtual machine.</div></div></td></tr>}
            {filtered.map((v: any) => (
              <tr key={v.id} onClick={() => setDetailVm(v)}>
                <td><div className="fw-6">{v.hostname}</div><div className="text-xs text-mute mono">{v.legacy_id || v.id}</div></td>
                <td><StatusPill status={v.status} expiry={v.expiry}/></td>
                <td><span className={`pill ${v.request_type === 'trial' ? 'accent' : 'subtle'}`}>{v.request_type === 'trial' ? 'Trial' : 'Paid'}</span></td>
                <td><span className={`pill ${v.power_state === 'Stopped' ? 'bad' : ''}`}><Icon name={v.power_state === 'Running' ? 'play' : 'pause'} size={10}/>{v.power_state}</span></td>
                <td className="mono text-xs">{v.vcpu}c · {v.ram_gb}GB · {v.storage_gb}GB</td>
                <td className="mono">{v.public_ip || '—'}</td>
                <td><ExpiryCell date={v.expiry}/></td>
                <td className="right" onClick={e => e.stopPropagation()}>
                  {v.status !== 'Terminated' && <button className="btn sm" onClick={() => setRenewVm(v)}><Icon name="refresh" size={11}/>Renew</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  )
}
