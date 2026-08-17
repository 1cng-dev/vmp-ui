import React, { useState, useCallback, createContext, useContext, type ReactNode, useEffect } from 'react'
import type { Ticket } from '../types'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'

export interface TicketStoreValue {
  tickets: Ticket[]
  ticketsLoading: boolean
  loadTickets: () => Promise<void>
  addTicket: (t: any) => Promise<string>
  updateTicket: (id: string, patch: any) => Promise<void>
  setTicketStatus: (id: string, status: string) => Promise<void>
  replyTicket: (id: string, who: string, body: string, attachments?: string[]) => Promise<void>
  deleteTicket: (id: string) => Promise<void>
  subscribeToTickets: () => () => void
}

// ── Global Ticket Context Store ─────────────────────────────────────────────
const TicketContext = createContext<TicketStoreValue | null>(null)

export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const { logActivity } = useActivityStore()

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true)
    
    const MIN_LOADING_TIME = 400 // 400ms minimum loading time
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, ticket_replies(*)')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching tickets:', error)
      } else {
        // Transform data to match Ticket interface
        const transformedTickets = data?.map((t: any) => ({
          id: t.id,
          legacy_id: t.legacy_id,
          customer_id: t.customer_id,
          customer: '', // Will be populated by joining with customers
          category: t.category,
          subject: t.subject,
          body: t.body,
          priority: t.priority,
          status: t.status,
          created_at: t.created_at,
          updated_at: t.updated_at,
          assignee: t.assignee || '—',
          attachments: t.attachments || [],
          replies: t.ticket_replies?.map((r: any) => ({
            id: r.id,
            who: r.who,
            when: r.created_at,
            body: r.body,
            attachments: r.attachments || []
          })) || []
        })) || []
        
        setTickets(transformedTickets)
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      setTicketsLoading(false)
    }
  }, [])

  const subscribeToTickets = useCallback(() => {
    const channelName = 'tickets-changes'
    const channel = supabase.channel(channelName)
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadTickets()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_replies' }, () => {
        loadTickets()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTickets])

  // Set up realtime subscription on mount
  useEffect(() => {
    const unsubscribe = subscribeToTickets()
    loadTickets() // Initial load
    return unsubscribe
  }, [subscribeToTickets])

  const addTicket = useCallback(async (t: any) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert({
          customer_id: t.customer_id,
          category: t.category || null,
          subject: t.subject,
          body: t.body,
          priority: t.priority || 'Normal',
          status: 'Open',
          assignee: '—',
          attachments: t.attachments || []
        })
        .select()
        .single()

      if (error) throw error

      // Query again to get the legacy_id (trigger-generated)
      const { data: ticketWithLegacy } = await supabase
        .from('tickets')
        .select('legacy_id')
        .eq('id', data.id)
        .single()

      if (ticketWithLegacy?.legacy_id) {
        (data as any).legacy_id = ticketWithLegacy.legacy_id
      }

      // Log activity for ticket creation
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
        } else {
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }

      const ticketId = data.legacy_id || data.id
      await logActivity(
        `Created support ticket ${ticketId}: ${t.subject}`,
        'ticket',
        actorName,
        { ticketId, customerId: t.customer_id, category: t.category, priority: t.priority }
      )

      return data.id
    } catch (error) {
      console.error('Error adding ticket:', error)
      throw error
    }
  }, [logActivity])

  const updateTicket = useCallback(async (id: string, patch: any) => {
    try {
      const previousTicket = tickets.find(t => t.id === id)
      const { error } = await supabase
        .from('tickets')
        .update(patch)
        .eq('id', id)

      if (error) throw error

      // Log activity for status changes
      if (patch.status && previousTicket && patch.status !== previousTicket.status) {
        const { data: { user } } = await supabase.auth.getUser()
        let actorName = 'System'
        if (user) {
          const { data: staff } = await supabase
            .from('team_members')
            .select('name, staff_code')
            .eq('user_id', user.id)
            .single()
          if (staff) {
            actorName = `${staff.name} (${staff.staff_code})`
          } else {
            actorName = user.user_metadata?.name || user.email || 'System'
          }
        }

        const ticketId = previousTicket.legacy_id || previousTicket.id
        await logActivity(
          `Changed ticket ${ticketId} status from ${previousTicket.status} to ${patch.status}`,
          'ticket',
          actorName,
          { ticketId, previousStatus: previousTicket.status, newStatus: patch.status, customerId: previousTicket.customer_id }
        )
      }
    } catch (error) {
      console.error('Error updating ticket:', error)
      throw error
    }
  }, [tickets, logActivity])

  const setTicketStatus = useCallback(async (id: string, status: string) => {
    await updateTicket(id, { status })
  }, [updateTicket])

  const replyTicket = useCallback(async (id: string, who: string, body: string, attachments: string[] = []) => {
    try {
      const ticket = tickets.find(t => t.id === id)
      const dataToInsert: any = {
        ticket_id: id,
        who: who,
        body: body
      }

      // Only include attachments if it has items
      if (attachments && attachments.length > 0) {
        dataToInsert.attachments = attachments
      }

      const { error } = await supabase
        .from('ticket_replies')
        .insert(dataToInsert)

      if (error) throw error

      // Log activity for ticket reply
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
        } else {
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }

      if (ticket) {
        const ticketId = ticket.legacy_id || ticket.id
        await logActivity(
          `Replied to ticket ${ticketId}`,
          'ticket',
          actorName,
          { ticketId, customerId: ticket.customer_id, replyBy: who }
        )
      }

      // Reload tickets to get the new reply
      await loadTickets()
    } catch (error) {
      console.error('Error replying to ticket:', error)
      throw error
    }
  }, [tickets, loadTickets, logActivity])

  const deleteTicket = useCallback(async (id: string) => {
    try {
      const ticket = tickets.find(t => t.id === id)

      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Log activity for ticket deletion
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
        } else {
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }

      if (ticket) {
        const ticketId = ticket.legacy_id || ticket.id
        await logActivity(
          `Deleted support ticket ${ticketId}: ${ticket.subject}`,
          'ticket',
          actorName,
          { ticketId, customerId: ticket.customer_id, category: ticket.category }
        )
      }

      // Reload tickets after deletion to update UI
      await loadTickets()
    } catch (error) {
      console.error('Error deleting ticket:', error)
      throw error
    }
  }, [tickets, loadTickets, logActivity])

  const value: TicketStoreValue = {
    tickets,
    ticketsLoading,
    loadTickets,
    addTicket,
    updateTicket,
    setTicketStatus,
    replyTicket,
    deleteTicket,
    subscribeToTickets,
  }

  return React.createElement(TicketContext.Provider, { value }, children as any)
}

export const useTicketStore = (): TicketStoreValue => {
  const ctx = useContext(TicketContext)
  if (!ctx) throw new Error('useTicketStore must be used within TicketProvider')
  return ctx
}

export default useTicketStore
