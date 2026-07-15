import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Ticket } from '../types'
import { supabase } from '../lib/supabase'

const fetchTickets = async (): Promise<Ticket[]> => {
  const { data, error } = await supabase
    .from('tickets')
    .select('*, ticket_replies(*)')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
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
  
  return transformedTickets
}

export const useTickets = () => {
  const queryClient = useQueryClient()

  const { data: tickets = [], isLoading: ticketsLoading, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    staleTime: 1000 * 60 * 5,
  })

  const addTicket = useMutation({
    mutationFn: async (t: any) => {
      // Generate legacy_id
      const { data: lastTicket } = await supabase
        .from('tickets')
        .select('legacy_id')
        .order('created_at', { ascending: false })
        .limit(1)
      
      const lastLegacyId = lastTicket?.[0]?.legacy_id
      let nextNum = 1001
      if (lastLegacyId) {
        const match = lastLegacyId.match(/TKT-(\d+)/)
        if (match) {
          nextNum = parseInt(match[1]) + 1
        }
      }
      const legacyId = `TKT-${nextNum}`

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          legacy_id: legacyId,
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
      return data.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const updateTicket = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase
        .from('tickets')
        .update(patch)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const setTicketStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const replyTicket = useMutation({
    mutationFn: async ({ id, who, body, attachments }: { id: string; who: string; body: string; attachments?: string[] }) => {
      const dataToInsert: any = {
        ticket_id: id,
        who: who,
        body: body
      }
      
      if (attachments && attachments.length > 0) {
        dataToInsert.attachments = attachments
      }
      
      const { error } = await supabase
        .from('ticket_replies')
        .insert(dataToInsert)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  const deleteTicket = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })

  return {
    tickets,
    ticketsLoading,
    error,
    addTicket: addTicket.mutateAsync,
    updateTicket: updateTicket.mutateAsync,
    setTicketStatus: setTicketStatus.mutateAsync,
    replyTicket: replyTicket.mutateAsync,
    deleteTicket: deleteTicket.mutateAsync,
  }
}

export default useTickets
