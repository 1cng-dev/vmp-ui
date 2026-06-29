import { useState, useCallback } from 'react'
import type { Quote } from '../types'

export interface QuoteStoreValue {
  quotes: Quote[]
  addQuote: (q: any) => string
  updateQuote: (id: string, patch: any) => void
  deleteQuote: (id: string) => void
}

const useQuoteStore = (): QuoteStoreValue => {
  const [quotes, setQuotes] = useState<Quote[]>([
    { id: 'Q-2026-018', customer: 'Monywa Trading', items: 3, total: 3600000, validity: '2026-06-10', status: 'Sent' },
    { id: 'Q-2026-017', customer: 'Loikaw Solar', items: 1, total: 1800000, validity: '2026-06-05', status: 'Accepted' },
    { id: 'Q-2026-016', customer: 'Dawei Port', items: 5, total: 18500000, validity: '2026-06-08', status: 'Sent' },
    { id: 'Q-2026-015', customer: 'Pathein Logistics', items: 2, total: 4200000, validity: '2026-06-01', status: 'Draft' },
  ])

  const addQuote = useCallback((q: any) => {
    const id = `Q-2026-${String(quotes.length + 19).padStart(3, '0')}`
    const newQ = {
      id,
      validity: '2026-06-15',
      ...q,
    }
    setQuotes(s => [newQ, ...s])
    return id
  }, [quotes.length])

  const updateQuote = useCallback((id: string, patch: any) => {
    setQuotes(s => s.map(q => q.id === id ? { ...q, ...patch } : q))
  }, [])

  const deleteQuote = useCallback((id: string) => {
    setQuotes(s => s.filter(q => q.id !== id))
  }, [])

  return {
    quotes,
    addQuote, updateQuote, deleteQuote,
  }
}

export default useQuoteStore
