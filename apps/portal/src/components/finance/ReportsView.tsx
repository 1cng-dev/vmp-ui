import React, { useState } from 'react'
import useCustomerStore from '../../store/customerStore'
import useVMStore from '../../store/vmStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { formatMMK, ExpiryCell, Spinner } from '../ui/ui'
import useInvoiceStore from '../../store/invoiceStore'
import * as XLSX from 'xlsx'

export const ReportsView: React.FC = () => {
  const { customers } = useCustomerStore()
  const { vms, loadVMs } = useVMStore()
  const { toast } = useUIStore()
  const { invoices, invoicesLoading, loadInvoices } = useInvoiceStore()
  const [isLoading, setIsLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState<'all' | 'custom'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Use real data from stores
  const displayCustomers = customers
  const displayInvoices = invoices
  const displayVMs = vms

  // All invoices for lifetime calculation (not filtered by date)
  const allInvoices = invoices

  React.useEffect(() => {
    setIsLoading(true)
    const promises: Promise<void>[] = []
    if (invoices.length === 0) {
      promises.push(loadInvoices())
    }
    if (vms.length === 0) {
      promises.push(loadVMs())
    }
    Promise.all(promises).finally(() => setIsLoading(false))
  }, [loadInvoices, loadVMs, invoices.length, vms.length])

  // Get the fiscal year to display based on filter
  const getDisplayFiscalYear = () => {
    if (dateFilter === 'custom' && startDate && endDate) {
      // Determine fiscal year from the selected date range
      const start = new Date(startDate)
      const year = start.getMonth() >= 3 ? start.getFullYear() : start.getFullYear() - 1
      return {
        label: `FY ${year}-${(year + 1).toString().slice(-2)}`,
        start: `${year}-04-01`,
        end: `${year + 1}-03-31`
      }
    } else {
      // Default to current fiscal year
      const now = new Date()
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return {
        label: `FY ${year}-${(year + 1).toString().slice(-2)}`,
        start: `${year}-04-01`,
        end: `${year + 1}-03-31`
      }
    }
  }

  const displayFiscalYear = getDisplayFiscalYear()

  // Helper to export CSV
  const exportCSV = () => {
    const rows = [...displayCustomers]
      .map(c => {
        const lifetimeSpend = allInvoices
          .filter(inv => inv.customer_id === c.id && inv.status === 'Payment Received')
          .reduce((sum, inv) => sum + inv.amount, 0)

        if (lifetimeSpend === 0) return null

        const ytdRevenue = getFiscalYearRevenue(c.id, displayFiscalYear.start, displayFiscalYear.end)
        const vmCount = displayVMs.filter(v => v.customer_id === c.id).length

        return {
          customer: c,
          lifetimeSpend,
          ytdRevenue,
          vmCount
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.lifetimeSpend - a.lifetimeSpend)

    // Create CSV content
    const headers = ['Customer', 'Customer ID', 'VMs', 'Lifetime (MMK)', `YTD ${displayFiscalYear.label} (MMK)`]
    const csvContent = [
      headers.join(','),
      ...rows.map((r: any) => [
        `"${r.customer.company || r.customer.org_name || r.customer.name}"`,
        `"${r.customer.legacy_id || r.customer.id}"`,
        r.vmCount,
        r.lifetimeSpend,
        r.ytdRevenue
      ].join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `revenue-report-${displayFiscalYear.label}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast('CSV exported successfully', 'success')
  }

  // Helper to export Excel
  const exportExcel = () => {
    const rows = [...displayCustomers]
      .map(c => {
        const lifetimeSpend = allInvoices
          .filter(inv => inv.customer_id === c.id && inv.status === 'Payment Received')
          .reduce((sum, inv) => sum + inv.amount, 0)

        if (lifetimeSpend === 0) return null

        const ytdRevenue = getFiscalYearRevenue(c.id, displayFiscalYear.start, displayFiscalYear.end)
        const vmCount = displayVMs.filter(v => v.customer_id === c.id).length

        return {
          customer: c,
          lifetimeSpend,
          ytdRevenue,
          vmCount
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.lifetimeSpend - a.lifetimeSpend)

    // Create worksheet data
    const worksheetData = [
      ['Customer', 'Customer ID', 'VMs', 'Lifetime (MMK)', `YTD ${displayFiscalYear.label} (MMK)`],
      ...rows.map((r: any) => [
        r.customer.company || r.customer.org_name || r.customer.name,
        r.customer.legacy_id || r.customer.id,
        r.vmCount,
        r.lifetimeSpend,
        r.ytdRevenue
      ])
    ]

    // Create workbook and worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Report')

    // Download file
    XLSX.writeFile(workbook, `revenue-report-${displayFiscalYear.label}-${new Date().toISOString().split('T')[0]}.xlsx`)

    toast('Excel exported successfully', 'success')
  }

  // Helper to get revenue for a specific fiscal year
  const getFiscalYearRevenue = (customerId: string, startDate: string, endDate: string) => {
    return displayInvoices
      .filter(inv => {
        if (inv.customer_id !== customerId || inv.status !== 'Payment Received') return false
        if (!inv.invoice_date) return false
        const invoiceDate = new Date(inv.invoice_date)
        const fiscalStart = new Date(startDate)
        const fiscalEnd = new Date(endDate)
        return invoiceDate >= fiscalStart && invoiceDate <= fiscalEnd
      })
      .reduce((sum, inv) => sum + inv.amount, 0)
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Per-customer revenue · upcoming renewals · payment performance</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={exportCSV}><Icon name="download" size={13} />Export CSV</button>
          <button className="btn" onClick={exportExcel}><Icon name="download" size={13} />Export Excel</button>
        </div>
      </div>

      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-head"><h3 className="card-title">Revenue by customer · YTD</h3></div>

          <div className="filter-bar" style={{ marginBottom: 16 }}>
            <button className={`filter-chip ${dateFilter === 'all' ? 'active' : ''}`} onClick={() => setDateFilter('all')}>All</button>
            <button className={`filter-chip ${dateFilter === 'custom' ? 'active' : ''}`} onClick={() => setDateFilter('custom')}>Date</button>

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
                  {isLoading ? (
                    <tr><td colSpan={4}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><Spinner /></div></td></tr>
                  ) : (() => {
                    const rows = [...displayCustomers]
                      .map(c => {
                        const lifetimeSpend = allInvoices
                          .filter(inv => inv.customer_id === c.id && inv.status === 'Payment Received')
                          .reduce((sum, inv) => sum + inv.amount, 0)

                        if (lifetimeSpend === 0) return null

                        return {
                          customer: c,
                          lifetimeSpend
                        }
                      })
                      .filter(Boolean)
                      .sort((a: any, b: any) => b.lifetimeSpend - a.lifetimeSpend)

                    return rows.length ? (
                      rows.map(({ customer: c, lifetimeSpend }: any) => {
                        const ytdRevenue = getFiscalYearRevenue(c.id, displayFiscalYear.start, displayFiscalYear.end)
                        return (
                          <tr key={c.id}>
                            <td style={{ verticalAlign: 'top' }}>
                              <div className="fw-6 text-sm">{c.company || c.org_name || c.name}</div>
                              <div className="text-xs text-mute">{c.legacy_id || c.id}</div>
                            </td>
                            <td className="right tnum" style={{ verticalAlign: 'top' }}>
                              {displayVMs.filter(v => v.customer_id === c.id).length}
                            </td>
                            <td className="right tnum" style={{ verticalAlign: 'top' }}>
                              {formatMMK(lifetimeSpend)} MMK
                            </td>
                            <td style={{ verticalAlign: 'top' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{displayFiscalYear.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{formatMMK(ytdRevenue)} MMK</div>
                            </td>
                          </tr>
                        )
                      })
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
                  <td className="right tnum fw-7">{[...displayCustomers].reduce((sum, c) => {
                    const lifetimeSpend = allInvoices.filter(inv => inv.customer_id === c.id && inv.status === 'Payment Received').reduce((s, inv) => s + inv.amount, 0)
                    if (lifetimeSpend === 0) return sum
                    return sum + displayVMs.filter(v => v.customer_id === c.id).length
                  }, 0)}</td>
                  <td className="right tnum fw-7">MMK {formatMMK([...displayCustomers].reduce((sum, c) => {
                    const lifetimeSpend = allInvoices.filter(inv => inv.customer_id === c.id && inv.status === 'Payment Received').reduce((s, inv) => s + inv.amount, 0)
                    return sum + lifetimeSpend
                  }, 0))}</td>
                  <td className="right tnum fw-7">
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{displayFiscalYear.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>MMK {formatMMK([...displayCustomers].reduce((sum, c) => {
                      return sum + getFiscalYearRevenue(c.id, displayFiscalYear.start, displayFiscalYear.end)
                    }, 0))}</div>
                  </td>
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
                {displayVMs.filter(v => v.expiry && v.expiry !== '—' && typeof v.expiry === 'string' && (new Date(v.expiry).getTime() - new Date().getTime()) / 86400000 <= 30 && (new Date(v.expiry).getTime() - new Date().getTime()) / 86400000 >= 0)
                  .sort((a, b) => new Date(a.expiry || '').getTime() - new Date(b.expiry || '').getTime()).map(v => {
                    const c = displayCustomers.find(c => c.id === v.customer_id)
                    return (
                      <tr key={v.id}>
                        <td><div className="fw-6 text-sm">{v.hostname}</div><div className="text-xs text-mute mono">{v.legacy_id || v.id}</div></td>
                        <td className="text-sm">{c?.company || c?.org_name || c?.name}</td>
                        <td><ExpiryCell date={v.expiry || ''} /></td>
                        <td className="right tnum fw-6">—</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* <div className="card mb-4">
        <div className="card-head"><h3 className="card-title">Payment performance · last 6 months</h3></div>
        <div className="card-body">
          <div className="flex" style={{ alignItems: 'flex-end', gap: 12, height: 160 }}>
            {(() => {
              // Calculate real payment performance for last 6 months
              const months = []
              const now = new Date()
              for (let i = 5; i >= 0; i--) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
                const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
                const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
                
                const monthInvoices = displayInvoices.filter(inv => {
                  if (!inv.invoice_date || !inv.due) return false
                  const invDate = new Date(inv.invoice_date)
                  return invDate >= monthStart && invDate <= monthEnd
                })
                
                const paidOnTime = monthInvoices.filter(inv => {
                  if (!inv.paid_date || !inv.due) return false
                  const paidDate = new Date(inv.paid_date)
                  const dueDate = new Date(inv.due)
                  return paidDate <= dueDate
                }).length
                
                const totalInvoices = monthInvoices.length
                const percentage = totalInvoices > 0 ? Math.round((paidOnTime / totalInvoices) * 100) : 0
                
                months.push([monthName, percentage])
              }
              
              return months.map(([m, pct]) => {
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
              })
            })()}
          </div>
          <div className="text-xs text-mute mt-3">% of invoices paid before due date · cumulative across all customers</div>
        </div>
      </div> */}

    </div>
  )
}
