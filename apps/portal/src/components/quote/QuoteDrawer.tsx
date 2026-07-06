import Icon from '../../lib/icons'
import { formatMMK } from '../ui/ui'
import type { DBQuote } from '../../types'
import useCustomerStore from '../../store/customerStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useQuoteStore from '../../store/quoteStore'
import useUIStore from '../../store/uiStore'

interface QuoteDrawerProps {
  quote: DBQuote
  onClose: () => void
}

const QuoteDrawer = ({ quote, onClose }: QuoteDrawerProps) => {
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { updateQuote } = useQuoteStore()
  const { toast } = useUIStore()

  const cust = customers.find(c => c.id === quote.customer_id)
  const request = vmRequests.find(r => r.id === quote.vm_request_id)

  const handleApprove = async () => {
    await updateQuote(quote.id, { status: 'Accepted' })
    toast(`Quote approved`, 'ok')
    onClose()
  }

  const handleReject = async () => {
    await updateQuote(quote.id, { status: 'Rejected' })
    toast(`Quote rejected`, 'warn')
    onClose()
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="flex center between mb-2">
            <span className="mono text-sm text-mute">{quote.legacy_id || quote.id.slice(0, 8)}</span>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Quote Details</h2>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div className="grid-2" style={{ gap: 16 }}>
                <div>
                  <div className="text-sm text-mute">Quote #</div>
                  <div className="mono fw-6">{quote.legacy_id || quote.id.slice(0, 8)}</div>
                </div>
                <div>
                  <div className="text-sm text-mute">Status</div>
                  <div><span className={`pill ${quote.status === 'Accepted' ? 'ok' : quote.status === 'Rejected' ? 'danger' : 'subtle'}`}>
                    <span className="dot" />{quote.status}
                  </span></div>
                </div>
                <div>
                  <div className="text-sm text-mute">Customer</div>
                  <div>{cust?.org_name || cust?.name || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-mute">Type</div>
                  <div><span className="pill subtle">{request?.task_type || 'new'}</span></div>
                </div>
                <div>
                  <div className="text-sm text-mute">VM Request</div>
                  <div>{request?.legacy_id || request?.id.slice(0, 8)} · {request?.hostname || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-mute">Valid until</div>
                  <div>{new Date(quote.validity_date).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-mute">Created</div>
                  <div>{new Date(quote.created_at).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-sm text-mute">Currency</div>
                  <div>{quote.currency}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <h3 className="fw-6 mb-2">Line Items</h3>
              {(quote.line_items || []).length === 0 ? (
                <div className="text-mute text-sm">No line items</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(quote.line_items || []).map((item: any, i: number) => (
                    <div key={i} className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>
                      <div className="flex between">
                        <div className="fw-6">{item.spec || `Item ${i + 1}`}</div>
                        <div className="tnum">MMK {formatMMK(item.unit || 0)}</div>
                      </div>
                      <div className="flex between text-sm text-mute mt-1">
                        <div>
                          {item.vcpu && <span>vCPU: {item.vcpu}</span>}
                          {item.ram && <span> · RAM: {item.ram}GB</span>}
                          {item.storage && <span> · Storage: {item.storage}GB</span>}
                        </div>
                        <div>Qty: {item.qty || 1}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h3 className="fw-6 mb-2">Totals</h3>
              <div className="flex between text-sm mb-1">
                <div>Subtotal (Monthly)</div>
                <div className="tnum">MMK {formatMMK(quote.subtotal_monthly)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Subtotal (Annual)</div>
                <div className="tnum">MMK {formatMMK(quote.subtotal_annual)}</div>
              </div>
              <div className="flex between fw-6">
                <div>Total (Annual)</div>
                <div className="tnum">MMK {formatMMK(quote.total_annual)}</div>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="card">
              <div className="card-body">
                <h3 className="fw-6 mb-2">Notes</h3>
                <div className="text-sm">{quote.notes}</div>
              </div>
            </div>
          )}

          {quote.status === 'Sent' && (
            <div className="flex gap-2" style={{ marginTop: 16 }}>
              <button className="btn ok" onClick={handleApprove}>
                <Icon name="check" size={12} /> Approve
              </button>
              <button className="btn danger" onClick={handleReject}>
                <Icon name="x" size={12} /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default QuoteDrawer
