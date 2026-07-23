import { useState, useEffect } from 'react'
import Icon from '../lib/icons'
import { formatMMK, CircularSpinner } from '../components/ui/ui'
import useQuoteStore from '../store/quoteStore'
import useCustomerStore from '../store/customerStore'
import useVMRequestStore from '../store/vmRequestStore'
import useVMStore from '../store/vmStore'
import useAddonRequestStore from '../store/addonRequestStore'
import useUIStore from '../store/uiStore'
import QuoteDrawer from '../components/quote/QuoteDrawer'
import { NewInvoiceModal } from '../components/modals/AdminVMModals'
import type { DBQuote } from '../types'

const FinanceQuoteReviewView = () => {
  const { quotes, quotesLoading, updateQuote, loadQuotes } = useQuoteStore()
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { vms, loadVMs } = useVMStore()
  const { addonRequests, loadAddonRequests } = useAddonRequestStore()
  const { toast } = useUIStore()
  const [selectedQuote, setSelectedQuote] = useState<DBQuote | null>(null)
  const [quoteForInvoice, setQuoteForInvoice] = useState<DBQuote | null>(null)

  // Ensure quotes are loaded
  useEffect(() => {
    if (quotes.length === 0) {
      loadQuotes()
    }
  }, [quotes.length, loadQuotes])

  // Ensure addon requests and VMs are loaded
  useEffect(() => {
    if (addonRequests.length === 0) {
      loadAddonRequests()
    }
    if (vms.length === 0) {
      loadVMs()
    }
  }, [addonRequests.length, vms.length, loadAddonRequests, loadVMs])

  // Filter quotes for finance to see history (Sent, Accepted, Rejected)
  const financeQuotes = quotes.filter(q => ['Sent', 'Accepted', 'Rejected'].includes(q.status))

  const handleApprove = async (id: string) => {
    await updateQuote(id, { status: 'Accepted' })
    toast(`Quote approved`, 'ok')
  }

  const handleReject = async (id: string) => {
    await updateQuote(id, { status: 'Rejected' })
    toast(`Quote rejected`, 'warn')
  }

  const handleCreateInvoice = (quote: DBQuote) => {
    setQuoteForInvoice(quote)
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quote Review</h1>
          <p className="page-subtitle">{financeQuotes.length} quotes</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Request</th>
                <th>Billing Term</th>
                <th className="right">Lines</th>
                <th className="right">Total</th>
                <th>Valid until</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotesLoading ? (
                <tr><td colSpan={9}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
              ) : financeQuotes.length === 0 ? (
                <tr><td colSpan={9}><div className="empty"><div className="title">No quotes yet</div><div className="sub">Quotes will appear here when customers request pricing.</div></div></td></tr>
              ) : (
                financeQuotes.map((q: DBQuote) => {
                const cust = customers.find(c => c.id === q.customer_id)
                const vmReq = vmRequests.find(r => r.id === q.vm_request_id)
                const addonReq = addonRequests.find(a => a.id === (q as any).addon_request_id)
                const isAddon = !!(q as any).addon_request_id
                const canApproveReject = q.status === 'Sent'
                return (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedQuote(q)}>
                    <td className="mono fw-6">{q.legacy_id || q.id.slice(0, 8)}</td>
                    <td>{cust?.org_name || cust?.name || '—'}</td>
                    <td><span className="pill subtle"><span className="dot" />{isAddon ? 'Add-on Service' : (vmReq?.task_type || 'new')}</span></td>
                    <td>
                      {isAddon
                        ? `${addonReq?.legacy_id || addonReq?.id?.slice(0, 8) || (q as any).addon_request_id?.slice?.(0, 8) || '—'} · ${addonReq ? `${addonReq.cpfs_enabled ? 'CPFS' : ''}${addonReq.cpfs_enabled && addonReq.ccis_enabled ? ' + ' : ''}${addonReq.ccis_enabled ? 'CCIS' : ''}` : '—'}`
                        : `${vmReq?.legacy_id || vmReq?.id?.slice(0, 8) || q.vm_request_id?.slice?.(0, 8) || '—'} · ${vmReq?.hostname || '—'}`}
                    </td>
                    <td className="tnum text-sm">{(q as any).billing_term || '—'}</td>
                    <td className="right tnum">{(q.line_items || []).length}</td>
                    <td className="right tnum fw-6">MMK {formatMMK((q as any).grand_total)}</td>
                    <td className="tnum text-sm">{new Date(q.validity_date).toLocaleDateString()}</td>
                    <td className="right">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {canApproveReject && (
                          <>
                            <button className="btn sm ok" onClick={() => handleApprove(q.id)}>
                              <Icon name="check" size={11} /> Approve
                            </button>
                            <button className="btn sm danger" onClick={() => handleReject(q.id)}>
                              <Icon name="x" size={11} /> Reject
                            </button>
                          </>
                        )}
                        {q.status === 'Accepted' && (
                          <button className="btn sm accent" onClick={(e) => { e.stopPropagation(); handleCreateInvoice(q); }}>
                            <Icon name="file" size={11} /> Create Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedQuote && <QuoteDrawer quote={selectedQuote} onClose={() => setSelectedQuote(null)} />}
      {quoteForInvoice && (
        <NewInvoiceModal 
          onClose={() => setQuoteForInvoice(null)} 
          presetCustomer={quoteForInvoice.customer_id}
          presetQuote={quoteForInvoice}
        />
      )}
    </div>
  )
}

export default FinanceQuoteReviewView
    