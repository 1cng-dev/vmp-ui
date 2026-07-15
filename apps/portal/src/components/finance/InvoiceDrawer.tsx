import React, { useState } from 'react'
import { useInvoices } from '../../store/invoiceStore'
import { useCustomers } from '../../store/customerStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, formatMMK } from '../ui/ui'
import { exportInvoiceToPDF } from '../../lib/pdfExport'

interface InvoiceDrawerProps {
  invoice: any
  onClose: () => void
  openModal: (kind: string, props?: any) => void
}

export const InvoiceDrawer: React.FC<InvoiceDrawerProps> = ({ invoice, onClose, openModal }) => {
  const { invoices, markPaid, updateInvoice } = useInvoices()
  const { customers } = useCustomers()
  const { toast } = useUIStore()
  const c = customers.find(c => c.id === invoice.customer_id)
  if (!c) return null
  const live = invoices.find(i => i.id === invoice.id) || invoice
  const [showConfirm, setShowConfirm] = useState(false)

  const handleTransferReceived = async () => {
    await updateInvoice({ id: live.id, patch: { status: 'Customer Transferred' } })
    toast('Payment proof submitted', 'info')
    setShowConfirm(false)
  }

  return (
    <div className="content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to invoices</button>
            <span className="mono text-xs text-mute">{live.legacy_id || live.id}</span>
          </div>
          <h1 className="page-title">Invoice {live.legacy_id || live.id}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={live.status}/>
            <span className="pill subtle">Invoice Date {live.invoice_date ? new Date(live.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</span>
            <span className="pill subtle">Due {live.due ? new Date(live.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</span>
            {live.paid_date && <span className="pill subtle">Paid {new Date(live.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')}</span>}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={async () => await exportInvoiceToPDF(live, c)}><Icon name="download" size={12}/>PDF</button>
          <button className="btn" onClick={() => openModal('email', { to: c.email, template: 'invoice' })}><Icon name="mail" size={12}/>Email</button>
          {live.status !== 'Payment Received' && <button className="btn accent" onClick={() => markPaid({ id: live.id, receipt: `RCT-${live.id.slice(0, 8)}` })}><Icon name="check" size={12}/>Mark paid</button>}
          {live.status === 'Pending' && <button className="btn" onClick={() => setShowConfirm(true)}>Transfer received</button>}
        </div>
      </div>

      <div className="grid-asym" style={{ gap: 24 }}>
        <div className="flex col" style={{ gap: 16 }}>
          {/* Invoice paper */}
          <div className="card">
            <div className="card-body" style={{ padding: 28 }}>
              <div className="flex between mb-4">
                <div>
                  <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 18, marginBottom: 8 }}>V</div>
                  <div className="fw-7" style={{ fontSize: 14 }}>VPS Myanmar Co., Ltd</div>
                  <div className="text-xs text-mute">No. 142, Strand Road, Yangon</div>
                  <div className="text-xs text-mute">accounts@vpsmm.co · +95 1 2345 678</div>
                </div>
                <div className="right">
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Invoice</div>
                  <div className="mono fw-7" style={{ fontSize: 14 }}>{live.legacy_id || live.id}</div>
                  <div className="text-xs text-mute mt-2">Currency: {live.currency}</div>
                </div>
              </div>

              <div className="grid-2 mb-4" style={{ gap: 16 }}>
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6 }}>
                  <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Billed to</div>
                  <div className="fw-7 text-sm">{c?.org_name || c?.name}</div>
                  <div className="text-xs text-mute">{c?.name}</div>
                  <div className="text-xs text-mute">{c?.email}</div>
                  <div className="text-xs text-mute mono">{c?.legacy_id || c?.id}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6 }}>
                  <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment terms</div>
                  <div className="text-sm"><span className="text-mute">Billing Term:</span> <span className="fw-6">{live.billing_term || '—'}</span></div>
                  {live.receipt && <div className="text-sm"><span className="text-mute">Receipt #:</span> <span className="mono fw-6">{live.receipt}</span></div>}
                </div>
              </div>

              <table className="tbl" style={{ marginBottom: 16 }}>
                <thead>
                  <tr><th>Service</th><th>Spec</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Total</th></tr>
                </thead>
                <tbody>
                  {(live.line_items || []).map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td>
                        <div className="fw-6">{item.kind === 'instance' ? 'Instance' : item.kind === 'backup' ? 'Backup' : item.kind === 'publicIP' ? 'Public IP' : item.kind}</div>
                        <div className="text-xs text-mute">{item.term}</div>
                      </td>
                      <td className="text-xs">{item.spec}</td>
                      <td className="right tnum">{item.qty || 1}</td>
                      <td className="right tnum">MMK {formatMMK(item.unit)}</td>
                      <td className="right tnum fw-6">MMK {formatMMK((item.unit || 0) * (item.qty || 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex" style={{ justifyContent: 'flex-end' }}>
                <div style={{ minWidth: 280 }}>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">Subtotal</span>
                    <span className="tnum">MMK {formatMMK(live.amount)}</span>
                  </div>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">Discount</span>
                    <span className="tnum text-mute">MMK {formatMMK(live.discount || 0)}</span>
                  </div>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">Net Amount</span>
                    <span className="tnum">MMK {formatMMK(live.net_amount || live.amount)}</span>
                  </div>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">VAT</span>
                    <span className="tnum text-mute">MMK {formatMMK(live.vat || 0)}</span>
                  </div>
                  <div className="divider" style={{ margin: '6px 0' }}/>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="fw-7">Gross Amount</span>
                    <span className="tnum fw-7" style={{ fontSize: 18 }}>MMK {formatMMK(live.gross_amount || live.amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Payment status</h3></div>
            <div className="card-body">
              <div style={{ padding: 14, background: live.status === 'Payment Received' ? 'var(--ok-soft)' : live.status === 'Overdue' ? 'var(--bad-soft)' : live.status === 'Customer Transferred' ? 'var(--warn-soft)' : 'var(--warn-soft)', borderRadius: 8 }}>
                <div className="fw-7" style={{ color: live.status === 'Payment Received' ? 'var(--ok)' : live.status === 'Overdue' ? 'var(--bad)' : live.status === 'Customer Transferred' ? 'oklch(0.5 0.14 75)' : 'oklch(0.5 0.14 75)' }}>{live.status}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
                  {live.status === 'Payment Received' && `Receipt: ${live.receipt}`}
                  {live.status === 'Pending' && 'Awaiting customer transfer'}
                  {live.status === 'Customer Transferred' && 'Customer has submitted payment proof'}
                  {live.status === 'Overdue' && 'Past due — follow up required'}
                </div>
              </div>
              
              {live.status === 'Customer Transferred' && live.payment_proof && (
                <div style={{ marginTop: 16 }}>
                  <div className="text-sm fw-6 mb-2">Payment Proof</div>
                  <img 
                    src={live.payment_proof} 
                    alt="Payment Proof" 
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>
              )}
              
              {live.status === 'Customer Transferred' && (
                <button 
                  className="btn primary" 
                  style={{ width: '100%', marginTop: 16 }}
                  onClick={() => markPaid({ id: live.id, receipt: `RCT-${live.id.slice(0, 8)}` })}
                >
                  <Icon name="check" size={12}/>Mark as Payment Received
                </button>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Quick actions</h3></div>
            <div className="card-body">
              <div className="flex col gap-2">
                <button className="btn" onClick={async () => await exportInvoiceToPDF(live, c)}><Icon name="download" size={12}/>Download PDF</button>
                <button className="btn" onClick={() => openModal('email', { to: c.email, template: 'invoice' })}><Icon name="mail" size={12}/>Email customer</button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Audit trail</h3></div>
            <div className="card-body" style={{ padding: '6px 18px' }}>
              {[
                ['—', 'system', 'Invoice generated'],
              ].filter((a): a is [string, string, string] => Boolean(a)).map((a, i) => (
                <div key={i} className="feed-item">
                  <span className="dot finance" />
                  <div className="body">{a[2]}<div className="meta">{a[1]} · {a[0]}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Confirm Transfer Received</h3>
              <button className="icon-btn" onClick={() => setShowConfirm(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>Are you sure you want to mark this invoice as "Customer Transferred"? This indicates the customer has submitted payment proof.</p>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn accent" onClick={handleTransferReceived}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
