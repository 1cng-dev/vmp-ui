import React, { useState, useEffect } from 'react'
import useCustomerStore from '../store/customerStore'
import useVMStore from '../store/vmStore'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { StatusPill, Avatar, CircularSpinner } from '../components/ui/ui'

interface CustomersViewProps {
  openCust: (id: string) => void
  openModal: (kind: string, props?: any) => void
  userRole?: string
}

const CustomersView: React.FC<CustomersViewProps> = ({ openCust, openModal, userRole }) => {
  const { customers, customersLoading, updateCustomer, loadCustomers, deleteCustomer } = useCustomerStore()
  const { vms } = useVMStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<string | null>(null)

  // Load customers if not loaded yet
  useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [loadCustomers, customers.length])

  const filters = [
    { id: 'all', label: 'All customers', count: customers.length },
    { id: 'Active', label: 'Active', count: customers.filter(c => c.status === 'Active').length },
    { id: 'Pending', label: 'KYC pending', count: customers.filter(c => c.kyc_status === 'Pending').length },
    { id: 'Rejected', label: 'KYC rejected', count: customers.filter(c => c.kyc_status === 'Rejected').length },
    { id: 'Inactive', label: 'Inactive', count: customers.filter(c => c.status === 'Inactive').length },
  ]

  const filtered = customers.filter(c => {
    if (filter === 'all') return true
    if (filter === 'Pending' || filter === 'Rejected') return c.kyc_status === filter
    return c.status === filter
  }).filter(c => {
    if (!search) return true
    return [c.id, c.name, c.org_name, c.email, c.phone].join(' ').toLowerCase().includes(search.toLowerCase())
  })

  const handleExport = () => {
    const headers = ['Name', 'Company', 'Email', 'Phone', 'KYC Status', 'Status', 'Legacy ID', 'Created At']
    const rows = filtered.map(c => [c.name, c.org_name, c.email, c.phone, c.kyc_status, c.status, c.legacy_id, c.created_at])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast(`Exported ${filtered.length} customers to CSV`, 'ok')
  }

  useEffect(() => {
    const close = () => setMenu(null)
    if (menu) { window.addEventListener('click', close); return () => window.removeEventListener('click', close) }
  }, [menu])


  useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [loadCustomers, customers.length])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} accounts · {customers.filter(c => c.kyc_status === 'Pending').length} pending KYC</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleExport}><Icon name="download" size={13} />Export</button>
        </div>
      </div>

      <div className="card">
          <div className="filter-bar">
            {filters.map(f => (
              <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}<span className="ct">{f.count}</span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <div className="search" style={{ width: 220 }}>
              <Icon name="search" size={13} className="search-icon" />
              <input placeholder="Name, company, email…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
              <table className="tbl">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Company</th>
                <th>KYC</th>
                <th>Status</th>
                <th className="right">Active VMs</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {customersLoading ? (
                <tr><td colSpan={6}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty"><div className="title">No customers yet</div><div className="sub">Customers will appear here when they sign up.</div></div></td></tr>
              ) : (
                filtered.map(c => {
                  const vmCount = vms.filter(v => v.customer_id === c.id && v.status === 'Active').length
                  return (
                    <tr key={c.id} onClick={() => openCust(c.id)}>
                      <td>
                        <div className="flex center gap-2">
                          <Avatar name={c.name} size={28} />
                          <div><div className="fw-6">{c.name}</div><div className="text-xs text-mute mono">{c.legacy_id}</div></div>
                        </div>
                      </td>
                    <td><div className="fw-6 text-sm">{c.org_name}</div><div className="text-xs text-mute">{c.email}</div></td>
                    <td><StatusPill status={c.kyc_status} /></td>
                    <td><StatusPill status={c.status} /></td>
                    <td className="right tnum">{vmCount}</td>
                    <td className="tnum text-sm">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                  </tr>
                )
              })
              )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  )
}

export default CustomersView
