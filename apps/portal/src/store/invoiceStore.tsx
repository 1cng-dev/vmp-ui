import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface DBInvoice {
  id: string
  customer_id: string
  legacy_id: string
  issued: string
  due: string
  paid_date?: string
  gross_amount: number
  net_amount: number
  vat: number
  status: string
  line_items: any[]
  created_at: string
  updated_at: string
}

const fetchInvoices = async (): Promise<DBInvoice[]> => {
  const { data, error } = await supabase.from('invoices').select('*').order('issued', { ascending: false })
  if (error) throw error
  const mappedData = (data || []).map((inv: any) => ({
    ...inv,
    issued: inv.issued,
    due: inv.due,
    paid_date: inv.paid_date,
    gross_amount: inv.gross_amount || inv.amount,
    net_amount: inv.net_amount || inv.amount,
    vat: inv.vat || 0,
    line_items: inv.line_items || [],
  })) as DBInvoice[]
  return mappedData
}

export const useInvoices = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: invoices = [], isLoading: invoicesLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
    staleTime: 1000 * 60 * 5,
  })

  const addInvoice = useMutation({
    mutationFn: async (invoice: Omit<DBInvoice, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('invoices').insert(invoice).select().single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      createAlert('success', 'Invoice created successfully')
    },
  })

  const updateInvoice = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DBInvoice> }) => {
      const { error } = await supabase.from('invoices').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      logActivity({ text: 'Invoice updated', kind: 'invoice', meta: { invoiceId: id } })
      createAlert('success', 'Invoice updated successfully')
    },
  })

  const markPaid = useMutation({
    mutationFn: async ({ id, receipt }: { id: string; receipt: string }) => {
      const { error } = await supabase.from('invoices').update({ paid_date: new Date().toISOString(), status: 'Paid' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      createAlert('success', 'Invoice marked as paid')
    },
  })

  return {
    invoices,
    invoicesLoading,
    error,
    addInvoice: addInvoice.mutateAsync,
    updateInvoice: updateInvoice.mutateAsync,
    markPaid: markPaid.mutateAsync,
  }
}