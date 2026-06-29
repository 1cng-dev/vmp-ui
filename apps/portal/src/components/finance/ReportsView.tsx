import React, { useState } from 'react'
import useCustomerStore from '../../store/customerStore'
import useVMStore from '../../store/vmStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { formatMMK, ExpiryCell } from '../ui/ui'
import useInvoiceStore from '../../store/invoiceStore'

export const ReportsView: React.FC = () => {
  const { customers } = useCustomerStore()
  const { vms } = useVMStore()
  const { toast } = useUIStore()

  const { invoices } = useInvoiceStore()
  const [dateFilter, setDateFilter] = useState<'all' | 'custom'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Helper to get fiscal years for a customer
  const getFiscalYears = (since: string) => {
    const startYear = new Date(since).getFullYear()
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = startYear; year <= currentYear; year++) {
      years.push({
        label: `FY ${year}-${(year + 1).toString().slice(-2)}`,
        start: `${year}-04-01`,
        end: `${year + 1}-03-31`
      })
    }
    return years
  }

  // Helper to get revenue for a specific fiscal year
  const getFiscalYearRevenue = (customerId: string, startDate: string, endDate: string) => {
    return invoices
      .filter(inv => {
        if (inv.customer !== customerId || inv.status !== 'Payment Received') return false
        if (!inv.invoiceDate) return false
        const invoiceDate = new Date(inv.invoiceDate)
        const fiscalStart = new Date(startDate)
        const fiscalEnd = new Date(endDate)
        return invoiceDate >= fiscalStart && invoiceDate <= fiscalEnd
      })
      .reduce((sum, inv) => sum + inv.amount, 0)
  }

  const filteredInvoices = invoices.filter(inv => {
    if (dateFilter === 'all') return true
    if (dateFilter === 'custom' && (!startDate || !endDate)) return true
    if (!inv.invoiceDate) return false
    if (dateFilter === 'custom' && startDate && endDate) {
      return inv.invoiceDate >= startDate && inv.invoiceDate <= endDate
    }
    return false
  })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Per-customer revenue · upcoming renewals · payment performance</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => toast('Report CSV download started', 'info')}><Icon name="download" size={13} />Export all (CSV)</button>
        </div>
      </div>

      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-head"><h3 className="card-title">Revenue by customer · YTD</h3></div>

          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <button className={`filter-chip ${dateFilter === 'all' ? 'active' : ''}`} onClick={() => setDateFilter('all')}>All</button>
            <button className={`filter-chip ${dateFilter === 'custom' ? 'active' : ''}`} onClick={() => setDateFilter('custom')}>Custom range</button>

            {dateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ marginLeft: 8, padding: '4px 8px' }}
                />
                <span style={{ margin: '0 8px' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '4px 8px' }}
                />
              </>
            )}
          </div>

          <div className="card-body flush" style={{ display: 'flex', flexDirection: 'column', height: 350 }}>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table className="tbl" style={{ tableLayout: 'auto', width: 'max-content', minWidth: '100%' }}>
                <colgroup>
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead><tr><th>Customer</th><th className="right">VMs</th><th className="right">Lifetime</th><th>YTD</th></tr></thead>
                <tbody style={{ height: '100%' }}>
                  {(() => {
                    const rows = [...customers]
                      .sort((a, b) => b.totalSpend - a.totalSpend)
                      .map(c => {
                        const customerRevenue = filteredInvoices
                          .filter(inv => inv.customer === c.id && inv.status === 'Payment Received')
                          .reduce((sum, inv) => sum + inv.amount, 0)

                        if (customerRevenue === 0) return null

                        const fiscalYears = getFiscalYears(c.since)

                        return (
                          <tr key={c.id}>
                            <td style={{ verticalAlign: 'top' }}>
                              <div className="fw-6 text-sm">{c.company}</div>
                              <div className="text-xs text-mute">{c.id}</div>
                            </td>
                            <td className="right tnum" style={{ verticalAlign: 'top' }}>
                              {vms.filter(v => v.customer === c.id).length}
                            </td>
                            <td className="right tnum" style={{ verticalAlign: 'top' }}>
                              {formatMMK(c.totalSpend)} MMK
                            </td>
                            <td style={{ verticalAlign: 'top' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: 'none' }}>
                                {fiscalYears.map(fy => (
                                  <tr key={fy.label} style={{ border: 'none' }}>
                                    <td style={{ padding: '2px 0', color: 'var(--text-2)', border: 'none', whiteSpace: 'nowrap' }}>{fy.label}</td>
                                    <td style={{ padding: '2px 0', paddingLeft: 8, textAlign: 'right', border: 'none', whiteSpace: 'nowrap' }}> {formatMMK(getFiscalYearRevenue(c.id, fy.start, fy.end))} MMK</td>
                                  </tr>
                                ))}
                              </table>
                            </td>
                          </tr>
                        )
                      })
                      .filter(Boolean)

                    return rows.length ? (
                      rows
                    ) : (
                      <tr style={{ height: '100%' }}>
                        <td colSpan={4} className="text-center text-mute" style={{ verticalAlign: 'middle' }}>
                          No data found
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
            <table className="tbl" style={{ marginTop: 0, borderTop: 'none', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '40%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <tbody>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td className="fw-7">Total</td>
                  <td className="right tnum fw-7">{[...customers].sort((a, b) => b.totalSpend - a.totalSpend).reduce((sum, c) => {
                    const customerRevenue = filteredInvoices.filter(inv => inv.customer === c.id && inv.status === 'Payment Received').reduce((s, inv) => s + inv.amount, 0)
                    if (customerRevenue === 0) return sum
                    return sum + vms.filter(v => v.customer === c.id).length
                  }, 0)}</td>
                  <td className="right tnum fw-7">MMK {formatMMK([...customers].sort((a, b) => b.totalSpend - a.totalSpend).reduce((sum, c) => {
                    const customerRevenue = filteredInvoices.filter(inv => inv.customer === c.id && inv.status === 'Payment Received').reduce((s, inv) => s + inv.amount, 0)
                    if (customerRevenue === 0) return sum
                    return sum + c.totalSpend
                  }, 0))}</td>
                  <td className="right tnum fw-7">MMK {formatMMK([...customers].sort((a, b) => b.totalSpend - a.totalSpend).reduce((sum, c) => {
                    const rev = filteredInvoices.filter(inv => inv.customer === c.id && inv.status === 'Payment Received').reduce((s, inv) => s + inv.amount, 0)
                    return sum + rev
                  }, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3 className="card-title">Upcoming renewals · 30 days</h3></div>
          <div className="card-body flush">
            <table className="tbl">
              <thead><tr><th>VM</th><th>Customer</th><th>Expires</th><th className="right">Renewal</th></tr></thead>
              <tbody>
                {vms.filter(v => v.expiry !== '—' && typeof v.expiry === 'string' && (new Date(v.expiry).getTime() - new Date('2026-05-27').getTime()) / 86400000 <= 30 && (new Date(v.expiry).getTime() - new Date('2026-05-27').getTime()) / 86400000 >= 0)
                  .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()).map(v => {
                    const c = customers.find(c => c.id === v.customer)
                    return (
                      <tr key={v.id}>
                        <td><div className="fw-6 text-sm">{v.name}</div><div className="text-xs text-mute mono">{v.id}</div></td>
                        <td className="text-sm">{c?.company}</td>
                        <td><ExpiryCell date={v.expiry} /></td>
                        <td className="right tnum fw-6">MMK {formatMMK(v.priceMonth * 12)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-head"><h3 className="card-title">Payment performance · last 6 months</h3></div>
        <div className="card-body">
          <div className="flex" style={{ alignItems: 'flex-end', gap: 12, height: 160 }}>
            {[['Dec', 92], ['Jan', 88], ['Feb', 94], ['Mar', 86], ['Apr', 91], ['May', 78]].map(([m, pct]) => {
              const pctNum = Number(pct)
              return (
                <div key={m} className="flex col gap-1" style={{ flex: 1, alignItems: 'center' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${pctNum}%`, background: pctNum < 85 ? 'var(--warn)' : 'var(--ok)', borderRadius: '3px 3px 0 0', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: -18, left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 600 }}>{pctNum}%</div>
                    </div>
                  </div>
                  <div className="text-xs text-mute">{m}</div>
                </div>
              )
            })}
          </div>
          <div className="text-xs text-mute mt-3">% of invoices paid before due date · cumulative across all customers</div>
        </div>
      </div>
    </div>
  )
}
