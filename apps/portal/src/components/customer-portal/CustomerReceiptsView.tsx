import React, { useEffect } from 'react'
import useReceiptStore from '../../store/receiptStore'
import useInvoiceStore from '../../store/invoiceStore'

interface CustomerReceiptsViewProps {
  me: any
}

export const CustomerReceiptsView: React.FC<CustomerReceiptsViewProps> = ({ me }) => {
  const { receipts, receiptsLoading, loadReceiptsByCustomer } = useReceiptStore()
  const { invoices, loadInvoices } = useInvoiceStore()

  useEffect(() => {
    if (me?.id) {
      if (receipts.length === 0) {
        loadReceiptsByCustomer(me.id)
      }
      if (invoices.length === 0) {
        loadInvoices()
      }
    }
  }, [me?.id, loadReceiptsByCustomer, loadInvoices, receipts.length, invoices.length])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-subtitle">Payment receipts sent by Finance</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {receiptsLoading ? (
            <div className="empty"><div className="sub">Loading receipts...</div></div>
          ) : receipts.length === 0 ? (
            <div className="empty">
              <div className="title">No receipts yet</div>
              <div className="sub">Payment receipts will appear here after Finance sends them.</div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Date</th>
                  <th>Invoice ID</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r: any) => {
                  const invoice = invoices.find((i: any) => i.id === r.invoice_id)
                  console.log('Receipt:', r.legacy_id, 'Invoice ID:', r.invoice_id, 'Found invoice:', invoice, 'Invoice legacy_id:', invoice?.legacy_id)
                  return (
                    <tr key={r.id}>
                      <td className="mono text-sm fw-6">{r.legacy_id}</td>
                      <td className="text-sm">{new Date(r.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '')}</td>
                      <td className="mono text-sm">{invoice?.legacy_id || invoice?.id.slice(0, 8) || '—'}</td>
                      <td className="text-sm text-mute" style={{ maxWidth: 400 }}>{r.message}</td>
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
