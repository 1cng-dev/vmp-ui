import React, { useEffect } from 'react'
import useCustomerStore from '../store/customerStore'
import useVMStore from '../store/vmStore'
import useInvoiceStore from '../store/invoiceStore'
import useActivityStore from '../store/activityStore'
import { useAuth } from '../components/auth/Auth'
import useTeamStore from '../store/teamStore'
import Icon from '../lib/icons'
import { StatusPill, formatMMK, ExpiryCell, Donut, CircularSpinner } from '../components/ui/ui'

interface DashboardProps {
  openVM: (id: string) => void
  setView: (view: string) => void
  openModal: (type: string, data?: any) => void
}

const Dashboard: React.FC<DashboardProps> = ({ openVM, setView, openModal }) => {
  const { customers } = useCustomerStore()
  const { vms, vmsLoading, loadVMs } = useVMStore()
  const { invoices, loadInvoices } = useInvoiceStore()
  const { activity } = useActivityStore()
  const auth = useAuth()
  const { loadTeam } = useTeamStore()
  const TODAY = new Date()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const activeVMs = vms.filter(v => v.status === 'Active').length
  const expiringSoon = vms.filter(v => {
    if (!v.expiry || v.expiry === '—') return false
    const d = Math.ceil((new Date(v.expiry).getTime() - TODAY.getTime()) / 86400000)
    // Only VMs expiring in the future (1-14 days), not today or already expired, with Active or Suspended status only
    return d > 0 && d <= 14 && (v.status === 'Active' || v.status === 'Suspended')
  })
  const expiredVMs = vms.filter(v => {
    if (!v.expiry || v.expiry === '—') return false
    const d = Math.ceil((new Date(v.expiry).getTime() - TODAY.getTime()) / 86400000)
    // VMs that have already expired or expire today, with Active or Suspended status only
    return d <= 0 && (v.status === 'Active' || v.status === 'Suspended')
  })
  // Calculate overdue based on due date, not status (to match AgingView logic)
  const overdueInvoices = invoices.filter(i => {
    if (i.status === 'Payment Received') return false
    if (!i.due) return false
    const days = Math.ceil((TODAY.getTime() - new Date(i.due).getTime()) / 86400000)
    return days > 0 // overdue if due date is in the past
  })
  const overdue = overdueInvoices.length
  // Calculate MRR from invoices in current month
  const currentMonth = TODAY.getMonth()
  const currentYear = TODAY.getFullYear()
  const mrr = invoices.filter(i => {
    if (!i.invoice_date) return false
    const invDate = new Date(i.invoice_date)
    return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear && i.status === 'Payment Received'
  }).reduce((sum, i) => {
    const grossAmount = typeof i.gross_amount === 'string' ? parseFloat(i.gross_amount) : (i.gross_amount || 0)
    const amount = typeof i.amount === 'string' ? parseFloat(i.amount) : (i.amount || 0)
    return sum + (grossAmount || amount || 0)
  }, 0)
  const overdueValue = overdueInvoices.reduce((a, i) => a + (typeof i.amount === 'string' ? parseFloat(i.amount) : (i.amount || 0)), 0)

  // Calculate weekly VM growth
  const oneWeekAgo = new Date(TODAY.getTime() - 7 * 86400000)
  const twoWeeksAgo = new Date(TODAY.getTime() - 14 * 86400000)
  const vmsThisWeek = vms.filter(v => v.created_at && new Date(v.created_at) >= oneWeekAgo).length
  const vmsLastWeek = vms.filter(v => v.created_at && new Date(v.created_at) >= twoWeeksAgo && new Date(v.created_at) < oneWeekAgo).length
  const weeklyGrowth = vmsThisWeek - vmsLastWeek

  // Calculate monthly MRR growth
  const lastMonthDate = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1)
  const mrrLastMonth = invoices.filter(i => {
    if (!i.invoice_date) return false
    const invDate = new Date(i.invoice_date)
    return invDate.getMonth() === lastMonthDate.getMonth() && invDate.getFullYear() === lastMonthDate.getFullYear() && i.status === 'Payment Received'
  }).reduce((sum, i) => {
    const grossAmount = typeof i.gross_amount === 'string' ? parseFloat(i.gross_amount) : (i.gross_amount || 0)
    const amount = typeof i.amount === 'string' ? parseFloat(i.amount) : (i.amount || 0)
    return sum + (grossAmount || amount || 0)
  }, 0)
  const mrrGrowth = mrrLastMonth > 0 ? ((mrr - mrrLastMonth) / mrrLastMonth) * 100 : 0

  const statusDonut = [
    { label: 'Active', value: vms.filter(v => v.status === 'Active').length, color: 'oklch(0.62 0.13 155)' },
    { label: 'Suspended', value: vms.filter(v => v.status === 'Suspended').length, color: 'oklch(0.6 0.18 25)' },
    { label: 'Terminated', value: vms.filter(v => v.status === 'Terminated').length, color: 'oklch(0.55 0.01 80)' },
  ]

  useEffect(() => {
    // Load data only if not already loaded
    if (vms.length === 0) {
      loadVMs()
    }
    if (invoices.length === 0) {
      loadInvoices()
    }
    loadTeam() // Always load team as it's not state-persisted
  }, [loadTeam, loadVMs, loadInvoices, vms.length, invoices.length])

  // Check VM expiry and create notifications
  useEffect(() => {
    const checkVMExpiry = async () => {
      for (const vm of vms) {
        if (!vm.expiry || vm.expiry === '—' || vm.status !== 'Active') continue
        
        // Only create alerts for key expiry dates via vmExpiryService, not here
        // This prevents duplicate alerts since vmExpiryService handles this
      }
    }
    
    if (vms.length > 0) {
      checkVMExpiry()
    }
  }, [vms])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">{greeting}, {auth?.user?.name || auth?.user?.email?.split('@')[0] || 'User'}</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — here's what needs attention today.</p>        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => openModal('newvm')}><Icon name="plus" size={13} />New VM</button>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="metric">
          <div className="label"><Icon name="server" size={13} /> Active VMs</div>
          <div className="value tnum">{activeVMs}</div>
          <div className="trend">{weeklyGrowth > 0 ? <span className="up">+{weeklyGrowth}</span> : weeklyGrowth < 0 ? <span className="down">{weeklyGrowth}</span> : '0'} this week · {vms.length} total</div>
        </div>
        <div className="metric">
          <div className="label"><Icon name="clock" size={13} /> Expiring ≤ 14 days</div>
          <div className="value tnum" style={{ color: 'oklch(0.55 0.16 75)' }}>{expiringSoon.length}</div>
          <div className="trend">{expiringSoon.length > 0 ? `${expiringSoon.length} need follow-up` : 'all clear'}</div>
        </div>
        <div className="metric">
          <div className="label"><Icon name="invoice" size={13} /> Overdue payments</div>
          <div className="value tnum" style={{ color: 'var(--bad)' }}>{overdue}</div>
          <div className="trend">MMK {formatMMK(overdueValue)} outstanding</div>
        </div>
        <div className="metric">
          <div className="label"><Icon name="arrow-up" size={13} /> Monthly recurring</div>
          <div className="value tnum">MMK {formatMMK(mrr)}</div>
          <div className="trend">{mrrGrowth > 0 ? <span className="up">+{mrrGrowth.toFixed(1)}%</span> : mrrGrowth < 0 ? <span className="down">{mrrGrowth.toFixed(1)}%</span> : '0%'} vs last month</div>
        </div>
      </div>

      <div className="grid-asym mb-4">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Expiring soon</h2>
              <div className="card-sub">VMs needing renewal action in the next 14 days</div>
            </div>
            <button className="btn sm" onClick={() => setView('vms')}>View all<Icon name="chevron-right" size={12} /></button>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>VM</th><th>Customer</th><th>Expires</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vmsLoading ? (
                  <tr><td colSpan={4}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
                ) : (
                  <>
                    {expiringSoon.slice(0, 6).map(v => {
                      const c = customers.find(c => c.id === (v as any).customer_id)
                      return (
                        <tr key={v.id} onClick={() => openVM(v.id)}>
                          <td>
                            <div className="fw-6">{(v as any).hostname || v.id}</div>
                            <div className="text-xs text-mute mono">{(v as any).legacy_id || v.id}</div>
                          </td>
                          <td>{c?.name}{c?.org_name || c?.company ? ` (${c?.org_name || c?.company})` : ''}</td>
                          <td><ExpiryCell date={v.expiry || ''} /></td>
                          <td><StatusPill status={v.status} /></td>
                        </tr>
                      )
                    })}
                    {expiringSoon.length === 0 && <tr><td colSpan={4}><div className="empty"><div className="title">Nothing expiring soon</div><div className="sub">No VMs need renewal in the next 7 days.</div></div></td></tr>}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">VM status</h2>
            </div>
            <div className="card-body">
              <div className="flex center gap-4">
                {vms.length > 0 ? (
                  <div style={{ position: 'relative' }}>
                    <Donut segments={statusDonut} size={120} thickness={16} />
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                      <div>
                        <div className="tnum" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{vms.length}</div>
                        <div className="text-xs text-mute">total</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: 120, height: 120, display: 'grid', placeItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="tnum" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{vms.length}</div>
                      <div className="text-xs text-mute">total</div>
                    </div>
                  </div>
                )}
                <div className="flex col" style={{ gap: 8, flex: 1 }}>
                  {statusDonut.map(s => (
                    <div key={s.label} className="flex center between">
                      <div className="flex center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                        <span className="text-sm">{s.label}</span>
                      </div>
                      <span className="tnum fw-6 text-sm">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-asym">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title" style={{ color: 'var(--bad)' }}>Expired VMs</h2>
              <div className="card-sub">VMs that have passed their expiry date</div>
            </div>
            <button className="btn sm" onClick={() => setView('vms')}>View all<Icon name="chevron-right" size={12} /></button>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>VM</th><th>Customer</th><th>Expired</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vmsLoading ? (
                  <tr><td colSpan={4}><div className="empty" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}><CircularSpinner /></div></td></tr>
                ) : (
                  <>
                    {expiredVMs.slice(0, 6).map(v => {
                      const c = customers.find(c => c.id === (v as any).customer_id)
                      const daysExpired = v.expiry ? Math.ceil((new Date(v.expiry).getTime() - TODAY.getTime()) / 86400000) : 0
                      const expiryDate = v.expiry ? new Date(v.expiry) : null
                      const isSameDay = expiryDate && expiryDate.toDateString() === TODAY.toDateString()
                      // Show "expired today" if days expired is 0 or -1 (handles timezone edge cases)
                      const showExpiredToday = isSameDay || Math.abs(daysExpired) <= 1
                      return (
                        <tr key={v.id} onClick={() => openVM(v.id)}>
                          <td>
                            <div className="fw-6">{(v as any).hostname || v.id}</div>
                            <div className="text-xs text-mute mono">{(v as any).legacy_id || v.id}</div>
                          </td>
                          <td>{c?.name}{c?.org_name || c?.company ? ` (${c?.org_name || c?.company})` : ''}</td>
                          <td><div className="text-sm" style={{ color: 'var(--bad)' }}>{showExpiredToday ? 'expired today' : `${Math.abs(daysExpired)} days ago`}</div></td>
                          <td><StatusPill status={v.status} /></td>
                        </tr>
                      )
                    })}
                {expiredVMs.length === 0 && <tr><td colSpan={4}><div className="empty"><div className="title">No expired VMs</div><div className="sub">All VMs are within their expiry period.</div></div></td></tr>}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h2 className="card-title">Recent activity</h2>
            <button className="btn ghost sm" onClick={() => setView('activity')}>All<Icon name="chevron-right" size={12} /></button>
          </div>
          <div className="card-body" style={{ padding: '6px 18px' }}>
            {activity.slice(0, 6).map((a, i) => (
              <div key={i} className="feed-item">
                <span className={`dot ${a.kind}`} />
                <div className="body">
                  {a.text}
                  <div className="meta">{a.actor} · {a.ts.split(' ')[1] || a.ts}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
