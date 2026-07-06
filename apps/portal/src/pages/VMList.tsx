import React, { useState, useEffect } from 'react'
import useVMStore from '../store/vmStore'
import useCustomerStore from '../store/customerStore'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { StatusPill, ExpiryCell } from '../components/ui/ui'

interface VMListProps {
  openVM: (id: string) => void
  openModal: (kind: string, props?: any) => void
}

const VMList: React.FC<VMListProps> = ({ openVM, openModal }) => {
  const { vms, loadVMs } = useVMStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState<Set<string>>(new Set(['all']))
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<string | null>(null)

  // Ensure VMs are loaded when this page is opened
  useEffect(() => {
    loadVMs()
  }, [loadVMs])

  const filters = [
    { id: 'all', label: 'All', count: vms.length },
    { id: 'Active', label: 'Active', count: vms.filter(v => v.status === 'Active').length },
    { id: 'Suspended', label: 'Suspended', count: vms.filter(v => v.status === 'Suspended').length },
    { id: 'Terminated', label: 'Terminated', count: vms.filter(v => v.status === 'Terminated').length },
    { id: 'new', label: 'New', count: vms.filter(v => v.task_type === 'new').length },
    { id: 'upgrade', label: 'Upgrade', count: vms.filter(v => v.task_type === 'upgrade').length },
  ]

  const filtered = vms.filter(v => {
    if (filter.has('all')) return true
    const matches = []
    if (filter.has('Active')) matches.push(v.status === 'Active')
    if (filter.has('Suspended')) matches.push(v.status === 'Suspended')
    if (filter.has('Terminated')) matches.push(v.status === 'Terminated')
    if (filter.has('new')) matches.push(v.task_type === 'new')
    if (filter.has('upgrade')) matches.push(v.task_type === 'upgrade')
    return matches.length > 0 && matches.every(m => m === true)
  }).filter(v => {
    if (!search) return true
    const c = customers.find(c => c.id === v.customer_id)
    return [v.hostname, v.id, v.public_ip, v.task_type, c?.org_name, c?.name].join(' ').toLowerCase().includes(search.toLowerCase())
  })

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
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
          <button className="btn" onClick={() => toast('VMs CSV download started', 'info')}><Icon name="download" size={13}/>Export CSV</button>
          <button className="btn primary" onClick={() => openModal('newvm')}><Icon name="plus" size={13}/>New VM</button>
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
          <div style={{ flex: 1 }}/>
          <div className="search" style={{ width: 220 }}>
            <Icon name="search" size={13} className="search-icon"/>
            <input placeholder="Name, IP, customer…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>
        {selected.size > 0 && (
          <div style={{ padding: '10px 18px', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="fw-6 text-sm">{selected.size} selected</span>
            <button className="btn sm" onClick={() => { toast('Suspend action not implemented', 'info'); setSelected(new Set()); }}>Suspend</button>
            <button className="btn sm" onClick={() => { toast('Activate action not implemented', 'info'); setSelected(new Set()); }}>Activate</button>
            <button className="btn sm" onClick={() => { toast('Renew action not implemented', 'info'); setSelected(new Set()); }}>Renew 1 year</button>
            <button className="btn sm" onClick={() => { toast(`${selected.size} VMs exported to CSV`, 'info'); }}>Export selected</button>
            <button className="btn sm danger" onClick={() => { toast('Terminate action not implemented', 'info'); setSelected(new Set()); }}>Terminate</button>
            <div style={{ flex: 1 }}/>
            <button className="btn ghost sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 30 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(v => selected.has(v.id))} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(v => v.id)) : new Set())}/></th>
              <th>VM</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Type</th>
              <th>Spec</th>
              <th>Public IP / VLAN</th>
              <th>Expires</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => {
              const c = customers.find(c => c.id === v.customer_id)
              return (
                <tr key={v.id} onClick={() => openVM(v.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)}/>
                  </td>
                  <td>
                    <div className="flex center gap-2">
                      <span className="id-tag accent">{v.task_type || 'new'}</span>
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
                  <td><StatusPill status={v.status}/></td>
                  <td><StatusPill status={v.task_type || 'new'}/></td>
                  <td className="mono text-xs">
                    {v.vcpu}c · {v.ram_gb}GB · {v.storage_gb}GB
                  </td>
                  <td className="mono text-xs">
                    {v.public_ip || '—'}
                  </td>
                  <td><ExpiryCell date={v.expiry as any} /></td>
                  <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setMenu(menu === v.id ? null : v.id); }}>
                      <Icon name="more"/>
                    </button>
                    {menu === v.id && (
                      <div onClick={e => e.stopPropagation()} style={{
                        position: 'absolute', right: 14, top: 36, zIndex: 20,
                        background: 'var(--surface)', border: '1px solid var(--line)',
                        borderRadius: 8, boxShadow: 'var(--shadow)',
                        minWidth: 180, padding: 4,
                      }}>
                        <button className="nav-item" onClick={() => { openVM(v.id); setMenu(null); }}><Icon name="eye" size={13}/>View details</button>
                        <button className="nav-item" onClick={() => { openModal('renew', { vm: v }); setMenu(null); }}><Icon name="refresh" size={13}/>Renew</button>
                        <button className="nav-item" onClick={() => { openModal('spec', { vm: v }); setMenu(null); }}><Icon name="sliders" size={13}/>Change spec</button>
                        {v.status === 'Active'
                          ? <button className="nav-item" onClick={() => { toast('Suspend action not implemented', 'info'); setMenu(null); }}><Icon name="pause" size={13}/>Suspend</button>
                          : <button className="nav-item" onClick={() => { toast('Activate action not implemented', 'info'); setMenu(null); }}><Icon name="play" size={13}/>Activate</button>}
                        <button className="nav-item" onClick={() => { toast('Restart action not implemented', 'info'); setMenu(null); }}><Icon name="refresh" size={13}/>Restart</button>
                        <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }}/>
                        <button className="nav-item" style={{ color: 'var(--bad)' }} onClick={() => { openModal('terminate', { vm: v }); setMenu(null); }}><Icon name="trash" size={13}/>Terminate</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty"><div className="title">No VMs match these filters</div><div className="sub">Try a different status or clear the search.</div></div>}
      </div>
    </div>
  )
}

export default VMList
