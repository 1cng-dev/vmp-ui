import { useState, useCallback } from 'react'
import type { Invoice } from '../types'

export interface InvoiceStoreValue {
  invoices: Invoice[]
  addInvoice: (i: any) => string
  updateInvoice: (id: string, patch: any) => void
  markPaid: (id: string) => void
}

const useInvoiceStore = (): InvoiceStoreValue => {
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const addInvoice = useCallback((i: any) => {
    const year = new Date().getFullYear()
    const id = `INV-${year}-${String(100 + Math.floor(Math.random() * 900)).padStart(4, '0')}`
    const newI = {
      id, status: 'Pending', method: '—', receipt: '—', currency: 'MMK',
      issued: i.issued || new Date().toISOString().slice(0, 10),
      invoiceDate: i.invoiceDate || new Date().toISOString().slice(0, 10),
      ...i,
    }
    setInvoices(s => [newI, ...s])
    return id
  }, [])

  const updateInvoice = useCallback((id: string, patch: any) => {
    setInvoices(s => s.map(i => i.id === id ? { ...i, ...patch } : i))
  }, [])

  const markPaid = useCallback((id: string) => {
    if (!invoices.find(i => i.id === id)) return
    updateInvoice(id, { status: 'Payment Received', receipt: `RCT-${id.slice(4)}` })
  }, [invoices, updateInvoice])

  return {
    invoices,
    addInvoice, updateInvoice, markPaid,
  }
}

export default useInvoiceStore
