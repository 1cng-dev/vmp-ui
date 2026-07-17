import React, { useEffect } from 'react'
import { StatusPill, ExpiryCell, formatMMK } from '../ui/ui'
import Icon from '../../lib/icons'
import useReceiptStore from '../../store/receiptStore'

interface CustomerDashboardProps {
  me: any
  myVMs: any[]
  myInvs: any[]
  myTickets: any[]
  myRequests: any[]
  setView: (view: string) => void
  setDetailVm: (vm: any) => void
  setOpenTicket: (ticket: any) => void
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ me, myVMs, myInvs, myTickets, myRequests, setView, setDetailVm, setOpenTicket }) => {
  const { receipts, loadReceiptsByCustomer } = useReceiptStore()
  
  useEffect(() => {
    if (me?.id) {
      loadReceiptsByCustomer(me.id)
    }
  }, [me?.id, loadReceiptsByCustomer])
  
  const kycLocked = me.kyc_status !== 'Approved'
  const activeVMs = myVMs.filter((v: any) => v.status === 'Active').length
  const totalVcpu = myVMs.filter((v: any) => v.status === 'Active').reduce((a: number, v: any) => a + (v.vcpu || 0), 0)
  const totalRam = myVMs.filter((v: any) => v.status === 'Active').reduce((a: number, v: any) => a + (v.ram_gb || 0), 0)
  const totalStorage = myVMs.filter((v: any) => v.status === 'Active').reduce((a: number, v: any) => a + (v.storage_gb || 0), 0)
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const monthly = myInvs
    .filter((i: any) => {
      const invDate = i.invoice_date ? new Date(i.invoice_date) : null
      return invDate && invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear && i.status === 'Payment Received'
    })
    .reduce((a: number, i: any) => a + (parseFloat(i.gross_amount) || parseFloat(i.amount) || 0), 0)
  const openTickets = myTickets.filter((t: any) => t.status === 'Open' || t.status === 'In Progress')
  const pendingInv = myInvs.filter((i: any) => i.status !== 'Payment Received')
  const pendingReq = myRequests.filter((r: any) => r.status === 'Pending' || r.status === 'In Progress')

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Welcome back, {me.name.split(' ')[0]}</h1>
          <p className="page-subtitle">{me.company} · here's your service status today.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setView('request')} disabled={kycLocked} title={kycLocked ? `Locked — KYC ${me.kyc_status}` : ''}>
            {kycLocked && <Icon name="lock" size={11}/>}
            <Icon name="plus" size={13}/>Request new VM
          </button>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="metric"><div className="label"><Icon name="server" size={13}/> Active VMs</div><div className="value tnum">{activeVMs}</div><div className="trend">{myVMs.length} total</div></div>
        <div className="metric"><div className="label"><Icon name="cpu" size={13}/> Allocated vCPU</div><div className="value tnum">{totalVcpu}</div><div className="trend">{totalRam} GB RAM · {totalStorage} GB storage</div></div>
        <div className="metric"><div className="label"><Icon name="invoice" size={13}/> Monthly spend</div><div className="value tnum" style={{ fontSize: 20 }}>MMK {formatMMK(monthly)}</div><div className="trend">{pendingInv.length} pending invoice{pendingInv.length !== 1 ? 's' : ''}</div></div>
        <div className="metric"><div className="label"><Icon name="mail" size={13}/> Open tickets</div><div className="value tnum">{openTickets.length}</div><div className="trend">{pendingReq.length} pending request{pendingReq.length !== 1 ? 's' : ''}</div></div>
      </div>

      <div className="grid-asym mb-4">
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">My VMs</h3>
            <button className="btn sm" onClick={() => setView('vms')}>View all<Icon name="chevron-right" size={12}/></button>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead><tr><th>VM</th><th>Status</th><th>Spec</th><th>Public IP</th><th>Expires</th></tr></thead>
              <tbody>
                {myVMs.length === 0 && <tr><td colSpan={5}><div className="empty"><div className="title">No VMs yet</div><div className="sub">Click "Request new VM" to deploy your first virtual machine.</div></div></td></tr>}
                {myVMs.slice(0, 5).map((v: any) => (
                  <tr key={v.id} onClick={() => setDetailVm(v)}>
                    <td><div className="fw-6">{v.hostname}</div><div className="text-xs text-mute mono">{v.legacy_id || v.id}</div></td>
                    <td><StatusPill status={v.status}/></td>
                    <td className="mono text-xs">{v.vcpu}c · {v.ram_gb}GB · {v.storage_gb}GB</td>
                    <td className="mono text-xs">{v.public_ip || '—'}</td>
                    <td><ExpiryCell date={v.expiry}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Open tickets</h3>{openTickets.length > 0 && <button className="btn sm" onClick={() => setView('tickets')}>All</button>}</div>
            <div className="card-body" style={{ padding: 0 }}>
              {openTickets.length === 0 && <div className="empty"><div className="sub">No open tickets.</div></div>}
              {openTickets.slice(0, 3).map((t: any) => (
                <div key={t.id} onClick={() => setOpenTicket(t)} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                  <div className="flex center between mb-1">
                    <span className="mono text-xs text-mute">{t.legacy_id || t.id}</span>
                    <StatusPill status={t.status}/>
                  </div>
                  <div className="fw-6 text-sm">{t.subject}</div>
                  <div className="text-xs text-mute mt-1">Updated {t.updated}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3 className="card-title">Quick actions</h3></div>
            <div className="card-body">
              <div className="flex col gap-2">
                <button className="btn" onClick={() => setView('request')} disabled={kycLocked}>
                  {kycLocked && <Icon name="lock" size={11}/>}<Icon name="plus" size={12}/>Request new VM
                </button>
                <button className="btn" onClick={() => setView('tickets')}><Icon name="mail" size={12}/>Open support ticket</button>
                <button className="btn" onClick={() => setView('invoices')} disabled={kycLocked}>
                  {kycLocked && <Icon name="lock" size={11}/>}<Icon name="invoice" size={12}/>Pay invoice
                </button>
              </div>
            </div>
          </div>
          {receipts.length > 0 && (
            <div className="card">
              <div className="card-head"><h3 className="card-title">Recent receipts</h3><button className="btn sm" onClick={() => setView('invoices')}>View all</button></div>
              <div className="card-body" style={{ padding: 0 }}>
                {receipts.slice(0, 3).map((r: any) => (
                  <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                    <div className="flex center between mb-1">
                      <span className="mono text-xs text-mute">{r.legacy_id}</span>
                      <span className="text-xs text-mute">{new Date(r.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')}</span>
                    </div>
                    <div className="text-sm text-mute" style={{ lineHeight: 1.4 }}>{r.message}</div>
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
