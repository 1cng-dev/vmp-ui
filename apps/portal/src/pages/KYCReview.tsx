// KYC Review — dedicated view for reviewing customer KYC submissions

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import useCustomerStore from '../store/customerStore'
import useUIStore from '../store/uiStore'
import useActivityStore from '../store/activityStore'
import Icon from '../lib/icons'
import { Avatar, StatusPill, CircularSpinner } from '../components/ui/ui'
import { useAuth } from '../components/auth/Auth'
import { createAlert } from '../services/notificationService'

interface Doc {
  name: string
  url: string
  tone: string
}

export const KYCReviewView: React.FC = () => {
  const { customers, customersLoading, updateCustomer, loadCustomers } = useCustomerStore()
  const { toast } = useUIStore()
  const { logActivity } = useActivityStore()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('Pending')
  const [selected, setSelected] = useState<any>(null)
  const [note, setNote] = useState('')
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  const auth = useAuth()
  const reviewerName = auth?.user?.name || auth?.user?.email || 'Unknown'

  // Load customers on mount (real-time subscription is handled at provider level)
  useEffect(() => {
    if (customers.length === 0) {
      loadCustomers()
    }
  }, [loadCustomers, customers.length])
  const pending = customers.filter((c: any) => c.kyc_status === 'Pending')
  const approved = customers.filter((c: any) => c.kyc_status === 'Approved')
  const rejected = customers.filter((c: any) => c.kyc_status === 'Rejected')

  const list = tab === 'Pending' ? pending : tab === 'Approved' ? approved : tab === 'Rejected' ? rejected : customers

  // auto-select first pending on first render, or specific customer from URL
  useEffect(() => {
    const customerId = searchParams.get('customer')
    if (customerId) {
      const customer = customers.find((c: any) => c.id === customerId)
      if (customer) {
        setSelected(customer)
        // Set tab based on customer's KYC status
        if (customer.kyc_status === 'Pending') setTab('Pending')
        else if (customer.kyc_status === 'Approved') setTab('Approved')
        else if (customer.kyc_status === 'Rejected') setTab('Rejected')
      }
    } else if (!selected && list.length) {
      setSelected(list[0])
    }
    if (selected && !list.find((c: any) => c.id === selected.id)) setSelected(list[0] || null)
  }, [tab, list.length, customers, searchParams])

  const sel = selected ? customers.find((c: any) => c.id === selected.id) : null

  const handleExport = () => {
    const dataToExport = list.map((c: any) => ({
      'Customer Name': c.name,
      'Company': c.org_name || 'N/A',
      'Email': c.email,
      'Phone': c.phone || 'N/A',
      'KYC Status': c.kyc_status,
      'Account Type': c.account_type,
      'Submitted Date': c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A',
      'Reviewer': c.kyc_reviewed_by || 'N/A',
      'Review Date': c.kyc_reviewed_at ? new Date(c.kyc_reviewed_at).toLocaleDateString() : 'N/A',
      'Reviewer Note': c.kyc_reviewer_note || 'N/A',
    }))

    const headers = Object.keys(dataToExport[0] || {})
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => headers.map(header => {
        const value = row[header as keyof typeof row] || ''
        return `"${String(value).replace(/"/g, '""')}"`
      }).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `kyc-review-${tab.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast(`Exported ${dataToExport.length} customers to CSV`, 'ok')
  }

  const decide = async (id: string, decision: 'Pending' | 'Approved' | 'Rejected') => {
    const customer = customers.find((c: any) => c.id === id)
    const previousStatus = customer?.kyc_status || 'Pending'
    
    await updateCustomer(id, {
      kyc_status: decision,
      kyc_reviewer_note: note,
      kyc_reviewed_by: decision !== 'Pending' ? reviewerName : undefined,
      kyc_reviewed_at: decision !== 'Pending' ? new Date().toISOString() : undefined
    })
    
    // Create notification and activity log for approval/rejection
    if (decision === 'Approved' || decision === 'Rejected') {
      // Get staff member from team_members table
      const { supabase } = await import('../lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = reviewerName
      let actorId = auth?.user?.id
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
          actorId = user.id
        } else {
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || reviewerName
          actorId = user.id
        }
      }
      
      await logActivity(
        `${decision} KYC for customer ${customer?.name || customer?.org_name}`,
        'customer',
        actorName,
        { customerId: id, customerName: customer?.name || customer?.org_name, kycStatus: decision, previousStatus, reviewerNote: note }
      )
      
      await createAlert({
        sev: decision === 'Approved' ? 'info' : 'warn',
        title: `KYC ${decision}`,
        body: `Customer ${customer?.name || customer?.org_name} KYC has been ${decision.toLowerCase()}`,
        type: 'kyc',
        related_entity_id: id,
        related_entity_type: 'customer',
        actor_id: actorId,
        actor_name: actorName,
        metadata: { 
          kyc_status: decision, 
          previous_status: previousStatus,
          customer_name: customer?.name || customer?.org_name,
          reviewer_note: note
        }
      })
    }
    
    setNote('')
    toast(`KYC ${decision.toLowerCase()}`, decision === 'Approved' ? 'ok' : 'warn')
  }

  const docs: Doc[] = sel ? [
    sel.nrc_front_url && { name: 'NRC — front', url: sel.nrc_front_url, tone: 'oklch(0.6 0.16 30)' },
    sel.nrc_back_url && { name: 'NRC — back', url: sel.nrc_back_url, tone: 'oklch(0.55 0.16 230)' },
    sel.org_cert_url && { name: 'Company registration', url: sel.org_cert_url, tone: 'oklch(0.55 0.17 285)' },
    sel.director_id_url && { name: 'Director ID / selfie', url: sel.director_id_url, tone: 'var(--ok)' },
  ].filter(Boolean) as Doc[] : []

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">KYC review</h1>
          <p className="page-subtitle">{pending.length} awaiting review · avg. response time 4.2 hours · {approved.length} approved this period</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleExport}><Icon name="download" size={13} />Export</button>
        </div>
      </div>

      {/* Stats */}
        <div className="grid-4 mb-4">
          {[
            { label: 'Awaiting review', value: pending.length, color: 'oklch(0.55 0.16 75)', icon: 'clock' }, { label: 'Approved', value: approved.length, color: 'var(--ok)', icon: 'check' },
            { label: 'Rejected', value: rejected.length, color: 'var(--bad)', icon: 'x' },
            { label: 'Total customers', value: customers.length, color: 'var(--accent)', icon: 'users' },
          ].map(s => (
            <div key={s.label} className="metric">
              <div className="label flex center gap-2">
                <span style={{ width: 24, height: 24, borderRadius: 7, background: `${s.color}1a`, color: s.color, display: 'grid', placeItems: 'center' }}><Icon name={s.icon} size={13} /></span>
                {s.label}
              </div>
              <div className="value tnum" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

      <div className="grid-asym" style={{ alignItems: 'flex-start' }}>
        {/* Master list */}
          <div className="card">
            <div className="tabs">
              {['Pending', 'Approved', 'Rejected'].map(t => (
                <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t}<span className="count">{t === 'Pending' ? pending.length : t === 'Approved' ? approved.length : rejected.length}</span>
                </button>
              ))}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
                <>
                  {list.map((c: any) => (
                <div key={c.id} onClick={() => setSelected(c)} style={{
                  padding: '14px 18px', borderBottom: '1px solid var(--line)',
                  display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer',
                  background: sel?.id === c.id ? 'var(--accent-soft)' : 'transparent',
                  transition: 'background 0.12s',
                }}>
                  <Avatar name={c.name} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-6 text-sm">{c.name}</div>
                    <div className="text-xs text-mute" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.org_name || c.name} · {c.id}</div>
                  </div>
                  <StatusPill status={c.kyc_status} />
                </div>
              ))}
              {customersLoading ? (
                <div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div>
              ) : list.length === 0 && <div className="empty"><div className="title">All caught up</div><div className="sub">No {tab.toLowerCase()} submissions.</div></div>}
                </>
            </div>
          </div>

        {/* Detail / review panel */}
          <div className="card" style={{ position: 'sticky', top: 16 }}>
          {sel ? (
            <>
              <div className="card-head">
                <h3 className="card-title">Review submission</h3>
                <StatusPill status={sel.kyc_status} />
              </div>
              <div className="card-body">
                {/* Applicant */}
                <div className="flex center gap-3 mb-3">
                  <Avatar name={sel.name} size={46} />
                  <div style={{ flex: 1 }}>
                    <div className="fw-7" style={{ fontSize: 15 }}>{sel.name}</div>
                    <div className="text-xs text-mute">{sel.org_name || sel.name}</div>                  </div>
                </div>
                <dl className="dl">
                  <dt>Customer ID</dt><dd className="mono">{sel.legacy_id}</dd>
                  <dt>Email</dt><dd className="text-sm">{sel.email}</dd>
                  <dt>Phone</dt><dd className="mono text-sm">{sel.phone}</dd>
                  <dt>Type</dt><dd>{sel.account_type || (['Co', 'Ltd', 'Group', 'Holdings'].some((w: string) => (sel.org_name || '').includes(w)) ? 'Organization' : 'Individual')}</dd>
                  <dt>Submitted</dt><dd className="tnum">{sel.created_at ? new Date(sel.created_at).toLocaleDateString() : '—'}</dd>                </dl>

                <div className="divider" />
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Submitted documents</div>
                <div className="grid-2" style={{ gap: 8 }}>
                  {docs.map(d => (
                    <div key={d.name} onClick={() => window.open(d.url, '_blank')} style={{
                      border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    }}>
                      <div style={{ height: 56, background: `${d.tone}14`, display: 'grid', placeItems: 'center', color: d.tone }}>
                        <Icon name="file" size={20} />
                      </div>
                      <div style={{ padding: '7px 9px' }}>
                        <div className="fw-6" style={{ fontSize: 11.5 }}>{d.name}</div>
                        <div className="text-xs text-mute">View document</div>
                      </div>
                    </div>
                  ))}
                </div>

                {sel.kyc_status === 'Pending' && (
                  <>
                    <div className="divider" />
                    <div className="field">
                      <label>Reviewer note</label>
                      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note recorded with your decision…" />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="btn accent" style={{ flex: 1 }} onClick={() => decide(sel.id, 'Approved')}><Icon name="check" size={12} />Approve</button>
                      <button className="btn" onClick={() => { toast(`Re-upload requested from ${sel.email}`, 'info'); setNote(''); }}><Icon name="refresh" size={12} />Re-upload</button>
                      <button className="btn danger" onClick={() => decide(sel.id, 'Rejected')}><Icon name="x" size={12} />Reject</button>
                    </div>
                  </>
                )}
                {sel.kyc_status !== 'Pending' && (
                  <>
                    <div className="divider" />
                    <div>
                      KYC <strong>{sel.kyc_status.toLowerCase()}</strong> · reviewed by {sel.kyc_reviewed_by || 'Unknown'}
                      {sel.kyc_reviewed_at && (
                        <div className="text-xs text-mute">
                          on {new Date(sel.kyc_reviewed_at).toLocaleDateString()} at {new Date(sel.kyc_reviewed_at).toLocaleTimeString()}
                        </div>
                      )}
                      {sel.kyc_reviewer_note && (
                        <div className="text-xs text-mute mt-2" style={{ fontStyle: 'italic' }}>
                          Note: {sel.kyc_reviewer_note}
                        </div>
                      )}
                    </div>
                    {(sel.kyc_status === 'Approved' || sel.kyc_status === 'Rejected') && <button className="btn" style={{ flex: 1, marginTop: 12 }} onClick={() => setShowReopenConfirm(true)}><Icon name="refresh" size={12} />Re-open review</button>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="card-body">
              <div className="empty"><div className="sub">Select a customer to review</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {showReopenConfirm && sel && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'grid', placeItems: 'center', padding: 20
        }}>
          <div className="card" style={{ maxWidth: 400, width: '100%' }}>
            <div className="card-head">
              <h3 className="card-title">Re-open review</h3>
            </div>
            <div className="card-body">
              <p className="text-sm text-mute mb-3">
                Are you sure you want to re-open the KYC review for <strong>{sel.name}</strong>? This will reset the status to Pending.
              </p>
              <div className="flex gap-2">
                <button className="btn" onClick={() => setShowReopenConfirm(false)}>Cancel</button>
                <button className="btn accent" onClick={() => {
                  decide(sel.id, 'Pending')
                  setShowReopenConfirm(false)
                }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
