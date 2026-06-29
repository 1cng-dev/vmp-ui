import { useState, useEffect } from 'react'
import Icon from '../lib/icons'
import { formatMMK } from '../components/ui/ui'
import useQuoteStore from '../store/quoteStore'
import useUIStore from '../store/uiStore'

interface QuotesViewProps {
  autoOpen?: boolean
  onAutoOpenReset?: () => void
}

const QuotesView = ({ autoOpen = false, onAutoOpenReset }: QuotesViewProps) => {
  const { quotes, addQuote } = useQuoteStore()
  const { toast } = useUIStore()
  const [building, setBuilding] = useState(false)
  const [form, setForm] = useState({
    customer: '', lines: [{ vcpu: 4, ram: 16, storage: 200, qty: 1, price: 180000 }]
  })

  useEffect(() => {
    if (autoOpen) {
      setBuilding(true)
      onAutoOpenReset?.()
    }
  }, [autoOpen, onAutoOpenReset])

  const lineTotal = (l: any) => l.price * l.qty
  const subTotal = form.lines.reduce((a: number, l: any) => a + lineTotal(l), 0)
  const yearTotal = subTotal * 12

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{quotes.length} quotes · {quotes.filter(q => q.status === 'Accepted').length} accepted this month</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setBuilding(true)}><Icon name="plus" size={13}/>New quote</button>
        </div>
      </div>

      {building && (
        <div className="card mb-4">
          <div className="card-head">
            <h3 className="card-title">Build a quote</h3>
            <button className="icon-btn" onClick={() => setBuilding(false)}><Icon name="x" size={14}/></button>
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="field"><label>Customer / prospect</label><input value={form.customer} onChange={e => setForm({...form, customer: e.target.value})} placeholder="Company name"/></div>
              <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>VMs</div>
              <table className="tbl">
                <thead><tr><th>vCPU</th><th>RAM (GB)</th><th>Storage (GB)</th><th className="right">Qty</th><th className="right">Unit (MMK/mo)</th><th className="right">Line total</th><th></th></tr></thead>
                <tbody>
                  {form.lines.map((l, i) => (
                    <tr key={i}>
                      <td><input type="number" value={l.vcpu} onChange={e => { const lines = [...form.lines]; lines[i].vcpu = +e.target.value; setForm({...form, lines}); }} style={{ width: 60, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4 }}/></td>
                      <td><input type="number" value={l.ram} onChange={e => { const lines = [...form.lines]; lines[i].ram = +e.target.value; setForm({...form, lines}); }} style={{ width: 60, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4 }}/></td>
                      <td><input type="number" value={l.storage} onChange={e => { const lines = [...form.lines]; lines[i].storage = +e.target.value; setForm({...form, lines}); }} style={{ width: 70, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4 }}/></td>
                      <td className="right"><input type="number" value={l.qty} onChange={e => { const lines = [...form.lines]; lines[i].qty = +e.target.value; setForm({...form, lines}); }} style={{ width: 50, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4 }}/></td>
                      <td className="right"><input type="number" value={l.price} onChange={e => { const lines = [...form.lines]; lines[i].price = +e.target.value; setForm({...form, lines}); }} style={{ width: 100, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4 }}/></td>
                      <td className="right tnum fw-6">{formatMMK(lineTotal(l))}</td>
                      <td className="right"><button className="icon-btn" onClick={() => setForm({...form, lines: form.lines.filter((_, j) => j !== i)})}><Icon name="trash" size={12}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setForm({...form, lines: [...form.lines, { vcpu: 4, ram: 16, storage: 200, qty: 1, price: 180000 }]})}><Icon name="plus" size={11}/>Add line</button>
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card-body">
                  <div className="grid-3" style={{ gap: 16 }}>
                    <div><div className="text-xs text-mute">Monthly subtotal</div><div className="tnum fw-7" style={{ fontSize: 18 }}>MMK {formatMMK(subTotal)}</div></div>
                    <div><div className="text-xs text-mute">Annual (1 year)</div><div className="tnum fw-7" style={{ fontSize: 18 }}>MMK {formatMMK(yearTotal)}</div></div>
                    <div><div className="text-xs text-mute">Annual w/ 10% discount</div><div className="tnum fw-7" style={{ fontSize: 18, color: 'var(--ok)' }}>MMK {formatMMK(Math.round(yearTotal * 0.9))}</div></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button className="btn" onClick={() => { const id = addQuote({ customer: form.customer, items: form.lines.length, total: subTotal * 12, status: 'Draft' }); toast('Quote saved as draft', 'ok'); setBuilding(false); }}>Save draft</button>
                <button className="btn accent" onClick={() => { const id = addQuote({ customer: form.customer, items: form.lines.length, total: subTotal * 12, status: 'Sent' }); toast(`Quote ${id} sent to customer`, 'ok'); setBuilding(false); }}><Icon name="mail" size={12}/>Send to Finance</button>
                <div style={{ flex: 1 }}/>
                <button className="btn ghost" onClick={() => setBuilding(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Quote #</th><th>Customer</th><th className="right">Lines</th><th className="right">Total (1y)</th><th>Valid until</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q.id}>
                  <td className="mono fw-6">{q.id}</td>
                  <td>{q.customer}</td>
                  <td className="right tnum">{q.items}</td>
                  <td className="right tnum fw-6">MMK {formatMMK(q.total)}</td>
                  <td className="tnum text-sm">{q.validity}</td>
                  <td><span className={`pill ${q.status === 'Accepted' ? 'ok' : q.status === 'Sent' ? 'accent' : 'subtle'}`}><span className="dot"/>{q.status}</span></td>
                  <td className="right"><button className="btn sm" onClick={() => toast(`Downloaded ${q.id}.pdf`, 'info')}><Icon name="download" size={11}/>PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default QuotesView
