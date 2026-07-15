import React from 'react'
import { useInvoices } from '../../store/invoiceStore'
import { useCustomers } from '../../store/customerStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { formatMMK } from '../ui/ui'

interface RecurringViewProps {
  openModal?: (kind: string, props?: any) => void
}

export const RecurringView: React.FC<RecurringViewProps> = ({ openModal }) => {
  const { invoices } = useInvoices()
  const { customers } = useCustomers()
  const { toast } = useUIStore()

  // Calculate next billing date based on billing term
  const getNextBillDate = (dueDate: string, billingTerm: string) => {
    const due = new Date(dueDate)
    const next = new Date(due)
    switch (billingTerm) {
      case 'Monthly': next.setMonth(next.getMonth() + 1); break
      case 'Quarterly': next.setMonth(next.getMonth() + 3); break
      case 'Half Yearly': next.setMonth(next.getMonth() + 6); break
      case 'Yearly': next.setFullYear(next.getFullYear() + 1); break
      default: next.setMonth(next.getMonth() + 1); break
    }
    return next
  }

  // Get recurring invoices
  const cycles = invoices.filter((i: any) => i.billing_term && i.status !== 'Payment Received').map((i: any) => {
    const c = customers.find((c: any) => c.id === i.customer_id)
    const nextBill = getNextBillDate(i.due, i.billing_term)
    return {
      ...i,
      customerName: c?.name,
      customerOrg: c?.org_name,
      nextBill: nextBill.toISOString().slice(0, 10),
      autoRenew: true,
    }
  })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Recurring billing</h1>
          <p className="page-subtitle">{cycles.length} active subscriptions · MMK {formatMMK(cycles.reduce((a: number, v: any) => a + Number(v.amount), 0))} total recurring</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => toast('Billing schedule exported', 'info')}><Icon name="download" size={13} />Export schedule</button>
          <button className="btn primary" onClick={() => openModal?.('confirm', {
            title: 'Generate invoices',
            message: `Generate ${cycles.length} invoices for next billing cycle?`,
            onConfirm: () => toast(`Generated ${cycles.length} invoices for next cycle`, 'ok')
          })}><Icon name="refresh" size={13} />Generate invoices</button>        </div>
      </div>

      <div className="grid-3 mb-4">
        <div className="metric"><div className="label">Total Recurring</div><div className="value tnum" style={{ fontSize: 20 }}>MMK {formatMMK(cycles.reduce((a: number, v: any) => a + Number(v.amount), 0))}</div></div>
        <div className="metric"><div className="label">Next 7 days billing</div><div className="value tnum" style={{ fontSize: 20 }}>MMK {formatMMK(cycles.filter((v: any) => { const d = (new Date(v.nextBill).getTime() - new Date().getTime()) / 86400000; return d >= 0 && d <= 7; }).reduce((a: number, v: any) => a + Number(v.amount), 0))}</div></div>
        <div className="metric"><div className="label">Next 30 days billing</div><div className="value tnum" style={{ fontSize: 20 }}>MMK {formatMMK(cycles.filter((v: any) => { const d = (new Date(v.nextBill).getTime() - new Date().getTime()) / 86400000; return d >= 0 && d <= 30; }).reduce((a: number, v: any) => a + Number(v.amount), 0))}</div></div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="card-title">Billing schedule</h3></div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Billing Term</th><th className="right">Amount</th><th>Next bill</th><th></th></tr></thead>
            <tbody>
              {cycles.sort((a: any, b: any) => new Date(a.nextBill).getTime() - new Date(b.nextBill).getTime()).map((v: any) => (
                <tr key={v.id}>
                  <td><div className="fw-6">{v.legacy_id || v.id}</div></td>
                  <td className="text-sm">{v.customerName} ({v.customerOrg})</td>
                  <td className="text-sm">{v.billing_term}</td>
                  <td className="right tnum">MMK {formatMMK(v.amount)}</td>
                  <td className="tnum text-sm">{v.nextBill}</td>
                  <td className="right"><button className="btn sm" onClick={() => toast(`Invoice generated for ${v.legacy_id || v.id}`, 'ok')}>Bill now</button></td>
                </tr>
              ))}
              {cycles.length === 0 && <tr><td colSpan={6}><div className="empty"><div className="title">No active subscriptions</div><div className="sub">No invoices with recurring billing terms.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
