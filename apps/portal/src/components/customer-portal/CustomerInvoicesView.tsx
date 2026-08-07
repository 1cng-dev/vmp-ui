import React, { useEffect, useState } from 'react'
import { StatusPill, formatMMK, CircularSpinner } from '../ui/ui'
import Icon from '../../lib/icons'
import useVMRequestStore from '../../store/vmRequestStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import useQuoteStore from '../../store/quoteStore'
import useVMStore from '../../store/vmStore'
import useCustomerStore from '../../store/customerStore'
import useInvoiceStore from '../../store/invoiceStore'
import { exportInvoiceToPDF } from '../../lib/pdfExport'

interface CustomerInvoicesViewProps {
  myInvs: any[]
  setDetailInvoice: (invoice: any) => void
}

export const CustomerInvoicesView: React.FC<CustomerInvoicesViewProps> = ({ myInvs, setDetailInvoice }) => {
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const { vmRequests } = useVMRequestStore()
  const { addonRequests, loadAddonRequests } = useAddonRequestStore()
  const { quotes, loadQuotes } = useQuoteStore()
  const { vms, loadVMs } = useVMStore()
  const { customers } = useCustomerStore()
  const { invoicesLoading } = useInvoiceStore()
  
  const transformStatus = (status: string) => {
    if (status === 'Pending') return 'Under Review'
    return status
  }

  // Helper function to get VM name - use vm_id if available, otherwise use request hostname
  const getVMName = (request: any) => {
    if (request.vm_id) {
      const vm = vms.find((v: any) => v.id === request.vm_id)
      if (vm) {
        return (vm as any).hostname || request.hostname
      }
    }
    return request.hostname
  }

  useEffect(() => {
    loadAddonRequests()
    loadQuotes()
    loadVMs()
  }, [loadAddonRequests, loadQuotes, loadVMs])

  const filters = [
    { id: 'all', label: 'All', count: myInvs.length },
    { id: 'Pending', label: 'Pending', count: myInvs.filter(i => i.status === 'Pending').length },
    { id: 'Customer Transferred', label: 'Customer Transferred', count: myInvs.filter(i => i.status === 'Customer Transferred').length },
    { id: 'Payment Received', label: 'Payment Received', count: myInvs.filter(i => i.status === 'Payment Received').length },
    { id: 'Overdue', label: 'Overdue', count: myInvs.filter(i => i.status === 'Overdue').length },
    { id: 'Cancelled', label: 'Cancelled', count: myInvs.filter(i => i.status === 'Cancelled').length },
  ]

  const filtered = myInvs.filter(inv => {
    if (filter !== 'all' && inv.status !== filter) return false
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const invoiceId = (inv.legacy_id || inv.id).toLowerCase()
      if (!invoiceId.includes(searchLower)) return false
    }
    if (startDate && inv.invoice_date) {
      if (new Date(inv.invoice_date) < new Date(startDate)) return false
    }
    if (endDate && inv.invoice_date) {
      if (new Date(inv.invoice_date) > new Date(endDate)) return false
    }
    return true
  })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{myInvs.length} invoices · click any row to view full details</p>
        </div>
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
              placeholder="Invoice #…" 
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

        <div className="card-body flush" style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Invoice Date</th>
                <th>Qty</th>
                <th>VM Name</th>
                <th>Request ID</th>
                <th>Quotation</th>
                <th>Status</th>
                <th className="right">Discount</th>
                <th className="right">Net Amount</th>
                <th className="right">VAT</th>
                <th className="right">Gross Amount</th>
                <th>Paid Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoicesLoading ? (
                <tr><td colSpan={13}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
              ) : (
                <>
                  {filtered.length === 0 && <tr><td colSpan={13}><div className="empty"><div className="title">No invoices yet</div><div className="sub">Invoices will appear here once they're generated for your VMs.</div></div></td></tr>}
              {filtered.map((i: any) => {
                const vmRequestsList = vmRequests.filter((v: any) => i.vm_request_ids && i.vm_request_ids.includes(v.id))
                const addonRequestsList = addonRequests.filter((a: any) => i.addon_request_ids && i.addon_request_ids.includes(a.id))
                // For add-on requests, get VM names from addon request vm_id
                const addonVMNames = addonRequestsList.map((a: any) => {
                  const vm = vms.find((vm: any) => vm.id === a.vm_id)
                  return vm ? vm.hostname : `VM (${a.vm_id?.slice(0, 8)})`
                })
                // For VM requests (renewal, change plan, trial to paid), get VM names from vm_request
                const vmRequestNames = vmRequestsList.map((v: any) => getVMName(v))
                // If invoice has add-on requests, show only add-on VM names, otherwise show VM request names
                const vmNames = addonRequestsList.length > 0 ? addonVMNames : vmRequestNames
                const totalQty = (i.line_items || []).reduce((sum: number, item: any) => {
                  if (item.kind === 'instance') return sum + (item.qty || 1)
                  return sum
                }, 0)
                return (
                  <tr key={i.id} onClick={() => setDetailInvoice(i)}>
                    <td className="mono fw-6 text-sm">{i.legacy_id || i.id.slice(0, 8)}</td>
                    <td className="tnum text-sm">{i.invoice_date ? new Date(i.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</td>
                    <td className="tnum text-sm">{totalQty}</td>
                    <td className="text-sm">{vmNames.join(', ')}</td>
                    <td className="mono text-sm">
                      {[...vmRequestsList.map((v: any) => v.legacy_id || v.id.slice(0, 8)), ...addonRequestsList.map((a: any) => a.legacy_id || a.id.slice(0, 8))].join(', ')}
                    </td>
                    <td className="mono text-sm">{(() => {
                      const quote = quotes.find((q: any) => q.id === i.quote_id)
                      return quote?.legacy_id || '—'
                    })()}</td>
                    <td><StatusPill status={i.status} transformStatus={transformStatus}/></td>
                    <td className="right tnum text-sm">MMK {formatMMK(i.discount || 0)}</td>
                    <td className="right tnum text-sm">MMK {formatMMK(i.net_amount || i.amount)}</td>
                    <td className="right tnum text-sm">MMK {formatMMK(i.vat || 0)}</td>
                    <td className="right tnum fw-6 text-sm">MMK {formatMMK(i.gross_amount || i.amount)}</td>
                    <td className="tnum text-sm">{i.paid_date ? new Date(i.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</td>
                    <td className="right" onClick={e => e.stopPropagation()}>
                      <button className="btn sm" onClick={async () => {
                        const c = customers.find(cust => cust.id === i.customer_id || cust.id === i.customer)
                        if (c) await exportInvoiceToPDF(i, c)
                      }}><Icon name="download" size={11}/>PDF</button>
                    </td>
                  </tr>
                )
              })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
