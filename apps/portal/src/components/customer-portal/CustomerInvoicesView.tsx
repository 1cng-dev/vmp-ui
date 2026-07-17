import React, { useEffect } from 'react'
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
  const { vmRequests } = useVMRequestStore()
  const { addonRequests, loadAddonRequests } = useAddonRequestStore()
  const { quotes, loadQuotes } = useQuoteStore()
  const { vms, loadVMs } = useVMStore()
  const { customers } = useCustomerStore()
  const { invoicesLoading } = useInvoiceStore()

  useEffect(() => {
    if (addonRequests.length === 0) {
      loadAddonRequests()
    }
    if (quotes.length === 0) {
      loadQuotes()
    }
    if (vms.length === 0) {
      loadVMs()
    }
  }, [addonRequests.length, quotes.length, vms.length, loadAddonRequests, loadQuotes, loadVMs])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Invoices & receipts</h1>
          <p className="page-subtitle">{myInvs.length} invoices · click any row to view full details</p>
        </div>
      </div>
      <div className="card">
        <div className="card-body flush" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
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
                  {myInvs.length === 0 && <tr><td colSpan={13}><div className="empty"><div className="title">No invoices yet</div><div className="sub">Invoices will appear here once they're generated for your VMs.</div></div></td></tr>}
              {myInvs.map((i: any) => {
                const vmRequestsList = vmRequests.filter((v: any) => i.vm_request_ids && i.vm_request_ids.includes(v.id))
                const addonRequestsList = addonRequests.filter((a: any) => i.addon_request_ids && i.addon_request_ids.includes(a.id))
                const addonVMs = addonRequestsList.map((a: any) => vms.find((vm: any) => vm.id === a.vm_id)).filter(Boolean)
                const totalQty = (i.line_items || []).reduce((sum: number, item: any) => {
                  if (item.kind === 'instance') return sum + (item.qty || 1)
                  return sum
                }, 0)
                return (
                  <tr key={i.id} onClick={() => setDetailInvoice(i)}>
                    <td className="mono fw-6 text-sm">{i.legacy_id || i.id.slice(0, 8)}</td>
                    <td className="tnum text-sm">{i.invoice_date ? new Date(i.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</td>
                    <td className="tnum text-sm">{totalQty}</td>
                    <td className="text-sm">{[...vmRequestsList.map((v: any) => v.hostname), ...addonVMs.map((vm: any) => vm.hostname)].join(', ')}</td>
                    <td className="mono text-sm">
                      {[...vmRequestsList.map((v: any) => v.legacy_id || v.id.slice(0, 8)), ...addonRequestsList.map((a: any) => a.legacy_id || a.id.slice(0, 8))].join(', ')}
                    </td>
                    <td className="mono text-sm">{(() => {
                      const quote = quotes.find((q: any) => q.id === i.quote_id)
                      return quote?.legacy_id || '—'
                    })()}</td>
                    <td><StatusPill status={i.status}/></td>
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
