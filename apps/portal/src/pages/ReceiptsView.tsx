import React, { useEffect } from 'react'
import useReceiptStore from '../store/receiptStore'
import useCustomerStore from '../store/customerStore'
import useInvoiceStore from '../store/invoiceStore'

interface ReceiptsViewProps {
  openCust: (id: string) => void
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({ openCust }) => {
  const { receipts, receiptsLoading, loadReceipts } = useReceiptStore()
  const { customers } = useCustomerStore()
  const { invoices, loadInvoices } = useInvoiceStore()

  useEffect(() => {
    loadReceipts()
    loadInvoices()
  }, [loadReceipts, loadInvoices])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">Payment receipt history</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {receiptsLoading ? (
            <div className="empty"><div className="sub">Loading receipts...</div></div>
          ) : receipts.length === 0 ? (
            <div className="empty">
              <div className="title">No receipts yet</div>
              <div className="sub">Receipts will appear here after Finance sends them.</div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Customer</th>
                  <th>Invoice ID</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r: any) => {
                  const customer = customers.find((c: any) => c.id === r.customer_id)
                  const invoice = invoices.find((i: any) => i.id === r.invoice_id)
                  return (
                    <tr key={r.id}>
                      <td className="mono text-sm fw-6">{r.legacy_id}</td>
                      <td className="text-sm">
                        <button 
                          className="btn-link" 
                          onClick={() => openCust(r.customer_id)}
                          style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {customer?.name || customer?.company || 'Unknown'}
                        </button>
                      </td>
                      <td className="mono text-sm">{invoice?.legacy_id || invoice?.id.slice(0, 8) || '—'}</td>
                      <td className="text-sm">{new Date(r.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')}</td>
                      <td><span className={`pill ${r.status === 'sent' ? 'accent' : r.status === 'delivered' ? 'ok' : 'bad'}`}>{r.status}</span></td>
                      <td className="text-sm text-mute" style={{ maxWidth: 300 }}>{r.message}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
