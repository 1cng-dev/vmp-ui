import React, { useState, useEffect } from 'react'
import useInvoiceStore from '../../store/invoiceStore'
import useCustomerStore from '../../store/customerStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useUIStore from '../../store/uiStore'
import useReceiptStore from '../../store/receiptStore'
import { useSystemSettingsStore } from '../../store/systemSettingsStore'
import Icon from '../../lib/icons'
import { StatusPill, formatMMK } from '../ui/ui'
import { exportInvoiceToPDF } from '../../lib/pdfExport'

interface CustomerInvoiceDetailProps {
  invoice: any
  onClose: () => void
}

export const CustomerInvoiceDetail: React.FC<CustomerInvoiceDetailProps> = ({ invoice: initial, onClose }) => {
  const { invoices, updateInvoice } = useInvoiceStore()
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { toast } = useUIStore()
  const { loadReceiptsByInvoice } = useReceiptStore()
  const { settings } = useSystemSettingsStore()
  const [showPaymentQR, setShowPaymentQR] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [receipts, setReceipts] = useState<any[]>([])
  const inv = invoices.find((i: any) => i.id === initial.id) || initial;
  const c = customers.find((c: any) => c.id === inv.customer_id);
  const invoiceVMRequests = vmRequests.filter((v: any) => inv.vm_request_ids && inv.vm_request_ids.includes(v.id));

  useEffect(() => {
    const loadReceipts = async () => {
      const receiptData = await loadReceiptsByInvoice(inv.id)
      setReceipts(receiptData)
    }
    loadReceipts()
  }, [inv.id, loadReceiptsByInvoice])

  const handlePaymentProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setPreviewImage(base64)
      setShowPreviewModal(true)
    }
    reader.onerror = (error) => {
      console.error('Error reading file:', error)
      toast('Failed to read file', 'error')
    }
    reader.readAsDataURL(file)
  }

  const handlePaymentProofSubmit = async () => {
    if (!previewImage) return

    setUploading(true)
    try {
      const { supabase } = await import('../../lib/supabase')
      
      // Get user ID for RLS policy compliance
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        throw new Error('User not authenticated')
      }
      
      // Convert base64 back to blob for upload
      const response = await fetch(previewImage)
      const blob = await response.blob()
      const file = new File([blob], 'payment-proof.png', { type: 'image/png' })
      
      // Use user ID as folder to comply with RLS policy
      const fileName = `${user.id}/${inv.id}-${Date.now()}-payment-proof.png`
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file)
      
      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName)
      
      try {
        await updateInvoice(inv.id, {
          payment_proof: publicUrl,
          status: 'Customer Transferred'
        })
      } catch (updateError) {
        console.error('Failed to update invoice:', updateError)
        throw new Error('Upload succeeded but failed to update invoice')
      }
      
      setPreviewImage(null)
      setShowPreviewModal(false)
      setUploading(false)
      toast('Payment proof uploaded successfully', 'ok')
    } catch (error) {
      console.error('Upload failed:', error)
      setUploading(false)
      toast('Failed to upload payment proof', 'error')
    }
  }

  return (
    <div className="content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to invoices</button>
            <span className="mono text-xs text-mute">{inv.legacy_id || inv.id}</span>
          </div>
          <h1 className="page-title">Invoice {inv.legacy_id || inv.id}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={inv.status}/>
            <span className="pill subtle">Invoice Date {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</span>
            <span className="pill subtle">Due {inv.due ? new Date(inv.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '') : '—'}</span>
            {inv.paid_date && <span className="pill subtle">Paid {new Date(inv.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')}</span>}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={async () => await exportInvoiceToPDF(inv, c)}><Icon name="download" size={12}/>PDF</button>
          <button className="btn" onClick={() => window.print && window.print()}><Icon name="file" size={12}/>Print</button>
          {inv.status !== 'Payment Received' && inv.status !== 'Customer Transferred' && (
            <button className="btn accent" onClick={() => setShowPaymentQR(true)}><Icon name="check" size={12}/>Pay now</button>
          )}
          {inv.status === 'Customer Transferred' && (
            <span className="pill subtle"><Icon name="check" size={10}/>Payment proof submitted</span>
          )}
        </div>
      </div>

      <div className="grid-asym" style={{ gap: 24 }}>
        <div className="flex col" style={{ gap: 16 }}>
          {/* Invoice paper */}
          <div className="card">
            <div className="card-body" style={{ padding: 28 }}>
              <div className="flex between mb-4">
                <div>
                  {settings?.logo_url
                    ? <img src={`${settings.logo_url}?v=${settings.updated_at}`} alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain', marginBottom: 8 }} />
                    : <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 18, marginBottom: 8 }}>V</div>}
                  <div className="fw-7" style={{ fontSize: 14 }}>{settings?.company_name || 'VPS Myanmar Co., Ltd'}</div>
                  <div className="text-xs text-mute">No. 142, Strand Road, Yangon</div>
                  <div className="text-xs text-mute">accounts@vpsmm.co · +95 1 2345 678</div>
                </div>
                <div className="right">
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Invoice</div>
                  <div className="mono fw-7" style={{ fontSize: 14 }}>{inv.legacy_id || inv.id}</div>
                  <div className="text-xs text-mute mt-2">Currency: {inv.currency}</div>
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
                  <div className="text-sm"><span className="text-mute">Billing Term:</span> <span className="fw-6">{inv.billing_term || '—'}</span></div>
                  {inv.receipt && <div className="text-sm"><span className="text-mute">Receipt #:</span> <span className="mono fw-6">{inv.receipt}</span></div>}
                </div>
              </div>

              <table className="tbl" style={{ marginBottom: 16 }}>
                <thead>
                  <tr><th>Service</th><th>Spec</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Total</th></tr>
                </thead>
                <tbody>
                  {(inv.line_items || []).map((item: any, idx: number) => (
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
                    <span className="tnum">MMK {formatMMK(inv.amount)}</span>
                  </div>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">Discount</span>
                    <span className="tnum text-mute">MMK {formatMMK(inv.discount || 0)}</span>
                  </div>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">Net Amount</span>
                    <span className="tnum">MMK {formatMMK(inv.net_amount || inv.amount)}</span>
                  </div>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="text-mute">VAT</span>
                    <span className="tnum text-mute">MMK {formatMMK(inv.vat || 0)}</span>
                  </div>
                  <div className="divider" style={{ margin: '6px 0' }}/>
                  <div className="flex between" style={{ padding: '6px 0' }}>
                    <span className="fw-7">Gross Amount</span>
                    <span className="tnum fw-7" style={{ fontSize: 18 }}>MMK {formatMMK(inv.gross_amount || inv.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="divider"/>
              {/* <div className="text-xs text-mute">
                <strong>Payment methods:</strong> KBZ Pay (09 7710 12345), AYA Bank (00 220 11 22 33), CB Bank (00 451 22 33 44), Yoma Bank (00 510 99 88 77). Please include invoice number in the transfer reference.
              </div> */}
              <div className="text-xs text-mute mt-2">
                <strong>Notes:</strong> Service continues uninterrupted upon payment confirmation. Late payments may result in service suspension after 7 days grace period.
              </div>
            </div>
          </div>
        </div>

        <div className="flex col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Payment status</h3></div>
            <div className="card-body">
              <div style={{ padding: 14, background: inv.status === 'Payment Received' ? 'var(--ok-soft)' : inv.status === 'Overdue' ? 'var(--bad-soft)' : 'var(--warn-soft)', borderRadius: 8 }}>
                <div className="fw-7" style={{ color: inv.status === 'Payment Received' ? 'var(--ok)' : inv.status === 'Overdue' ? 'var(--bad)' : 'oklch(0.5 0.14 75)' }}>{inv.status}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
                  {inv.status === 'Payment Received' && `Receipt: ${inv.receipt}`}
                  {inv.status === 'Pending' && 'Awaiting your transfer'}
                  {inv.status === 'Customer Transferred' && 'Confirming with bank'}
                  {inv.status === 'Overdue' && 'Past due — please pay urgently'}
                </div>
              </div>
              {inv.status !== 'Payment Received' && inv.status !== 'Customer Transferred' && (
                <>
                  <input
                    type="file"
                    id="payment-proof-upload"
                    accept="image/*"
                    onChange={handlePaymentProofSelect}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                  <button 
                    className="btn primary w-full mt-3" 
                    onClick={() => document.getElementById('payment-proof-upload')?.click()}
                    disabled={uploading}
                  >
                    <Icon name="attach" size={12}/>
                    {uploading ? 'Uploading...' : 'Upload payment proof'}
                  </button>
                </>
              )}
              {inv.status === 'Customer Transferred' && (
                <div className="text-sm text-mute mt-3" style={{ color: 'var(--ok)' }}>
                  <Icon name="check" size={10}/> Payment proof submitted
                </div>
              )}
            </div>
          </div>
          {receipts.length > 0 && (
            <div className="card">
              <div className="card-head"><h3 className="card-title">Receipts</h3></div>
              <div className="card-body" style={{ padding: 0 }}>
                {receipts.map((r: any) => (
                  <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                    <div className="flex center between mb-1">
                      <span className="mono text-xs text-mute fw-6">{r.legacy_id}</span>
                      <span className="text-xs text-mute">{new Date(r.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')}</span>
                    </div>
                    <div className="text-sm text-mute" style={{ lineHeight: 1.4 }}>{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {invoiceVMRequests.length > 0 && (
            <div className="card">
              <div className="card-head"><h3 className="card-title">Linked VM Requests</h3></div>
              <div className="card-body" style={{ padding: '6px 14px' }}>
                {invoiceVMRequests.map((v: any) => (
                  <div key={v.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                    <div className="fw-6 text-sm">{v.hostname}</div>
                    <div className="text-xs text-mute mono">{v.legacy_id} · {v.task_type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaymentQR && (
        <div className="drawer-overlay" onClick={() => setShowPaymentQR(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="flex center between">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Payment QR Code</h2>
                <button className="icon-btn" onClick={() => setShowPaymentQR(false)}><Icon name="x" size={14} /></button>
              </div>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <img 
                src="/assets/SCAN ME!!.png" 
                alt="Payment QR Code" 
                style={{ maxWidth: '100%', height: 'auto', marginBottom: 16 }}
              />
              <div className="text-sm text-mute mb-2">Scan to pay</div>
              <div className="fw-7" style={{ fontSize: 20 }}>MMK {formatMMK(inv.gross_amount || inv.amount)}</div>
              <div className="text-xs text-mute mt-1">Invoice: {inv.legacy_id || inv.id}</div>
              <div className="text-xs text-mute mt-3">After payment, upload proof using the button below</div>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && previewImage && (
        <div className="drawer-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="flex center between">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Confirm Payment Proof</h2>
                <button className="icon-btn" onClick={() => setShowPreviewModal(false)}><Icon name="x" size={14} /></button>
              </div>
            </div>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <img 
                src={previewImage} 
                alt="Payment Proof Preview" 
                style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6, border: '1px solid var(--border)', marginBottom: 16 }}
              />
              <div className="text-sm text-mute mb-4">Please verify this is the correct payment screenshot before submitting.</div>
              <div className="flex gap-2">
                <button 
                  className="btn" 
                  style={{ flex: 1 }}
                  onClick={() => {
                    setPreviewImage(null)
                    setShowPreviewModal(false)
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn primary" 
                  style={{ flex: 1 }}
                  onClick={handlePaymentProofSubmit}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Payment Proof'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
