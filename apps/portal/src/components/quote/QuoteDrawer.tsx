import React from 'react'
import Icon from '../../lib/icons'
import { formatMMK } from '../ui/ui'
import type { DBQuote } from '../../types'
import useCustomerStore from '../../store/customerStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useVMStore from '../../store/vmStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import useQuoteStore from '../../store/quoteStore'
import useUIStore from '../../store/uiStore'
import useAuthStore from '../../store/authStore'

interface QuoteDrawerProps {
  quote: DBQuote
  onClose: () => void
}

const QuoteDrawer = ({ quote, onClose }: QuoteDrawerProps) => {
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { vms, loadVMs } = useVMStore()
  const { addonRequests } = useAddonRequestStore()
  const { updateQuote } = useQuoteStore()
  const { toast } = useUIStore()
  const { user, refreshUser } = useAuthStore()

  // Ensure user data is loaded
  React.useEffect(() => {
    if (!user) {
      refreshUser()
    }
  }, [user, refreshUser])

  // Load VMs if not loaded
  React.useEffect(() => {
    if (vms.length === 0) {
      loadVMs()
    }
  }, [vms.length, loadVMs])

  const cust = customers.find(c => c.id === quote.customer_id)
  const vmReq = vmRequests.find(r => r.id === quote.vm_request_id)
  const addonReq = addonRequests.find(a => a.id === (quote as any).addon_request_id)
  const isAddon = !!(quote as any).addon_request_id
  // For renewal requests, find VM by hostname since VM is linked to original request
  const vm = vmReq?.task_type === 'Renewal' || vmReq?.task_type === 'renewal'
    ? vms.find(v => v.hostname === vmReq?.hostname)
    : vms.find(v => v.vm_request_id === quote.vm_request_id)

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

  // Check if user is sales role - hide buttons for sales
  const isSales = user?.role === 'Sales'

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
                  <div><span className="pill subtle">{isAddon ? 'Add-on Service' : (vmReq?.task_type || 'new')}</span></div>
                </div>
                <div>
                  <div className="text-sm text-mute">Linked Request</div>
                  <div>
                    {isAddon
                      ? `${addonReq?.legacy_id || addonReq?.id?.slice(0, 8) || (quote as any).addon_request_id?.slice?.(0,8) || '—'} · ${addonReq ? `${addonReq.cpfs_enabled ? 'CPFS' : ''}${addonReq.cpfs_enabled && addonReq.ccis_enabled ? ' + ' : ''}${addonReq.ccis_enabled ? 'CCIS' : ''}` : '—'}`
                      : `${vmReq?.legacy_id || vmReq?.id?.slice(0, 8) || quote.vm_request_id?.slice?.(0,8) || '—'} · ${vmReq?.hostname || '—'}${vm ? ` (${vm.legacy_id})` : ''}`}
                  </div>
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
                <div>Instance Total</div>
                <div className="tnum">MMK {formatMMK((quote as any).instance_total)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Public IP Total</div>
                <div className="tnum">MMK {formatMMK((quote as any).public_ip_total)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Backup Total</div>
                <div className="tnum">MMK {formatMMK((quote as any).backup_total)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Discount</div>
                <div className="tnum">MMK {formatMMK((quote as any).discount_amount)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Net Amount</div>
                <div className="tnum">MMK {formatMMK((quote as any).net_amount)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Tax</div>
                <div className="tnum">MMK {formatMMK((quote as any).tax_amount)}</div>
              </div>
              <div className="flex between text-sm mb-1">
                <div>Billing Term</div>
                <div className="tnum">{(quote as any).billing_term || '—'}</div>
              </div>
              <div className="flex between fw-6">
                <div>Grand Total</div>
                <div className="tnum">MMK {formatMMK((quote as any).grand_total)}</div>
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

          {quote.status === 'Sent' && !isSales && (
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
