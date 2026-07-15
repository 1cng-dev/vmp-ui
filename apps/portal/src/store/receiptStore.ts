import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DBReceipt, NewReceiptInput } from '../types'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'

export interface ReceiptStoreValue {
  receipts: DBReceipt[]
  receiptsLoading: boolean
  loadReceipts: () => Promise<void>
  loadReceiptsByCustomer: (customerId: string) => Promise<void>
  loadReceiptsByInvoice: (invoiceId: string) => Promise<DBReceipt[]>
  addReceipt: (r: NewReceiptInput) => Promise<string>
}

const useReceiptStore = (): ReceiptStoreValue => {
  const [receipts, setReceipts] = useState<DBReceipt[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const { logActivity } = useActivityStore()

  const loadReceipts = useCallback(async () => {
    const spin = receipts.length === 0
    try {
      if (spin) setReceiptsLoading(true)
      const { data, error } = await supabase.from('receipts').select('*').order('sent_at', { ascending: false })
      if (error) throw error
      setReceipts((data as DBReceipt[]) || [])
    } finally {
      if (spin) setReceiptsLoading(false)
    }
  }, [receipts.length])

  const loadReceiptsByCustomer = useCallback(async (customerId: string) => {
    const spin = receipts.length === 0
    try {
      if (spin) setReceiptsLoading(true)
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('customer_id', customerId)
        .order('sent_at', { ascending: false })
      if (error) throw error
      setReceipts((data as DBReceipt[]) || [])
    } finally {
      if (spin) setReceiptsLoading(false)
    }
  }, [receipts.length])

  const loadReceiptsByInvoice = useCallback(async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return (data as DBReceipt[]) || []
    } catch (error) {
      console.error('Failed to load receipts for invoice:', error)
      return []
    }
  }, [])

  const addReceipt = useCallback(async (r: NewReceiptInput) => {
    const { data, error } = await supabase.from('receipts').insert(r).select().single()
    if (error) throw error
    await loadReceipts()
    
    const receipt = data as DBReceipt
    
    // Get customer name for notification
    const { data: customer } = await supabase
      .from('customers')
      .select('name, org_name, account_type')
      .eq('id', receipt.customer_id)
      .single()
    
    const customerName = customer?.account_type === 'Organization' && customer?.org_name
      ? `${customer.name} (${customer.org_name})`
      : (customer?.name || 'Unknown')
    
    // Get invoice legacy_id for notification
    const { data: invoice } = await supabase
      .from('invoices')
      .select('legacy_id')
      .eq('id', receipt.invoice_id)
      .single()
    
    const invoiceDisplayId = invoice?.legacy_id || receipt.invoice_id
    
    // Get current user (staff member) who sent the receipt
    const { data: { user } } = await supabase.auth.getUser()
    let actorName = 'System'
    let actorId = receipt.customer_id
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
        actorName = user.user_metadata?.name || user.email || 'System'
        actorId = user.id
      }
    }
    
    // Create notification and activity log for receipt sent
    await logActivity(
      `Sent receipt ${receipt.legacy_id || receipt.id} to ${customerName} for invoice ${invoiceDisplayId}`,
      'finance',
      actorName,
      { receiptId: receipt.legacy_id || receipt.id, invoiceId: invoiceDisplayId, customerId: receipt.customer_id, sentAt: receipt.sent_at }
    )
    
    await createAlert({
      sev: 'info',
      title: 'Receipt Sent',
      body: `Receipt ${receipt.legacy_id || receipt.id} sent to ${customerName} for invoice ${invoiceDisplayId}`,
      type: 'finance',
      related_entity_id: receipt.id,
      related_entity_type: 'receipt',
      actor_id: actorId,
      actor_name: actorName,
      metadata: {
        receipt_id: receipt.legacy_id || receipt.id,
        invoice_id: invoiceDisplayId,
        customer_id: receipt.customer_id,
        sent_at: receipt.sent_at
      }
    })
    
    return receipt.id
  }, [loadReceipts, logActivity])

  return {
    receipts,
    receiptsLoading,
    loadReceipts,
    loadReceiptsByCustomer,
    loadReceiptsByInvoice,
    addReceipt,
  }
}

export default useReceiptStore
