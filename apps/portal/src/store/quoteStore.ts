import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { DBQuote, NewQuoteInput } from '../types'

export interface QuoteStoreValue {
  quotes: DBQuote[]
  quotesLoading: boolean
  loadQuotes: () => Promise<void>
  addQuote: (q: NewQuoteInput) => Promise<string>
  updateQuote: (id: string, patch: Partial<DBQuote>) => Promise<void>
  deleteQuote: (id: string) => Promise<void>
  subscribeToQuotes: () => () => void
}

const QuoteContext = createContext<QuoteStoreValue | null>(null)

export const QuoteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [quotes, setQuotes] = useState<DBQuote[]>([])
  const [quotesLoading, setQuotesLoading] = useState(false)

  const loadQuotes = useCallback(async () => {
    const spin = quotes.length === 0
    try {
      if (spin) setQuotesLoading(true)
      const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setQuotes((data as DBQuote[]) || [])
    } finally {
      if (spin) setQuotesLoading(false)
    }
  }, [quotes.length])

  const subscribeToQuotes = useCallback(() => {
    const ch = supabase
      .channel(`quotes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => loadQuotes())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [loadQuotes])

  const addQuote = useCallback(async (q: NewQuoteInput) => {
    const { data, error } = await supabase.from('quotes').insert(q).select().single()
    if (error) throw error
    await loadQuotes()
    return (data as DBQuote).id
  }, [loadQuotes])

  const updateQuote = useCallback(async (id: string, patch: Partial<DBQuote>) => {
    const { error } = await supabase.from('quotes').update(patch).eq('id', id)
    if (error) throw error
    await loadQuotes()
  }, [loadQuotes])

  const deleteQuote = useCallback(async (id: string) => {
    const { error } = await supabase.from('quotes').delete().eq('id', id)
    if (error) throw error
    await loadQuotes()
  }, [loadQuotes])

  // Subscribe to realtime changes when provider mounts
  useEffect(() => {
    const unsubscribe = subscribeToQuotes()
    return unsubscribe
  }, [subscribeToQuotes])

  const value: QuoteStoreValue = { quotes, quotesLoading, loadQuotes, addQuote, updateQuote, deleteQuote, subscribeToQuotes }
  return React.createElement(QuoteContext.Provider, { value }, children as any)
}

export const useQuoteStore = (): QuoteStoreValue => {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error('useQuoteStore must be used within QuoteProvider')
  return ctx
}

export default useQuoteStore
