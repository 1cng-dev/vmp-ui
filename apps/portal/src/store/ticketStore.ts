import { useState, useCallback } from 'react'
import type { Ticket } from '../types'

export interface TicketStoreValue {
  tickets: Ticket[]
  addTicket: (t: any) => string
  updateTicket: (id: string, patch: any) => void
  setTicketStatus: (id: string, status: string) => void
  replyTicket: (id: string, who: string, body: string) => void
  deleteTicket: (id: string) => void
}

const useTicketStore = (): TicketStoreValue => {
  const [tickets, setTickets] = useState<Ticket[]>([])

  const addTicket = useCallback((t: any) => {
    const year = new Date().getFullYear()
    const id = `TKT-${year}-${String(100 + Math.floor(Math.random() * 900)).padStart(3, '0')}`
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const newT = { id, status: 'Open', priority: 'Normal', assignee: '—', created: now, updated: now, replies: [], ...t }
    setTickets(s => [newT, ...s])
    return id
  }, [])

  const updateTicket = useCallback((id: string, patch: any) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    setTickets(s => s.map(t => t.id === id ? { ...t, ...patch, updated: now } : t))
  }, [])

  const setTicketStatus = useCallback((id: string, status: string) => {
    updateTicket(id, { status })
  }, [updateTicket])

  const replyTicket = useCallback((id: string, who: string, body: string) => {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    setTickets(s => s.map(t => t.id === id
      ? { ...t, updated: now, replies: [...t.replies, { who, when: now, body }] }
      : t))
  }, [])

  const deleteTicket = useCallback((id: string) => {
    setTickets(s => s.filter(t => t.id !== id))
  }, [])

  return {
    tickets,
    addTicket, updateTicket, setTicketStatus, replyTicket, deleteTicket,
  }
}

export default useTicketStore
