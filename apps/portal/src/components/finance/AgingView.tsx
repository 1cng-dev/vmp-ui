import React from 'react'
import useInvoiceStore from '../../store/invoiceStore'
import useCustomerStore from '../../store/customerStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, formatMMK } from '../ui/ui'

export const AgingView: React.FC = () => {
  const { invoices, loadInvoices } = useInvoiceStore()
  const { customers, loadCustomers } = useCustomerStore()
  const { toast } = useUIStore()
  const TODAY = new Date()
  const [ageFilter, setAgeFilter] = React.useState<string>('all')

  React.useEffect(() => {
    loadInvoices()
    loadCustomers()
  }, [loadInvoices, loadCustomers])
  
  const buckets: Record<string, any[]> = { current: [], '0-30': [], '31-60': [], '61-90': [], '90+': [] }
  invoices.filter((i: any) => i.status !== 'Payment Received').forEach((i: any) => {
    const days = Math.ceil((TODAY.getTime() - new Date(i.due).getTime()) / 86400000)
    if (days < 0) buckets.current.push({ ...i, days })
    else if (days <= 30) buckets['0-30'].push({ ...i, days })
    else if (days <= 60) buckets['31-60'].push({ ...i, days })
    else if (days <= 90) buckets['61-90'].push({ ...i, days })
    else buckets['90+'].push({ ...i, days })
  })
  const total = (b: any[]) => b.reduce((a: number, i: any) => a + i.amount, 0)
  const all = ageFilter === 'all'
    ? [...buckets.current, ...buckets['0-30'], ...buckets['31-60'], ...buckets['61-90'], ...buckets['90+']]
    : buckets[ageFilter] || []

  const filters = [
    { id: 'all', label: 'All ages', count: all.length },
    { id: 'current', label: 'Current', count: buckets.current.length },
    { id: '0-30', label: '0-30 days', count: buckets['0-30'].length },
    { id: '31-60', label: '31-60 days', count: buckets['31-60'].length },
    { id: '61-90', label: '61-90 days', count: buckets['61-90'].length },
    { id: '90+', label: '90+ days', count: buckets['90+'].length },
  ]

  const exportToCSV = () => {
    const headers = ['Invoice ID', 'Customer', 'Organization', 'Due Date', 'Age (Days)', 'Net Amount', 'Discount', 'VAT', 'Gross Amount', 'Status']
    const rows = all.map((i: any) => {
      const c = customers.find((c: any) => c.id === i.customer_id)
      const bucket = i.days < 0 ? 'Current' : i.days <= 30 ? '0-30' : i.days <= 60 ? '31-60' : i.days <= 90 ? '61-90' : '90+'
      return [
        i.legacy_id || i.id,
        c?.name || 'Unknown',
        c?.org_name || '',
        i.due ? new Date(i.due).toLocaleDateString() : '',
        bucket,
        i.amount || 0,
        i.discount || 0,
        i.vat || 0,
        i.gross_amount || i.amount,
        i.status
      ]
    })
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `aging-receivables-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast('Aging receivables exported successfully', 'ok')
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Aging receivables</h1>
          <p className="page-subtitle">{all.length} unpaid invoices · MMK {formatMMK(total(all))} outstanding</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={exportToCSV}><Icon name="download" size={13} />Export</button>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="metric"><div className="label">Current</div><div className="value tnum" style={{ fontSize: 18, color: 'var(--ok)' }}>MMK {formatMMK(total(buckets.current))}</div><div className="trend">{buckets.current.length} invoices</div></div>
        <div className="metric"><div className="label">0–30 days</div><div className="value tnum" style={{ fontSize: 18, color: 'oklch(0.55 0.16 75)' }}>MMK {formatMMK(total(buckets['0-30']))}</div><div className="trend">{buckets['0-30'].length} invoices</div></div>
        <div className="metric"><div className="label">31–60 days</div><div className="value tnum" style={{ fontSize: 18, color: 'oklch(0.55 0.16 35)' }}>MMK {formatMMK(total(buckets['31-60']))}</div><div className="trend">{buckets['31-60'].length} invoices</div></div>
        <div className="metric"><div className="label">90+ days</div><div className="value tnum" style={{ fontSize: 18, color: 'var(--bad)' }}>MMK {formatMMK(total(buckets['90+']) + total(buckets['61-90']))}</div><div className="trend">{buckets['90+'].length + buckets['61-90'].length} invoices</div></div>
      </div>
      <div className="card">
        <div className="filter-bar">
          {filters.map(f => (
            <button key={f.id} className={`filter-chip ${ageFilter === f.id ? 'active' : ''}`} onClick={() => setAgeFilter(f.id)}>
              {f.label}<span className="ct">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="card-head"><h3 className="card-title">All unpaid invoices</h3></div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Due</th><th>Age</th><th className="right">Net Amount</th><th className="right">Discount</th><th className="right">VAT</th><th className="right">Gross Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {all.map((i: any) => {
                const c = customers.find((c: any) => c.id === i.customer_id)
                const bucket = i.days < 0 ? 'Current' : i.days <= 30 ? '0-30d' : i.days <= 60 ? '31-60d' : i.days <= 90 ? '61-90d' : '90+d'
                const color = i.days < 0 ? 'ok' : i.days <= 30 ? 'warn' : 'bad'
                return (
                  <tr key={i.id}>
                    <td className="mono fw-6">{i.legacy_id || i.id}</td>
                    <td><div className="fw-6 text-sm">{c?.name} ({c?.org_name})</div></td>
                    <td className="tnum text-sm">{i.due ? new Date(i.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</td>
                    <td><span className={`pill ${color}`}><span className="dot" />{bucket}</span></td>
                    <td className="right tnum fw-6">MMK {formatMMK(i.amount)}</td>
                    <td className="right tnum text-sm">MMK {formatMMK(i.discount || 0)}</td>
                    <td className="right tnum text-sm">MMK {formatMMK(i.vat || 0)}</td>
                    <td className="right tnum fw-6 text-sm">MMK {formatMMK(i.gross_amount || i.amount)}</td>
                    <td><StatusPill status={i.status} /></td>
                    <td className="right">
                      <button className="btn sm" onClick={() => toast(`Reminder sent to ${c?.company}`, 'info')}>Remind</button>
                    </td>
                  </tr>
                )
              })}
              {all.length === 0 && <tr><td colSpan={10}><div className="empty"><div className="title">No unpaid invoices</div><div className="sub">All invoices have been paid.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
