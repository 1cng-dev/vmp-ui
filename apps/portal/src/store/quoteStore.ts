import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { DBQuote, NewQuoteInput } from '../types'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'

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
  // Initialize with cached data from localStorage if available
  const [quotes, setQuotes] = useState<DBQuote[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('quotes-cache')
      return cached ? JSON.parse(cached) : []
    }
    return []
  })
  const [quotesLoading, setQuotesLoading] = useState(false)
  const { logActivity } = useActivityStore()

  // Save to localStorage whenever quotes changes
  useEffect(() => {
    if (typeof window !== 'undefined' && quotes.length > 0) {
      localStorage.setItem('quotes-cache', JSON.stringify(quotes))
    }
  }, [quotes])

  const loadQuotes = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setQuotes((data as DBQuote[]) || [])
    } finally {
      setQuotesLoading(false)
    }
  }, [])

  const subscribeToQuotes = useCallback(() => {
    const ch = supabase
      .channel(`quotes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        loadQuotes()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [loadQuotes])

  const addQuote = useCallback(async (q: NewQuoteInput) => {
    const { data, error } = await supabase.from('quotes').insert(q).select().single()
    if (error) throw error
    await loadQuotes()
    
    const quote = data as DBQuote
    
    // Get customer name for notification
    const { data: customer } = await supabase
      .from('customers')
      .select('name, org_name, account_type')
      .eq('id', quote.customer_id)
      .single()
    
    const customerName = customer?.account_type === 'Organization' && customer?.org_name
      ? `${customer.name} (${customer.org_name})`
      : (customer?.name || 'Unknown')
    
    // Get staff member who created the quote
    let actorName = 'System'
    let actorId = quote.customer_id
    if (quote.created_by) {
      const { data: staff } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', quote.created_by)
        .single()
      if (staff) {
        actorName = `${staff.name} (${staff.staff_code})`
        actorId = quote.created_by
      } else {
        // Fallback to user's name or email if not in team_members
        const { data: user } = await supabase.auth.getUser()
        if (user?.user) {
          actorName = user.user.user_metadata?.name || user.user.email || 'System'
          actorId = quote.created_by
        }
      }
    }
    
    // Create notification and activity log for new quote
    await logActivity(
      `Created quote ${quote.legacy_id || quote.id} for ${customerName} - MMK ${quote.grand_total}`,
      'finance',
      actorName,
      { quoteId: quote.legacy_id || quote.id, amount: quote.grand_total, customerId: quote.customer_id, validityDate: quote.validity_date }
    )
    
    await createAlert({
      sev: 'info',
      title: 'New Quote Created',
      body: `New quote ${quote.legacy_id || quote.id} created for ${customerName} - MMK ${quote.grand_total}`,
      type: 'finance',
      related_entity_id: quote.id,
      related_entity_type: 'quote',
      actor_id: actorId,
      actor_name: actorName,
      metadata: {
        quote_id: quote.legacy_id || quote.id,
        amount: quote.grand_total,
        customer_id: quote.customer_id,
        validity_date: quote.validity_date,
        created_by: quote.created_by
      }
    })
    
    return quote.id
  }, [loadQuotes, logActivity])

  const updateQuote = useCallback(async (id: string, patch: Partial<DBQuote>) => {
    const previousQuote = quotes.find(q => q.id === id)
    const { error } = await supabase.from('quotes').update(patch).eq('id', id)
    if (error) throw error
    await loadQuotes()
    
    // Create notification for status change
    if (patch.status && previousQuote && patch.status !== previousQuote.status) {
      // Get current user (staff member) who made the change
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      let actorId = previousQuote.customer_id
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
      
      await logActivity(
        `Changed quote ${previousQuote.legacy_id || previousQuote.id} status from ${previousQuote.status} to ${patch.status}`,
        'finance',
        actorName,
        { quoteId: previousQuote.legacy_id || previousQuote.id, previousStatus: previousQuote.status, newStatus: patch.status, customerId: previousQuote.customer_id }
      )
      
      await createAlert({
        sev: 'info',
        title: 'Quote Status Changed',
        body: `Quote ${previousQuote.legacy_id || previousQuote.id} status changed from ${previousQuote.status} to ${patch.status}`,
        type: 'finance',
        related_entity_id: id,
        related_entity_type: 'quote',
        actor_id: actorId,
        actor_name: actorName,
        metadata: {
          quote_id: previousQuote.legacy_id || previousQuote.id,
          previous_status: previousQuote.status,
          new_status: patch.status,
          customer_id: previousQuote.customer_id
        }
      })
    }
  }, [loadQuotes, quotes, logActivity])

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
