import { useState, useEffect } from 'react'
import Icon from '../lib/icons'
import { formatMMK } from '../components/ui/ui'
import useQuoteStore from '../store/quoteStore'
import useUIStore from '../store/uiStore'
import useCustomerStore from '../store/customerStore'
import useVMRequestStore from '../store/vmRequestStore'


interface QuotesViewProps {
  autoOpen?: boolean
  onAutoOpenReset?: () => void
  prefillCustomerId?: string
  prefillRequestId?: string
}

const QuotesView = ({ autoOpen = false, onAutoOpenReset, prefillCustomerId, prefillRequestId }: QuotesViewProps) => {
  const { quotes, addQuote } = useQuoteStore()
  const { toast } = useUIStore()
  const [building, setBuilding] = useState(false)

  // Row types for the sheet
  type InstanceLine = { spec: string; vcpu: number; ram: number; storage: number; qty: number; unit: number; term: 'Monthly' | 'Annual' }
  type BackupLine = { spec: string; storage: number; unit: number }

  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined)
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined)

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)
  const customerRequests = vmRequests.filter(r => r.customer_id === selectedCustomerId)

  const onSelectCustomer = (id?: string) => {
    setSelectedCustomerId(id)
    setSelectedRequestId(undefined)
  }

  const onSelectRequest = (id?: string) => {
    setSelectedRequestId(id)
    if (id) {
      const request = vmRequests.find(r => r.id === id)
      if (request) {
        // Determine billing term based on duration (>= 12 months = Annual)
        const billingTerm = (request.duration && request.duration >= 12) ? 'Annual' : 'Monthly'
        // Auto-fill instance line item with VM request specs (unit price left empty for manual entry)
        setSheet(s => ({
          ...s,
          instance: [
            {
              spec: request.hostname || request.sizing,
              vcpu: request.vcpu,
              ram: request.ram_gb,
              storage: request.storage,
              qty: request.qty,
              unit: 0,
              term: billingTerm
            }
          ]
        }))
      }
    } else {
      // Clear instance line items if no request selected
      setSheet(s => ({ ...s, instance: [] }))
    }
  }

  //quotation sheet state
  const [sheet, setSheet] = useState<{
    instance: InstanceLine[]
    backup: BackupLine[]
    taxPct: number
  }>({
    instance: [],
    backup: [],
    taxPct: 5,
  })

  useEffect(() => {
    if (autoOpen) {
      setBuilding(true)
      onAutoOpenReset?.()
    }
  }, [autoOpen, onAutoOpenReset])

  useEffect(() => {
    if (prefillCustomerId && prefillRequestId) {
      // Auto-select customer and request when prefill props are provided
      onSelectCustomer(prefillCustomerId)
      // Small delay to ensure customer is selected first
      setTimeout(() => {
        onSelectRequest(prefillRequestId)
        setBuilding(true)
      }, 50)
    }
  }, [prefillCustomerId, prefillRequestId])

  const instExt = (l: InstanceLine) => (l.unit || 0) * (l.qty || 0)
  const backupExt = (l: BackupLine) => l.unit || 0
  const instanceSub = sheet.instance.reduce((a: number, l: InstanceLine) => a + instExt(l), 0)
  const backupSub = sheet.backup.reduce((a: number, l: BackupLine) => a + backupExt(l), 0)
  const subTotal = instanceSub + backupSub
  const tax = Math.round(subTotal * (sheet.taxPct / 100))
  const grand = subTotal + tax
  const backupTotalGB = sheet.backup.reduce((a: number, l: BackupLine) => a + (l.storage || 0), 0)

  const updateInstance = (i: number, patch: Partial<InstanceLine>) => {
    const instance = [...sheet.instance]
    instance[i] = { ...instance[i], ...patch }
    setSheet({ ...sheet, instance })
  }
  const addInstance = () => setSheet({ ...sheet, instance: [...sheet.instance, { spec: `Instance ${sheet.instance.length + 1}`, vcpu: 2, ram: 8, storage: 100, qty: 1, unit: 120000, term: 'Monthly' }] })
  const removeInstance = (i: number) => setSheet({ ...sheet, instance: sheet.instance.filter((_, j) => j !== i) })

  const updateBackup = (i: number, patch: Partial<BackupLine>) => {
    const backup = [...sheet.backup]
    backup[i] = { ...backup[i], ...patch }
    setSheet({ ...sheet, backup })
  }
  const addBackup = () => {
    setSheet({ ...sheet, backup: [...sheet.backup, { spec: 'Backup', storage: 0, unit: 0 }] })
  }
  const removeBackup = (i: number) => setSheet({ ...sheet, backup: sheet.backup.filter((_, j) => j !== i) })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{quotes.length} quotes · {quotes.filter(q => q.status === 'Accepted').length} accepted this month</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setBuilding(true)}><Icon name="plus" size={13} />New quote</button>
        </div>
      </div>

      {building && (
        <div className="card mb-4" style={{ overflow: 'visible' }}>
          <div className="card-head">
            <h3 className="card-title">Quotation</h3>
            <button className="icon-btn" onClick={() => setBuilding(false)}><Icon name="x" size={14} /></button>
          </div>
          <div className="card-body" style={{ padding: 18, overflow: 'visible' }}>
            {/* Top header (company + title) */}
            <div className="flex between center" style={{ marginBottom: 12 }}>
              <div className="fw-7" style={{ fontSize: 18 }}>ONE CLOUD NEXT-GEN CO., LTD</div>
              <div className="fw-7" style={{ fontSize: 16, letterSpacing: '0.06em' }}>QUOTATION</div>
            </div>

            <div className="grid-2" style={{ gap: 16, marginBottom: 12 }}>
              <div className="field">
                <label>Customer</label>
                <select value={selectedCustomerId || ''} onChange={e => onSelectCustomer(e.target.value || undefined)}>
                  <option value="">— Select —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.org_name ? ` (${c.org_name})` : ''}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Link to Request</label>
                <select
                  value={selectedRequestId || ''}
                  onChange={e => onSelectRequest(e.target.value || undefined)}
                  disabled={!selectedCustomerId}
                >
                  <option value="">— Select a request —</option>
                  {customerRequests.map(r => (
                    <option key={r.id} value={r.id}>{(r.legacy_id || r.id) + ' · ' + (r.hostname || '') + ' · [' + (r.task_type || 'new') + ']'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main table */}
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table className="tbl" style={{ border: '1px solid var(--line)' }}>
                <thead>
                  <tr style={{ background: 'oklch(0.78 0.08 250)', color: 'white' }}>
                    <th>Specification</th>
                    <th>vCPU (Cores)</th>
                    <th>RAM (GB)</th>
                    <th>Storage (GB)</th>
                    <th className="right">Unit Price (MMK)</th>
                    <th className="right">QTY</th>
                    <th>Billing Term/Month</th>
                    <th className="right">Extended Price (MMK)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Instance Cost section */}
                  <tr><td colSpan={8} className="fw-6" style={{ background: 'var(--surface-2)' }}>Instance Cost</td></tr>
                  {sheet.instance.map((l, i) => (
                    <tr key={i}>
                      <td><input value={l.spec} onChange={e => updateInstance(i, { spec: e.target.value })} /></td>
                      <td><input type="number" value={l.vcpu} onChange={e => updateInstance(i, { vcpu: +e.target.value })} style={{ width: 70 }} /></td>
                      <td><input type="number" value={l.ram} onChange={e => updateInstance(i, { ram: +e.target.value })} style={{ width: 70 }} /></td>
                      <td><input type="number" value={l.storage} onChange={e => updateInstance(i, { storage: +e.target.value })} style={{ width: 90 }} /></td>
                      <td className="right"><input type="number" value={l.unit} onChange={e => updateInstance(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                      <td className="right"><input type="number" value={l.qty} onChange={e => updateInstance(i, { qty: +e.target.value })} style={{ width: 60 }} /></td>
                      <td>
                        <select value={l.term} onChange={e => updateInstance(i, { term: e.target.value as InstanceLine['term'] })}>
                          <option>Monthly</option>
                          <option>Annual</option>
                        </select>
                      </td>
                      <td className="right tnum fw-6">MMK {formatMMK(instExt(l))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8}>
                      <button className="btn sm" onClick={addInstance}><Icon name="plus" size={11} />Add instance line</button>
                      {sheet.instance.length > 0 && <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => removeInstance(sheet.instance.length - 1)}><Icon name="trash" size={11} />Remove last</button>}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="right fw-6">Instance Cost Total</td>
                    <td className="right tnum fw-7">MMK {formatMMK(instanceSub)}</td>
                  </tr>

                  {/* Backup Cost section */}
                  <tr><td colSpan={8} className="fw-6" style={{ background: 'var(--surface-2)' }}>Backup Cost (GB)</td></tr>
                  {sheet.backup.length === 0 && (
                    <tr><td colSpan={8} className="text-mute">No backup lines yet</td></tr>
                  )}
                  {sheet.backup.map((l, i) => (
                    <tr key={i}>
                      <td><input value={l.spec} onChange={e => updateBackup(i, { spec: e.target.value })} /></td>
                      <td></td>
                      <td></td>
                      <td><input type="number" value={l.storage} onChange={e => updateBackup(i, { storage: +e.target.value })} style={{ width: 90 }} /></td>
                      <td className="right"><input type="number" value={l.unit} onChange={e => updateBackup(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                      <td></td>
                      <td></td>
                      <td className="right tnum fw-6">MMK {formatMMK(backupExt(l))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8}>
                      <button className="btn sm" onClick={addBackup}><Icon name="plus" size={11} />Add backup line</button>
                      {sheet.backup.length > 0 && <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => removeBackup(sheet.backup.length - 1)}><Icon name="trash" size={11} />Remove last</button>}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="right fw-6">Backup Cost Total {backupTotalGB > 0 ? `— ${backupTotalGB}GB` : ''}</td>
                    <td className="right tnum fw-7">MMK {formatMMK(backupSub || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="grid-3" style={{ gap: 16, marginTop: 14 }}>
              <div />
              <div />
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card-body">
                  <div className="flex between"><div>Sub Total</div><div className="tnum fw-7">MMK {formatMMK(subTotal)}</div></div>
                  <div className="flex between mt-1">
                    <div>(+) Commercial Tax {sheet.taxPct}%</div>
                    <div className="tnum fw-7">MMK {formatMMK(tax)}</div>
                  </div>
                  <div className="divider" />
                  <div className="flex between fw-7"><div>Grand Total</div><div className="tnum">MMK {formatMMK(grand)}</div></div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button
                className="btn"
                onClick={async () => {
                  if (!selectedCustomerId) { toast('Select a customer first', 'warn'); return }
                  if (!selectedRequestId) { toast('Select a request first', 'warn'); return }
                  const id = await addQuote({
                    vm_request_id: selectedRequestId,
                    status: 'Draft',
                    validity_date: new Date(Date.now() + 30 * 86400000).toISOString(),
                    subtotal_monthly: subTotal,
                    subtotal_annual: subTotal * 12,
                    total_annual: grand * 12,
                    currency: 'MMK',
                    line_items: [
                      ...sheet.instance.map(l => ({ kind: 'instance', ...l })),
                      ...sheet.backup.map(l => ({ kind: 'backup', ...l })),
                    ],
                    notes: null,
                  })
                  toast(`Quote ${id} saved`, 'ok')
                  setBuilding(false)
                }}
              >
                Save draft
              </button>

              <button
                className="btn accent"
                onClick={async () => {
                  if (!selectedCustomerId) { toast('Select a customer first', 'warn'); return }
                  if (!selectedRequestId) { toast('Select a request first', 'warn'); return }
                  const id = await addQuote({
                    vm_request_id: selectedRequestId,
                    status: 'Sent',
                    validity_date: new Date(Date.now() + 30 * 86400000).toISOString(),
                    subtotal_monthly: subTotal,
                    subtotal_annual: subTotal * 12,
                    total_annual: grand * 12,
                    currency: 'MMK',
                    line_items: [
                      ...sheet.instance.map(l => ({ kind: 'instance', ...l })),
                      ...sheet.backup.map(l => ({ kind: 'backup', ...l })),
                    ],
                    notes: null,
                  })
                  toast(`Quote ${id} prepared for Finance`, 'ok')
                  setBuilding(false)
                }}
              >
                <Icon name="mail" size={12} />Send to Finance
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => setBuilding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Quote #</th><th>Customer</th><th>Type</th><th className="right">Lines</th><th className="right">Total (1y)</th><th>Valid until</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {quotes.map(q => {
                const cust = customers.find(c => c.id === q.customer_id)
                const request = vmRequests.find(r => r.id === q.vm_request_id)
                return (
                  <tr key={q.id}>
                    <td className="mono fw-6">{q.legacy_id || q.id.slice(0, 8)}</td>
                    <td>{cust?.org_name || cust?.name || '—'}</td>
                    <td><span className="pill subtle"><span className="dot" />{request?.task_type || 'new'}</span></td>
                    <td className="right tnum">{(q.line_items || []).length}</td>
                    <td className="right tnum fw-6">MMK {formatMMK(q.total_annual)}</td>
                    <td className="tnum text-sm">{new Date(q.validity_date).toLocaleDateString()}</td>
                    <td><span className={`pill ${q.status === 'Accepted' ? 'ok' : q.status === 'Sent' ? 'accent' : 'subtle'}`}><span className="dot" />{q.status}</span></td>
                    <td className="right"><button className="btn sm" onClick={() => toast(`Downloaded ${q.legacy_id || q.id}.pdf`, 'info')}><Icon name="download" size={11} />PDF</button></td>
                  </tr>
                )
              })}
              {quotes.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="title">No quotes yet</div><div className="sub">Create your first quote to get started.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default QuotesView
