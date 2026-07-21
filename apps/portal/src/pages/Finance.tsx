import React, { useState, useEffect, useRef } from 'react'
import useInvoiceStore from '../store/invoiceStore'
import useCustomerStore from '../store/customerStore'
import useVMRequestStore from '../store/vmRequestStore'
import useAddonRequestStore from '../store/addonRequestStore'
import useQuoteStore from '../store/quoteStore'
import useVMStore from '../store/vmStore'
import useUIStore from '../store/uiStore'
import useReceiptStore from '../store/receiptStore'
import Icon from '../lib/icons'
import { formatMMK, StatusPill, CircularSpinner } from '../components/ui/ui'
import { InvoiceDrawer } from '../components/finance/InvoiceDrawer'
import { ReportsView } from '../components/finance/ReportsView'
import { exportToCSV } from '@/lib/csvExport'
import { exportToPDF } from '@/lib/pdfExport'

interface FinanceViewProps {
  openCust: (id: string) => void
  openModal: (kind: string, props?: any) => void
}

const FinanceView: React.FC<FinanceViewProps> = ({ openCust, openModal }) => {
  const { invoices, invoicesLoading, markPaid, loadInvoices } = useInvoiceStore()
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { addonRequests, loadAddonRequests } = useAddonRequestStore()
  const { quotes, loadQuotes } = useQuoteStore()
  const { vms, loadVMs } = useVMStore()
  const { toast } = useUIStore()
  const { addReceipt } = useReceiptStore()
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)

  useEffect(() => {
    if (invoices.length === 0) {
      loadInvoices()
    }
    loadAddonRequests()
    loadQuotes()
    loadVMs()
  }, [loadInvoices, loadAddonRequests, loadQuotes, loadVMs])
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showExportColumns, setShowExportColumns] = useState(false)
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([
    'invoiceId', 'invoiceDate', 'qty', 'customerName', 'customerCode', 'quotation', 'status', 'vmName', 'requestId', 'netAmount', 'vat', 'grossAmount'
  ])
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  const exportColumnOptions = [
    { key: 'invoiceId', label: 'Invoice ID' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'qty', label: 'Qty' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'customerCode', label: 'Customer Code' },
    { key: 'paidDate', label: 'Paid Date' },
    { key: 'quotation', label: 'Quotation' },
    { key: 'status', label: 'Status' },
    { key: 'vmName', label: 'VM Name' },
    { key: 'requestId', label: 'Request ID' },
    { key: 'discount', label: 'Discount' },
    { key: 'netAmount', label: 'Net Amount' },
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
      if (!inv.invoice_date) return false
      return inv.invoice_date >= startDate && inv.invoice_date <= endDate
    }

    // Search filter
    if (searchTerm) {
      const customer = customers.find(c => c.id === inv.customer_id)
      const invoiceId = inv.legacy_id || inv.id.slice(0, 8)
      const customerName = customer?.name || ''
      const customerOrg = customer?.org_name || ''
      const searchLower = searchTerm.toLowerCase()
      
      return (
        invoiceId.toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower) ||
        customerOrg.toLowerCase().includes(searchLower)
      )
    }

    return true
  })

  const total = invoices.reduce((a, i) => a + i.amount, 0)
  const received = invoices.filter(i => i.status === 'Payment Received').reduce((a, i) => a + i.amount, 0)
  const pending = invoices.filter(i => i.status === 'Pending' || i.status === 'Customer Transferred').reduce((a, i) => a + i.amount, 0)
  const overdue = invoices.filter(i => i.status === 'Overdue').reduce((a, i) => a + i.amount, 0)

  return (
    <div className="content">
      {view === 'list' ? (
        <>
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
                            const c = customers.find(cust => cust.id === i.customer_id)
                            const vmRequestsList = vmRequests.filter((v: any) => i.vm_request_ids.includes(v.id))
                            const addonRequestsList = addonRequests.filter((a: any) => i.addon_request_ids.includes(a.id))
                            const totalQty = (i.line_items || []).reduce((sum: number, item: any) => {
                              if (item.kind === 'instance') return sum + (item.qty || 1)
                              return sum
                            }, 0)
                            const data: any = {}
                            if (selectedExportColumns.includes('invoiceId')) data['Invoice ID'] = i.legacy_id || i.id.slice(0, 8)
                            if (selectedExportColumns.includes('invoiceDate')) data['Invoice Date'] = i.invoice_date || ''
                            if (selectedExportColumns.includes('qty')) data['Qty'] = totalQty
                            if (selectedExportColumns.includes('customerName')) data['Customer Name'] = `${c?.name}${c?.org_name ? ` (${c?.org_name})` : ''}`
                            if (selectedExportColumns.includes('customerCode')) data['Customer Code'] = c?.legacy_id || c?.id || ''
                            if (selectedExportColumns.includes('paidDate')) data['Paid Date'] = i.paid_date ? new Date(i.paid_date).toLocaleDateString() : ''
                            if (selectedExportColumns.includes('quotation')) {
                              const quote = quotes.find((q: any) => q.id === i.quote_id)
                              data['Quotation'] = quote?.legacy_id || ''
                            }
                            if (selectedExportColumns.includes('status')) data['Status'] = i.status
                            if (selectedExportColumns.includes('vmName')) data['VM Name'] = vmRequestsList.map((v: any) => v.hostname).join(', ')
                            if (selectedExportColumns.includes('requestId')) {
                              const vmRequestIds = vmRequestsList.map((v: any) => v.legacy_id || v.id.slice(0, 8))
                              const addonRequestIds = addonRequestsList.map((a: any) => a.legacy_id || a.id.slice(0, 8))
                              data['Request ID'] = [...vmRequestIds, ...addonRequestIds].join(', ')
                            }
                            if (selectedExportColumns.includes('discount')) data['Discount'] = i.discount || 0
                            if (selectedExportColumns.includes('netAmount')) data['Net Amount'] = i.net_amount || i.amount
                            if (selectedExportColumns.includes('vat')) data['VAT'] = i.vat || 0
                            if (selectedExportColumns.includes('grossAmount')) data['Gross Amount'] = i.gross_amount || i.amount
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
                            const c = customers.find(cust => cust.id === i.customer_id)
                            const vmRequestsList = vmRequests.filter((v: any) => i.vm_request_ids.includes(v.id))
                            const addonRequestsList = addonRequests.filter((a: any) => i.addon_request_ids.includes(a.id))
                            const totalQty = (i.line_items || []).reduce((sum: number, item: any) => {
                              if (item.kind === 'instance') return sum + (item.qty || 1)
                              return sum
                            }, 0)
                            const data: any = {}
                            if (selectedExportColumns.includes('invoiceId')) data.invoiceId = i.legacy_id || i.id.slice(0, 8)
                            if (selectedExportColumns.includes('invoiceDate')) data.invoiceDate = i.invoice_date || ''
                            if (selectedExportColumns.includes('qty')) data.qty = totalQty
                            if (selectedExportColumns.includes('customerName')) data.customerName = `${c?.name}${c?.org_name ? ` (${c?.org_name})` : ''}`
                            if (selectedExportColumns.includes('customerCode')) data.customerCode = c?.legacy_id || c?.id || ''
                            if (selectedExportColumns.includes('paidDate')) data.paidDate = i.paid_date ? new Date(i.paid_date).toLocaleDateString() : ''
                            if (selectedExportColumns.includes('quotation')) {
                              const quote = quotes.find((q: any) => q.id === i.quote_id)
                              data.quotation = quote?.legacy_id || ''
                            }
                            if (selectedExportColumns.includes('status')) data.status = i.status
                            if (selectedExportColumns.includes('vmName')) data.vmName = vmRequestsList.map((v: any) => v.hostname).join(', ')
                            if (selectedExportColumns.includes('requestId')) {
                              const vmRequestIds = vmRequestsList.map((v: any) => v.legacy_id || v.id.slice(0, 8))
                              const addonRequestIds = addonRequestsList.map((a: any) => a.legacy_id || a.id.slice(0, 8))
                              data.requestId = [...vmRequestIds, ...addonRequestIds].join(', ')
                            }
                            if (selectedExportColumns.includes('discount')) data.discount = i.discount || 0
                            if (selectedExportColumns.includes('netAmount')) data.netAmount = i.net_amount || i.amount
                            if (selectedExportColumns.includes('vat')) data.vat = i.vat || 0
                            if (selectedExportColumns.includes('grossAmount')) data.grossAmount = i.gross_amount || i.amount
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

              {/* <button className="btn primary" onClick={() => openModal('newinvoice')}><Icon name="plus" size={13} />New invoice</button> */}
            </div>
          </div>

          <div className="grid-4 mb-4">
            <div className="metric"><div className="label">Total billed ({new Date().toLocaleDateString('en-US', { month: 'long' })})</div><div className="value tnum" style={{ fontSize: 22 }}>MMK {formatMMK(total)}</div></div>
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
                <input 
                  placeholder="Invoice #, customer…" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
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
                    {selectedExportColumns.includes('invoiceId') && <th>Invoice ID</th>}
                    {selectedExportColumns.includes('invoiceDate') && <th>Invoice Date</th>}
                    {selectedExportColumns.includes('qty') && <th>Qty</th>}
                    {selectedExportColumns.includes('customerName') && <th>Customer Name</th>}
                    {selectedExportColumns.includes('customerCode') && <th>Customer Code</th>}
                    {selectedExportColumns.includes('paidDate') && <th>Paid Date</th>}
                    {selectedExportColumns.includes('quotation') && <th>Quotation</th>}
                    {selectedExportColumns.includes('status') && <th>Status</th>}
                    {selectedExportColumns.includes('vmName') && <th>VM Name</th>}
                    {selectedExportColumns.includes('requestId') && <th>Request ID</th>}
                    {selectedExportColumns.includes('discount') && <th className="right">Discount</th>}
                    {selectedExportColumns.includes('netAmount') && <th className="right">Net Amount</th>}
                    {selectedExportColumns.includes('vat') && <th className="right">VAT</th>}
                    {selectedExportColumns.includes('grossAmount') && <th className="right">Gross Amount</th>}
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesLoading ? (
                    <tr><td colSpan={selectedExportColumns.length + 1}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={selectedExportColumns.length + 1}><div className="empty"><div className="title">No invoices yet</div><div className="sub">Invoices will appear here once they're generated.</div></div></td></tr>
                  ) : (
                    filtered.map(i => {
                      const c = customers.find(c => c.id === i.customer_id)
                      const vmRequestsList = vmRequests.filter((v: any) => i.vm_request_ids.includes(v.id))
                      const addonRequestsList = addonRequests.filter((a: any) => i.addon_request_ids.includes(a.id))
                      const addonVMs = addonRequestsList.map((a: any) => vms.find((vm: any) => vm.id === a.vm_id)).filter(Boolean)
                      const totalQty = (i.line_items || []).reduce((sum: number, item: any) => {
                        if (item.kind === 'instance') return sum + (item.qty || 1)
                        return sum
                      }, 0)
                      return (
                        <tr key={i.id} onClick={() => { setSelectedInvoice(i); setView('detail'); }}>
                        {selectedExportColumns.includes('invoiceId') && <td className="mono fw-6 text-sm">{i.legacy_id || i.id.slice(0, 8)}</td>}
                        {selectedExportColumns.includes('invoiceDate') && <td className="tnum text-sm">{i.invoice_date ? new Date(i.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</td>}
                        {selectedExportColumns.includes('qty') && <td className="tnum text-sm">{totalQty}</td>}
                        {selectedExportColumns.includes('customerName') && <td><div className="fw-6 text-sm">{c?.name}{c?.org_name ? ` (${c?.org_name})` : ''}</div></td>}
                        {selectedExportColumns.includes('customerCode') && <td className="mono text-sm">{c?.legacy_id || c?.id}</td>}
                        {selectedExportColumns.includes('paidDate') && <td className="tnum text-sm">{i.paid_date ? new Date(i.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</td>}
                        {selectedExportColumns.includes('quotation') && <td className="mono text-sm">{(() => {
                          const quote = quotes.find((q: any) => q.id === i.quote_id)
                          return quote?.legacy_id || '—'
                        })()}</td>}
                        {selectedExportColumns.includes('status') && <td><StatusPill status={i.status}/></td>}
                        {selectedExportColumns.includes('vmName') && <td className="text-sm">{[...vmRequestsList.map((v: any) => v.hostname), ...addonVMs.map((vm: any) => vm.hostname)].join(', ')}</td>}
                        {selectedExportColumns.includes('requestId') && (
                          <td className="mono text-sm">
                            {[...vmRequestsList.map((v: any) => v.legacy_id || v.id.slice(0, 8)), ...addonRequestsList.map((a: any) => a.legacy_id || a.id.slice(0, 8))].join(', ')}
                          </td>
                        )}
                        {selectedExportColumns.includes('discount') && <td className="right tnum text-sm">MMK {formatMMK(i.discount || 0)}</td>}
                        {selectedExportColumns.includes('netAmount') && <td className="right tnum text-sm">MMK {formatMMK(i.net_amount || i.amount)}</td>}
                        {selectedExportColumns.includes('vat') && <td className="right tnum text-sm">MMK {formatMMK(i.vat || 0)}</td>}
                        {selectedExportColumns.includes('grossAmount') && <td className="right tnum fw-6 text-sm">MMK {formatMMK(i.gross_amount || i.amount)}</td>}
                        <td onClick={e => e.stopPropagation()} className="right">
                          {i.status === 'Payment Received' ? (
                            <button className="btn sm" onClick={async () => {
                              const { supabase } = await import('../lib/supabase')
                              const { data: { user } } = await supabase.auth.getUser()
                              const timestamp = Date.now().toString(36)
                              const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
                              const receiptNumber = `RCT-${timestamp}-${random}`
                              const legacyId = `RCT-${Math.floor(1000 + Math.random() * 9000)}`
                              const message = `Thank you for your payment. Your receipt ${legacyId} for invoice ${i.legacy_id || i.id} has been sent.`
                              
                              // Open modal immediately
                              openModal('email', { to: c?.email, template: 'receipt', invoiceId: i.id })
                              
                              // Add receipt in background
                              await addReceipt({
                                invoice_id: i.id,
                                customer_id: i.customer_id,
                                legacy_id: legacyId,
                                receipt_number: receiptNumber,
                                message: message,
                                sent_by: user?.id,
                                status: 'sent'
                              })
                            }}><Icon name="mail" size={11} />Send receipt</button>
                          ) : (
                            <button className="btn sm" onClick={() => markPaid(i.id, `RCT-${i.id.slice(0, 8)}`)}><Icon name="check" size={11} />Mark paid</button>
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
        </>
      ) : (
        <InvoiceDrawer invoice={selectedInvoice} onClose={() => setView('list')} openCust={openCust} openModal={openModal} />
      )}
    </div>
  )
}

export { FinanceView, ReportsView }

