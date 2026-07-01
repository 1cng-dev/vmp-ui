import { useState, useCallback } from 'react'
import type { Quote } from '../types'

export interface QuoteStoreValue {
  quotes: Quote[]
  addQuote: (q: any) => string
  updateQuote: (id: string, patch: any) => void
  deleteQuote: (id: string) => void
}

const useQuoteStore = (): QuoteStoreValue => {
  const [quotes, setQuotes] = useState<Quote[]>([])

  const addQuote = useCallback((q: any) => {
    const year = new Date().getFullYear()
    const id = `Q-${year}-${String(quotes.length + 1).padStart(3, '0')}`
    const validity = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const newQ = {
      id,
      validity,
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
