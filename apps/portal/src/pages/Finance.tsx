import React, { useState, useEffect, useRef } from 'react'
import useInvoiceStore from '../store/invoiceStore'
import useCustomerStore from '../store/customerStore'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { formatMMK } from '../components/ui/ui'
import { InvoiceDrawer } from '../components/finance/InvoiceDrawer'
import { ReportsView } from '../components/finance/ReportsView'
import { exportToCSV } from '@/lib/csvExport'
import { exportToPDF } from '@/lib/pdfExport'

interface FinanceViewProps {
  openCust: (id: string) => void
  openModal: (kind: string, props?: any) => void
}

const FinanceView: React.FC<FinanceViewProps> = ({ openCust, openModal }) => {
  const { invoices, markPaid } = useInvoiceStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<any>(null)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showExportColumns, setShowExportColumns] = useState(false)
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([
    'invoiceDate', 'qty', 'customerName', 'customerCode', 'quotation', 'vat', 'grossAmount'
  ])
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  const exportColumnOptions = [
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'qty', label: 'Qty' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'customerCode', label: 'Customer Code' },
    { key: 'paidDate', label: 'Paid Date' },
    { key: 'quotation', label: 'Quotation' },
    { key: 'vat', label: 'VAT' },
    { key: 'grossAmount', label: 'Gross Amount' },
  ]

  const toggleExportColumn = (key: string) => {
    setSelectedExportColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportColumns(false)
      }
    }

    if (showExportColumns) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportColumns])

  const filters = [
    { id: 'all', label: 'All', count: invoices.length },
    { id: 'Pending', label: 'Pending', count: invoices.filter(i => i.status === 'Pending').length },
    { id: 'Customer Transferred', label: 'Customer Transferred', count: invoices.filter(i => i.status === 'Customer Transferred').length },
    { id: 'Payment Received', label: 'Payment Received', count: invoices.filter(i => i.status === 'Payment Received').length },
    { id: 'Overdue', label: 'Overdue', count: invoices.filter(i => i.status === 'Overdue').length },
  ]

  const filtered = invoices.filter(inv => {
    // Status filter
    if (filter !== 'all' && inv.status !== filter) return false

    // Date filter
    if (showDateFilter && startDate && endDate) {
      if (!inv.invoiceDate) return false
      return inv.invoiceDate >= startDate && inv.invoiceDate <= endDate
    }

    return true
  })

  const total = invoices.reduce((a, i) => a + i.amount, 0)
  const received = invoices.filter(i => i.status === 'Payment Received').reduce((a, i) => a + i.amount, 0)
  const pending = invoices.filter(i => i.status === 'Pending' || i.status === 'Customer Transferred').reduce((a, i) => a + i.amount, 0)
  const overdue = invoices.filter(i => i.status === 'Overdue').reduce((a, i) => a + i.amount, 0)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices · MMK {formatMMK(total)} total billed</p>
        </div>
        <div className="page-actions">
         
          <div style={{ position: 'relative' }} ref={exportDropdownRef}>
            <button
              className="btn"
              onClick={() => setShowExportColumns(!showExportColumns)}
            >
              <Icon name="download" size={13} />Export
            </button>

            {showExportColumns && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
                minWidth: 220,
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Select columns:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {exportColumnOptions.map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', cursor: 'pointer', borderRadius: 4, transition: 'background 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <input
                        type="checkbox"
                        checked={selectedExportColumns.includes(opt.key)}
                        onChange={() => toggleExportColumn(opt.key)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                  <button
                    className="btn sm"
                    onClick={() => {
                      if (selectedExportColumns.length === 0) {
                        toast('Please select at least one column', 'error')
                        return
                      }
                      if (filtered.length === 0) {
                        toast('No invoices to export', 'error')
                        return
                      }
                      const csvData = filtered.map(i => {
                        const c = customers.find(cust => cust.id === i.customer)
                        const data: any = {}
                        if (selectedExportColumns.includes('invoiceDate')) data['Invoice Date'] = i.invoiceDate || ''
                        if (selectedExportColumns.includes('qty')) data['Qty'] = i.vms.length
                        if (selectedExportColumns.includes('customerName')) data['Customer Name'] = c?.org_name || ''
                        if (selectedExportColumns.includes('customerCode')) data['Customer Code'] = c?.id || ''
                        if (selectedExportColumns.includes('paidDate')) data['Paid Date'] = i.status === 'Payment Received' ? i.issued : ''
                        if (selectedExportColumns.includes('quotation')) data['Quotation'] = `QT-${i.id.slice(4)}`
                        if (selectedExportColumns.includes('vat')) data['VAT'] = i.vat || 0
                        if (selectedExportColumns.includes('grossAmount')) data['Gross Amount'] = i.grossAmount || i.amount
                        return data
                      })
                      exportToCSV(csvData, `invoices-${new Date().toISOString().slice(0, 10)}`)
                      setShowExportColumns(false)
                      toast('Invoices CSV download started', 'info')
                    }}
                  >
                    CSV
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => {
                      if (selectedExportColumns.length === 0) {
                        toast('Please select at least one column', 'error')
                        return
                      }
                      if (filtered.length === 0) {
                        toast('No invoices to export', 'error')
                        return
                      }
                      const pdfData = filtered.map(i => {
                        const c = customers.find(cust => cust.id === i.customer)
                        const data: any = {}
                        if (selectedExportColumns.includes('invoiceDate')) data.invoiceDate = i.invoiceDate || ''
                        if (selectedExportColumns.includes('qty')) data.qty = i.vms.length
                        if (selectedExportColumns.includes('customerName')) data.customerName = c?.org_name || ''
                        if (selectedExportColumns.includes('customerCode')) data.customerCode = c?.id || ''
                        if (selectedExportColumns.includes('paidDate')) data.paidDate = i.status === 'Payment Received' ? i.issued : ''
                        if (selectedExportColumns.includes('quotation')) data.quotation = `QT-${i.id.slice(4)}`
                        if (selectedExportColumns.includes('vat')) data.vat = i.vat || 0
                        if (selectedExportColumns.includes('grossAmount')) data.grossAmount = i.grossAmount || i.amount
                        return data
                      })
                      const columns = selectedExportColumns.map(key => {
                        const opt = exportColumnOptions.find(o => o.key === key)
                        return { key, label: opt?.label || key }
                      })
                      exportToPDF(
                        pdfData,
                        `invoices-${new Date().toISOString().slice(0, 10)}`,
                        'Invoice Report',
                        columns
                      )
                      setShowExportColumns(false)
                      toast('Invoices PDF download started', 'info')
                    }}
                  >
                    PDF
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="btn primary" onClick={() => openModal('newinvoice')}><Icon name="plus" size={13} />New invoice</button>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="metric"><div className="label">Total billed (May)</div><div className="value tnum" style={{ fontSize: 22 }}>MMK {formatMMK(total)}</div></div>
        <div className="metric"><div className="label">Received</div><div className="value tnum" style={{ fontSize: 22, color: 'var(--ok)' }}>MMK {formatMMK(received)}</div></div>
        <div className="metric"><div className="label">Pending</div><div className="value tnum" style={{ fontSize: 22, color: 'oklch(0.55 0.16 75)' }}>MMK {formatMMK(pending)}</div></div>
        <div className="metric"><div className="label">Overdue</div><div className="value tnum" style={{ fontSize: 22, color: 'var(--bad)' }}>MMK {formatMMK(overdue)}</div></div>
      </div>

      <div className="card">
        <div className="filter-bar">
          {filters.map(f => (
            <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(filter === f.id ? 'all' : f.id)}>
              {f.label}<span className="ct">{f.count}</span>
            </button>
          ))}
          <button className={`filter-chip ${showDateFilter ? 'active' : ''}`} onClick={() => setShowDateFilter(!showDateFilter)}>Date</button>
          <div style={{ flex: 1 }} />
          <div className="search" style={{ width: 220 }}>
            <Icon name="search" size={13} className="search-icon" />
            <input placeholder="Invoice #, customer…" />
          </div>
        </div>

        {showDateFilter && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 10px' }}
            />
            <span style={{ color: 'var(--text-2)' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 10px' }}
            />
            <button
              className="btn sm"
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setShowDateFilter(false)
              }}
              style={{ marginLeft: 8 }}
            >
              Clear
            </button>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                {selectedExportColumns.includes('invoiceDate') && <th>Invoice Date</th>}
                {selectedExportColumns.includes('qty') && <th>Qty</th>}
                {selectedExportColumns.includes('customerName') && <th>Customer Name</th>}
                {selectedExportColumns.includes('customerCode') && <th>Customer Code</th>}
                {selectedExportColumns.includes('paidDate') && <th>Paid Date</th>}
                {selectedExportColumns.includes('quotation') && <th>Quotation</th>}
                {selectedExportColumns.includes('vat') && <th className="right">VAT</th>}
                {selectedExportColumns.includes('grossAmount') && <th className="right">Gross Amount</th>}
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const c = customers.find(c => c.id === i.customer)
                return (
                  <tr key={i.id} onClick={() => setSelected(i)}>
                    {selectedExportColumns.includes('invoiceDate') && <td className="tnum text-sm">{i.invoiceDate}</td>}
                    {selectedExportColumns.includes('qty') && <td className="tnum text-sm">{i.vms.length}</td>}
                    {selectedExportColumns.includes('customerName') && <td><div className="fw-6 text-sm">{c?.name} ({c?.org_name})</div></td>}
                    {selectedExportColumns.includes('customerCode') && <td className="mono text-sm">{c?.id}</td>}
                    {selectedExportColumns.includes('paidDate') && <td className="tnum text-sm">{i.status === 'Payment Received' ? i.issued : '—'}</td>}
                    {selectedExportColumns.includes('quotation') && <td className="mono text-sm">QT-{i.id.slice(4)}</td>}
                    {selectedExportColumns.includes('vat') && <td className="right tnum text-sm">MMK {formatMMK(i.vat || 0)}</td>}
                    {selectedExportColumns.includes('grossAmount') && <td className="right tnum fw-6 text-sm">MMK {formatMMK(i.grossAmount || i.amount)}</td>}
                    <td onClick={e => e.stopPropagation()} className="right">
                      {i.status !== 'Payment Received' && <button className="btn sm" onClick={() => markPaid(i.id)}><Icon name="check" size={11} />Mark paid</button>}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={selectedExportColumns.length + 1}><div className="empty"><div className="title">No invoices found</div><div className="sub">Try adjusting filters or create a new invoice.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <InvoiceDrawer invoice={selected} onClose={() => setSelected(null)} openCust={openCust} openModal={openModal} />}
    </div>
  )
}

export { FinanceView, ReportsView }
