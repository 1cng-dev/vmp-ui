import { useState } from 'react'
import Icon from '../lib/icons'
import { formatMMK } from '../components/ui/ui'
import useQuoteStore from '../store/quoteStore'
import useCustomerStore from '../store/customerStore'
import useVMRequestStore from '../store/vmRequestStore'
import useUIStore from '../store/uiStore'
import QuoteDrawer from '../components/quote/QuoteDrawer'
import type { DBQuote } from '../types'

const FinanceQuoteReviewView = () => {
  const { quotes, updateQuote } = useQuoteStore()
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { toast } = useUIStore()
  const [selectedQuote, setSelectedQuote] = useState<DBQuote | null>(null)

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
                <th>VM Request</th>
                <th className="right">Lines</th>
                <th className="right">Total (1y)</th>
                <th>Valid until</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {financeQuotes.map((q: DBQuote) => {
                const cust = customers.find(c => c.id === q.customer_id)
                const request = vmRequests.find(r => r.id === q.vm_request_id)
                const canApproveReject = q.status === 'Sent'
                return (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedQuote(q)}>
                    <td className="mono fw-6">{q.legacy_id || q.id.slice(0, 8)}</td>
                    <td>{cust?.org_name || cust?.name || '—'}</td>
                    <td><span className="pill subtle"><span className="dot" />{request?.task_type || 'new'}</span></td>
                    <td>{request?.legacy_id || request?.id.slice(0, 8)} · {request?.hostname || '—'}</td>
                    <td className="right tnum">{(q.line_items || []).length}</td>
                    <td className="right tnum fw-6">MMK {formatMMK(q.total_annual)}</td>
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
                      </div>
                    </td>
                  </tr>
                )
              })}
              {financeQuotes.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="title">No quotes found</div>
                      <div className="sub">No quotes with status Sent, Accepted, or Rejected.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedQuote && <QuoteDrawer quote={selectedQuote} onClose={() => setSelectedQuote(null)} />}
    </div>
  )
}

export default FinanceQuoteReviewView
