import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface DBQuote {
  id: string
  customer_id: string
  legacy_id: string
  status: string
  amount: number
  valid_until: string
  created_at: string
  updated_at: string
}

const fetchQuotes = async (): Promise<DBQuote[]> => {
  const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as DBQuote[]) || []
}

export const useQuotes = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: quotes = [], isLoading: quotesLoading, error } = useQuery({
    queryKey: ['quotes'],
    queryFn: fetchQuotes,
    staleTime: 1000 * 60 * 5,
  })

  const addQuote = useMutation({
    mutationFn: async (quote: Omit<DBQuote, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('quotes').insert(quote).select().single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      createAlert('success', 'Quote created successfully')
    },
  })

  const updateQuote = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DBQuote> }) => {
      const { error } = await supabase.from('quotes').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      logActivity({ text: 'Quote updated', kind: 'quote', meta: { quoteId: id } })
      createAlert('success', 'Quote updated successfully')
    },
  })

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      logActivity({ text: 'Quote deleted', kind: 'quote', meta: { quoteId: id } })
      createAlert('success', 'Quote deleted successfully')
    },
  })

  return {
    quotes,
    quotesLoading,
    error,
    addQuote: addQuote.mutateAsync,
    updateQuote: updateQuote.mutateAsync,
    deleteQuote: deleteQuote.mutateAsync,
  }
}