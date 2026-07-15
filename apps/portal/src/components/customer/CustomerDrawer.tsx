import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers } from '../../store/customerStore'
import { useVMs } from '../../store/vmStore'
import { useInvoices } from '../../store/invoiceStore'
import useTeamStore from '../../store/teamStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, formatMMK, Avatar, Spinner, ExpiryCell } from '../ui/ui'
import type { Customer } from '../../types'

interface CustomerDrawerProps {
  custId: string
  onClose: () => void
  openVM: (id: string) => void
  openModal: (kind: string, props?: any) => void
}

const CustomerDrawer: React.FC<CustomerDrawerProps> = ({ custId, onClose, openVM, openModal }) => {
  const navigate = useNavigate()
  const { customers, updateCustomer } = useCustomers()
  const { vms } = useVMs()
  const { invoices } = useInvoices()
  const { team } = useTeamStore()
  const { toast } = useUIStore()
  const [isLoading, setIsLoading] = useState(() => customers.length === 0)

  const c = customers.find((cust: any) => cust.id === custId)

  const customerVMs = vms.filter((v: any) => v.customer_id === custId)
  const customerInvoices = invoices.filter((i: any) => i.customer === custId)
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Customer | undefined>(c)

  useEffect(() => { setDraft(c) }, [custId])

  if (isLoading) {
    return (
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Spinner />
        </div>
      </div>
    )
  }

  if (!c) {
    console.log('Customer not found after loading')
    return (
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer" onClick={e => e.stopPropagation()}>
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ color: 'var(--bad)' }}>Customer not found</div>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="flex center between mb-2">
            <span className="mono text-sm text-mute">{c.legacy_id}</span>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <div className="flex center gap-3">
            <Avatar name={c.name} size={48} />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{c.name}</h2>
              <div className="text-sm text-mute">{c.org_name} · {c.email} · {c.phone}</div>
              <div className="flex gap-2 mt-2">
                <StatusPill status={c.kyc_status} />
                <StatusPill status={c.status} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => openModal('email', { to: c.email })}><Icon name="mail" size={12} />Email</button>
              <button className="btn primary" onClick={() => openModal('newvm', { customer: c.id })}><Icon name="plus" size={12} />New VM</button>
            </div>
          </div>
        </div>

        <div className="tabs">
          {['overview', 'customerVMs', 'kyc', 'billing', 'comms'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : t === 'customerVMs' ? 'VMs' : t === 'kyc' ? 'KYC' : t === 'billing' ? 'Billing' : 'Communication'}
              {t === 'customerVMs' && <span className="count">{customerVMs.length}</span>}
              {t === 'billing' && <span className="count">{customerInvoices.length}</span>}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {tab === 'overview' && (
            <div className="flex col gap-4">
              <div className="grid-3">
                <div className="metric"><div className="label">Active VMs</div><div className="value tnum" style={{ fontSize: 22 }}>{customerVMs.filter((v: any) => v.status === 'Active').length}</div></div>
                <div className="metric"><div className="label">Open invoices</div><div className="value tnum" style={{ fontSize: 22 }}>{customerInvoices.filter((i: any) => i.status !== 'Payment Received').length}</div></div>
              </div>
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Account details</h3>
                  {!editing
                    ? <button className="btn sm" onClick={() => setEditing(true)}><Icon name="edit" size={11} />Edit</button>
                    : <div className="flex gap-2">
                      <button className="btn sm ghost" onClick={() => { setDraft(c); setEditing(false) }}>Cancel</button>
                      <button className="btn sm accent" onClick={() => { if (draft) { updateCustomer(c.id, draft); setEditing(false) } }}><Icon name="check" size={11} />Save</button>
                    </div>
                  }
                </div>
                <div className="card-body">
                  {!editing ? (
                    <dl className="dl">
                      <dt>Customer ID</dt><dd className="mono">{c.legacy_id}</dd>
                      <dt>Company</dt><dd>{c.org_name || '—'}</dd>
                      <dt>Contact name</dt><dd>{c.name}</dd>
                      <dt>Email</dt><dd>{c.email}</dd>
                      <dt>Phone</dt><dd className="mono">{c.phone}</dd>
                      <dt>Alt Phone</dt><dd className="mono">{c.alt_phone || '—'}</dd>
                      <dt>Preferred Contact</dt><dd>{c.preferred_contact_method || '—'}</dd>
                      <dt>Address</dt><dd>{c.address || '—'}</dd>
                      <dt>City</dt><dd>{c.city || '—'}</dd>
                      <dt>State</dt><dd>{c.state || '—'}</dd>
                      <dt>Postal Code</dt><dd>{c.postal_code || '—'}</dd>
                      <dt>Country</dt><dd>{c.country || '—'}</dd>
                      {c.org_name && (
                        <>
                          <dt>Org Reg No</dt><dd>{c.org_reg_no || '—'}</dd>
                          <dt>Org Type</dt><dd>{c.org_type || '—'}</dd>
                          <dt>Org Industry</dt><dd>{c.org_industry || '—'}</dd>
                          <dt>Org Rep Title</dt><dd>{c.org_rep_title || '—'}</dd>
                          <dt>Org Employees</dt><dd>{c.org_employees || '—'}</dd>
                          <dt>Org Website</dt><dd>{c.org_website || '—'}</dd>
                        </>
                      )}
                      <dt>NRC/ID</dt><dd className="mono">{c.nrc_or_id || '—'}</dd>
                      <dt>KYC Status</dt><dd><StatusPill status={c.kyc_status} /></dd>
                      <dt>KYC Reviewed By</dt><dd>{c.kyc_reviewed_by || '—'}</dd>
                      <dt>KYC Reviewed At</dt><dd className="tnum">{c.kyc_reviewed_at || '—'}</dd>
                      <dt>KYC Reviewer Note</dt><dd>{c.kyc_reviewer_note || '—'}</dd>
                      <dt>Payment Method</dt><dd>{c.payment_method || '—'}</dd>
                      <dt>Payer Name</dt><dd>{c.payer_name || '—'}</dd>
                      <dt>Payer Phone</dt><dd className="mono">{c.payer_phone || '—'}</dd>
                      <dt>Agreed to Terms</dt><dd>{c.agreed_to_terms ? 'Yes' : 'No'}</dd>
                      <dt>Customer since</dt><dd className="tnum">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd>
                      <dt>Last Login</dt><dd className="tnum">{c.last_login_at || '—'}</dd>
                    </dl>
                  ) : (
                    <div className="flex col gap-3">
                      <div className="grid-2" style={{ gap: 12 }}>
                        <div className="field"><label>Contact name</label><input value={draft?.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value } as Customer)} /></div>
                        <div className="field"><label>Company</label><input value={draft?.org_name || ''} onChange={e => setDraft({ ...draft, org_name: e.target.value } as Customer)} /></div>
                      </div>
                      <div className="grid-2" style={{ gap: 12 }}>
                        <div className="field"><label>Email</label><input value={draft?.email || ''} onChange={e => setDraft({ ...draft, email: e.target.value } as Customer)} /></div>
                        <div className="field"><label>Phone</label><input value={draft?.phone || ''} onChange={e => setDraft({ ...draft, phone: e.target.value } as Customer)} /></div>
                      </div>
                      {/* <div className="field"><label>Salesperson</label>
                        <select value={draft.salesperson} onChange={e => setDraft({ ...draft, salesperson: e.target.value })}>
                          {team.filter((t: any) => t.role === 'Sales').map((t: any) => <option key={t.id}>{t.name}</option>)}
                        </select>
                      </div> */}
                    </div>
                  )}
                </div>
              </div>
              {/* <div className="card">
                <div className="card-head"><h3 className="card-title">Internal notes</h3></div>
                <div className="card-body">
                  <textarea rows={3} defaultValue={c.notes} placeholder="Notes only visible to admin team…" onBlur={e => updateCustomer(c.id, { notes: e.target.value })}/>
                </div>
              </div> */}
            </div>
          )}

          {tab === 'customerVMs' && (
            <div className="card">
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>VM</th><th>Status</th><th>Spec</th><th>Expires</th></tr></thead>
                  <tbody>
                    {customerVMs.map((v: any) => (
                      <tr key={v.id} onClick={() => openVM(v.id)}>
                        <td><div className="fw-6">{v.hostname}</div><div className="text-xs text-mute mono">{v.legacy_id || v.id}</div></td>
                        <td><StatusPill status={v.status} /></td>
                        <td className="mono text-xs">{v.vcpu}c · {v.ram_gb}GB · {v.storage_gb}GB</td>
                        <td><ExpiryCell date={v.expiry}/></td>
                      </tr>
                    ))}
                    {customerVMs.length === 0 && <tr><td colSpan={4}><div className="empty"><div className="sub">No VMs yet for this customer.</div></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'kyc' && (
            <div className="flex col gap-4">
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">KYC submission</h3>
                  <StatusPill status={c.kyc_status} />
                </div>
                <div className="card-body">
                  <dl className="dl">
                    <dt>Status</dt><dd><StatusPill status={c.kyc_status} /></dd>
                    <dt>Submitted</dt><dd className="tnum">{c.created_at}</dd>
                    <dt>KYC Reviewed By</dt><dd>{c.kyc_reviewed_by || '—'}</dd>
                    <dt>KYC Reviewed At</dt><dd className="tnum">{c.kyc_reviewed_at || '—'}</dd>
                    <dt>KYC Reviewer Note</dt><dd>{c.kyc_reviewer_note || '—'}</dd>
                    <dt>Documents</dt><dd>
                      <div className="flex gap-2 wrap">
                        {c.nrc_front_url && (
                          <a href={c.nrc_front_url} target="_blank" rel="noopener noreferrer" className="pill subtle" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                            <Icon name="file" size={10} />NRC Front
                          </a>
                        )}
                        {c.nrc_back_url && (
                          <a href={c.nrc_back_url} target="_blank" rel="noopener noreferrer" className="pill subtle" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                            <Icon name="file" size={10} />NRC Back
                          </a>
                        )}
                        {c.org_cert_url && (
                          <a href={c.org_cert_url} target="_blank" rel="noopener noreferrer" className="pill subtle" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                            <Icon name="file" size={10} />Company Registration
                          </a>
                        )}
                        {c.org_tax_id_url && (
                          <a href={c.org_tax_id_url} target="_blank" rel="noopener noreferrer" className="pill subtle" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                            <Icon name="file" size={10} />Tax ID
                          </a>
                        )}
                        {c.director_id_url && (
                          <a href={c.director_id_url} target="_blank" rel="noopener noreferrer" className="pill subtle" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                            <Icon name="file" size={10} />Director ID
                          </a>
                        )}
                        {!c.nrc_front_url && !c.nrc_back_url && !c.org_cert_url && !c.org_tax_id_url && !c.director_id_url && (
                          <span className="text-mute">No documents uploaded</span>
                        )}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className="flex gap-2">
                    <button className="btn" onClick={() => { onClose(); navigate('/admin/kyc?customer=' + c.id); }}><Icon name="eye" size={12} />View in KYC review</button>
                    {c.kyc_status === 'Pending' && <>
                      <button className="btn accent" onClick={() => { onClose(); navigate('/admin/kyc?customer=' + c.id); }}><Icon name="check" size={12} />Approve in KYC</button>
                      <button className="btn" onClick={() => toast(`Re-upload request emailed to ${c.email}`, 'info')}><Icon name="refresh" size={12} />Request re-upload</button>
                      <button className="btn danger" onClick={() => { onClose(); navigate('/admin/kyc?customer=' + c.id); }}><Icon name="x" size={12} />Reject in KYC</button>
                    </>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div className="card">
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>Invoice</th><th>Issued</th><th className="right">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {customerInvoices.map((i: any) => (
                      <tr key={i.id}>
                        <td className="mono">{i.id}</td>
                        <td className="tnum text-sm">{i.issued}</td>
                        <td className="right tnum fw-6">MMK {formatMMK(i.amount)}</td>
                        <td><StatusPill status={i.status} /></td>
                      </tr>
                    ))}
                    {customerInvoices.length === 0 && <tr><td colSpan={4}><div className="empty"><div className="sub">No invoices yet.</div></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'comms' && (
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Communication history</h3>
                <button className="btn sm" onClick={() => openModal('email', { to: c.email })}><Icon name="mail" size={11} />Send email</button>
              </div>
              <div className="card-body" style={{ padding: '6px 18px' }}>
                {[
                ].map((a: any, i: number) => (
                  <div key={i} className="feed-item">
                    <span className="dot customer" />
                    <div className="body"><span className="fw-6 text-sm">{a[2]}</span> — {a[3]}<div className="meta">{a[1]} · {a[0]}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerDrawer
