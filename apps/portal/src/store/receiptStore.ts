import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { DBReceipt, NewReceiptInput } from '../types'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'

const fetchReceipts = async (): Promise<DBReceipt[]> => {
  const { data, error } = await supabase.from('receipts').select('*').order('sent_at', { ascending: false })
  if (error) throw error
  return (data as DBReceipt[]) || []
}

const useReceiptStore = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: receipts = [], isLoading: receiptsLoading, error } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
    staleTime: 1000 * 60 * 5,
  })

  const addReceipt = useMutation({
    mutationFn: async (r: NewReceiptInput) => {
      const { data, error } = await supabase.from('receipts').insert(r).select().single()
      if (error) throw error
      return data
    },
    onSuccess: async (receipt) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      
      const receiptData = receipt as DBReceipt
      
      // Get customer name for notification
      const { data: customer } = await supabase
        .from('customers')
        .select('name, org_name, account_type')
        .eq('id', receiptData.customer_id)
        .single()
      
      const customerName = customer?.account_type === 'Organization' && customer?.org_name
        ? `${customer.name} (${customer.org_name})`
        : (customer?.name || 'Unknown')
      
      // Get invoice legacy_id for notification
      const { data: invoice } = await supabase
        .from('invoices')
        .select('legacy_id')
        .eq('id', receiptData.invoice_id)
        .single()
      
      const invoiceDisplayId = invoice?.legacy_id || receiptData.invoice_id
      
      // Get current user (staff member) who sent the receipt
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      let actorId = receiptData.customer_id
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
          actorName = user.user_metadata?.name || user.email || 'System'
          actorId = user.id
        }
      }
      
      await logActivity({
        text: `Sent receipt ${receiptData.legacy_id || receiptData.id} to ${customerName} for invoice ${invoiceDisplayId}`,
        kind: 'finance',
        meta: { receiptId: receiptData.legacy_id || receiptData.id, invoiceId: invoiceDisplayId, customerId: receiptData.customer_id, sentAt: receiptData.sent_at }
      })
      
      await createAlert({
        sev: 'info',
        title: 'Receipt Sent',
        body: `Receipt ${receiptData.legacy_id || receiptData.id} sent to ${customerName} for invoice ${invoiceDisplayId}`,
        type: 'finance',
        related_entity_id: receiptData.id,
        related_entity_type: 'receipt',
        actor_id: actorId,
        actor_name: actorName,
        metadata: {
          receipt_id: receiptData.legacy_id || receiptData.id,
          invoice_id: invoiceDisplayId,
          customer_id: receiptData.customer_id,
          sent_at: receiptData.sent_at
        }
      })
    },
  })

  return {
    receipts,
    receiptsLoading,
    error,
    addReceipt: addReceipt.mutateAsync,
  }
}

export default useReceiptStore
