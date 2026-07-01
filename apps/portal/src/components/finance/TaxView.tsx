import React from 'react'
import useInvoiceStore from '../../store/invoiceStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { formatMMK } from '../ui/ui'

export const TaxView: React.FC = () => {
  const { invoices } = useInvoiceStore()
  const { toast } = useUIStore()
  const totalRev = invoices.filter((i: any) => i.status === 'Payment Received').reduce((a: number, i: any) => a + i.amount, 0)
  const vatRate = 5
  const vatCollected = Math.round(totalRev * vatRate / (100 + vatRate))
  const monthly: any[] = []

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Tax / VAT report</h1>
          <p className="page-subtitle">Commercial tax tracking · Q2 2026</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => toast('Tax report (Excel) downloaded', 'info')}><Icon name="download" size={13} />Excel report</button>
        </div>
      </div>

      <div className="grid-4 mb-4">
        <div className="metric"><div className="label">Q2 revenue</div><div className="value tnum" style={{ fontSize: 20 }}>MMK {formatMMK(totalRev * 3)}</div></div>
        <div className="metric"><div className="label">VAT collected ({vatRate}%)</div><div className="value tnum" style={{ fontSize: 20 }}>MMK {formatMMK(vatCollected * 3)}</div></div>
        <div className="metric"><div className="label">Filing due</div><div className="value tnum" style={{ fontSize: 20 }}>15 Jul</div><div className="trend">Q2 IRD submission</div></div>
        <div className="metric"><div className="label">Status</div><div className="value" style={{ fontSize: 16 }}><span className="pill ok"><span className="dot" />On track</span></div></div>
      </div>

      <div className="card mb-4">
        <div className="card-head"><h3 className="card-title">Monthly breakdown</h3></div>
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Month</th><th className="right">Gross revenue</th><th className="right">Commercial tax (5%)</th><th className="right">Net revenue</th><th>Status</th></tr></thead>
            <tbody>
              {monthly.map(([m, rev, tax]) => (
                <tr key={m}>
                  <td className="fw-6">{m}</td>
                  <td className="right tnum">MMK {formatMMK(rev as number)}</td>
                  <td className="right tnum">MMK {formatMMK(tax as number)}</td>
                  <td className="right tnum">MMK {formatMMK((rev as number) - (tax as number))}</td>
                  <td><span className="pill ok"><span className="dot" />Filed</span></td>
                </tr>
              ))}
              {invoices.filter((i: any) => i.status === 'Payment Received').length === 0 && <tr><td colSpan={5}><div className="empty"><div className="title">No paid invoices</div><div className="sub">No revenue data available for tax report.</div></div></td></tr>}
              <tr style={{ background: 'var(--surface-2)' }}>
                <td className="fw-7">Total</td>
                <td className="right tnum fw-7">MMK {formatMMK(monthly.reduce((a: number, m: any) => a + m[1], 0))}</td>
                <td className="right tnum fw-7">MMK {formatMMK(monthly.reduce((a: number, m: any) => a + m[2], 0))}</td>
                <td className="right tnum fw-7">MMK {formatMMK(monthly.reduce((a: number, m: any) => a + m[1] - m[2], 0))}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="card-title">Filing checklist · Q2 2026</h3></div>
        <div className="card-body">
          {monthly.length === 0 && <div className="empty"><div className="title">No filing data</div><div className="sub">Add paid invoices to generate tax report data.</div></div>}
        </div>
      </div>
    </div>
  )
}
