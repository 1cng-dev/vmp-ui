import React, { useState } from 'react'
import { useCustomers } from '../../store/customerStore'
import { useVMs } from '../../store/vmStore'
import { useInvoices } from '../../store/invoiceStore'
import { useTickets } from '../../store/ticketStore'
import { useVMRequests } from '../../store/vmRequestStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill, formatMMK } from '../ui/ui'

interface Customer360Props {
  customer: any
  onClose: () => void
  openCust: (id: string) => void
  openModal?: (kind: string, props?: any) => void
  setView?: (view: string) => void
  role?: string
}

export const Customer360: React.FC<Customer360Props> = ({ customer, onClose, openCust, openModal, setView, role }) => {
  const { customers, updateCustomer, setKYC, deleteCustomer, resetPassword } = useCustomers()
  const { vms } = useVMs()
  const { invoices } = useInvoices()
  const { tickets } = useTickets()
  const { vmRequests } = useVMRequests()
  const { toast } = useUIStore()
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  // Role-based permissions for views
  const hasVMsAccess = ['Admin', 'Staff', 'Engineer', 'Sales'].includes(role || '')
  const hasFinanceAccess = ['Admin', 'Staff', 'Finance'].includes(role || '')
  const hasTicketsAccess = ['Admin', 'Staff', 'Engineer'].includes(role || '')
  const hasTasksAccess = ['Admin', 'Staff', 'Engineer', 'Sales'].includes(role || '')

  const c = customers.find((x: any) => x.id === customer.id) || customer
  const customerVMs = vms.filter((v: any) => v.customer_id === c.id)
  const customerInvoices = invoices.filter((i: any) => i.customer === c.id)
  const customerTickets = tickets.filter((t: any) => t.customer === c.id || t.customer_id === c.id)
  const customerVMRequests = vmRequests.filter((r: any) => r.customer_id === c.id)

  const ltv = c.totalSpend
  const mrr = customerVMs.filter((v: any) => v.status === 'Active').reduce((a: number, v: any) => a + v.priceMonth, 0)
  const openTickets = customerTickets.filter((t: any) => {
    const status = t.status?.toLowerCase()
    return status === 'open' || status === 'in progress'
  }).length

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ width: 'min(900px, 95vw)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <div className="flex center between mb-2">
            <span className="mono text-sm text-mute">{c.legacy_id || c.id}</span>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
          <div className="flex center gap-3">
            <Avatar name={c.name} size={56} />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{c.name}</h2>
              <div className="text-sm text-mute mt-1">{c.company} · {c.email} · {c.phone}</div>
              <div className="flex gap-2 mt-2">
                <StatusPill status={c.kyc_status} />
                <StatusPill status={c.status} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {/* 360° KPIs */}
          <div className="grid-4 mb-4">
            <div className="metric"><div className="label">Lifetime value</div><div className="value tnum" style={{ fontSize: 18 }}>MMK {formatMMK(ltv)}</div></div>
            <div className="metric"><div className="label">Monthly recurring</div><div className="value tnum" style={{ fontSize: 18 }}>MMK {formatMMK(mrr)}</div></div>
            <div className="metric"><div className="label">Active VMs</div><div className="value tnum">{customerVMs.filter((v: any) => v.status === 'Active').length}</div><div className="trend">{customerVMs.length} total</div></div>
            <div className="metric"><div className="label">Open issues</div><div className="value tnum" style={{ fontSize: 18, color: openTickets > 0 ? 'var(--bad)' : 'var(--ok)' }}>{openTickets}</div><div className="trend">{openTickets} tickets</div></div>
          </div>

          {/* Account actions */}
          <div className="card mb-4">
            <div className="card-head"><h3 className="card-title">Account actions</h3></div>
            <div className="card-body">
              <div className="flex gap-2 wrap">
                <button className="btn" onClick={() => setResetPasswordUser({ id: c.id, name: c.name, email: c.email })}><Icon name="key" size={12} />Reset password</button>
                {c.kyc_status === 'Pending' && <>
                  <button className="btn accent" onClick={() => setKYC(c.id, 'Approved')}><Icon name="check" size={12} />Approve KYC</button>
                  <button className="btn danger" onClick={() => setKYC(c.id, 'Rejected')}><Icon name="x" size={12} />Reject KYC</button>
                </>}
                {c.status === 'Active'
                  ? <button className="btn" onClick={() => { updateCustomer(c.id, { status: 'Inactive' }); toast(`${c.name} suspended`, 'warn'); }}><Icon name="pause" size={12} />Suspend account</button>
                  : <button className="btn primary" onClick={() => { updateCustomer(c.id, { status: 'Active' }); toast(`${c.name} reactivated`, 'ok'); }}><Icon name="play" size={12} />Reactivate</button>
                }
                <button className="btn danger" onClick={() => {
                  if (openModal) {
                    openModal('confirm', {
                      title: 'Delete Customer',
                      message: `Delete customer ${c.name}? This will permanently remove their account and all associated data.`,
                      onConfirm: async () => {
                        try {
                          await deleteCustomer(c.id)
                          toast(`Customer ${c.name} deleted`, 'ok')
                          onClose()
                        } catch (error) {
                          toast('Failed to delete customer', 'error')
                        }
                      }
                    })
                  }
                }}><Icon name="trash" size={12} />Delete account</button>
              </div>
            </div>
          </div>

          {/* All-data tabs as collapsed lists */}
          <div className="grid-2" style={{ gap: 14 }}>
            <div className="card">
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">VMs ({customerVMs.length})</h3>
                {customerVMs.length > 0 && hasVMsAccess && <button className="btn sm ghost" onClick={() => { onClose(); if (setView) setView('vms'); }}>View all</button>}
              </div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>VM</th><th>Status</th></tr></thead>
                  <tbody>
                    {customerVMs.slice(0, 5).map((v: any) => (
                      <tr key={v.id}><td><div className="fw-6 text-xs">{v.hostname}</div><div className="text-xs text-mute mono">{v.legacy_id || v.id}</div></td><td><StatusPill status={v.status} /></td></tr>
                    ))}
                    {customerVMs.length === 0 && <tr><td colSpan={2}><div className="text-mute text-sm" style={{ padding: 12, textAlign: 'center' }}>No VMs</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Invoices ({customerInvoices.length})</h3>
                {customerInvoices.length > 0 && hasFinanceAccess && <button className="btn sm ghost" onClick={() => { onClose(); if (setView) setView('finance'); }}>View all</button>}
              </div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>Invoice</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {customerInvoices.slice(0, 5).map((i: any) => (
                      <tr key={i.id}><td className="mono text-xs">{i.id}</td><td className="tnum text-xs">MMK {formatMMK(i.amount)}</td><td><StatusPill status={i.status} /></td></tr>
                    ))}
                    {customerInvoices.length === 0 && <tr><td colSpan={3}><div className="text-mute text-sm" style={{ padding: 12, textAlign: 'center' }}>No invoices</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Support tickets ({customerTickets.length})</h3>
                {customerTickets.length > 0 && hasTicketsAccess && <button className="btn sm ghost" onClick={() => { onClose(); if (setView) setView('tickets'); }}>View all</button>}
              </div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>Subject</th><th>Status</th></tr></thead>
                  <tbody>
                    {customerTickets.slice(0, 5).map((t: any) => (
                      <tr key={t.id}><td><div className="fw-6 text-xs">{t.subject}</div><div className="text-xs text-mute mono">{t.legacy_id || t.id}</div></td><td><StatusPill status={t.status} /></td></tr>
                    ))}
                    {customerTickets.length === 0 && <tr><td colSpan={2}><div className="text-mute text-sm" style={{ padding: 12, textAlign: 'center' }}>No tickets</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">Tasks / requests ({customerVMRequests.length})</h3>
                {customerVMRequests.length > 0 && hasTasksAccess && <button className="btn sm ghost" onClick={() => { onClose(); if (setView) setView('tasks'); }}>View all</button>}
              </div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>Task</th><th>Status</th></tr></thead>
                  <tbody>
                    {customerVMRequests.slice(0, 5).map((r: any) => (
                      <tr key={r.id}><td><div className="fw-6 text-xs" style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task_type} - {r.hostname}</div><div className="text-xs text-mute mono">{r.legacy_id || r.id}</div></td><td><StatusPill status={r.status} /></td></tr>
                    ))}
                    {customerVMRequests.length === 0 && <tr><td colSpan={2}><div className="text-mute text-sm" style={{ padding: 12, textAlign: 'center' }}>No tasks</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Open full profile link */}
          <div className="text-center mt-4">
            <button className="btn" onClick={() => { onClose(); openCust(c.id); }}>Open full profile<Icon name="external" size={11} /></button>
          </div>
        </div>
      </div>

      {resetPasswordUser && (
        <div className="modal-overlay" onClick={() => setResetPasswordUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Reset password</h3>
              <button className="icon-btn" onClick={() => setResetPasswordUser(null)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="flex col gap-3">
                <p style={{ margin: 0, color: 'var(--text-mute)' }}>
                  Reset password for <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email})?
                </p>
                <div className="field">
                  <label>New password</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <input
                    type="text"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className="btn primary"
                  style={{ width: '100%' }}
                  onClick={async () => {
                    if (!newPassword || !confirmPassword) {
                      toast('Please enter and confirm the password', 'bad')
                      return
                    }
                    if (newPassword !== confirmPassword) {
                      toast('Passwords do not match', 'bad')
                      return
                    }
                    setResetLoading(true)
                    try {
                      await resetPassword(resetPasswordUser.id, newPassword)
                      toast(`Password reset for ${resetPasswordUser.name}`, 'ok')
                      setResetPasswordUser(null)
                      setNewPassword('')
                      setConfirmPassword('')
                    } catch (error) {
                      toast('Failed to reset password', 'bad')
                    } finally {
                      setResetLoading(false)
                    }
                  }}
                  disabled={resetLoading || !newPassword || !confirmPassword}
                >
                  <Icon name="key" size={12} />{resetLoading ? 'Resetting...' : 'Reset password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
