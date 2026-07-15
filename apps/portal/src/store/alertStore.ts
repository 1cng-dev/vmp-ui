import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Alert } from '../types'

const fetchAlerts = async (): Promise<Alert[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error

  // Get alert reads for current user
  let readAlertIds: Set<string> = new Set()
  if (userId) {
    const { data: readData } = await supabase
      .from('alert_reads')
      .select('alert_id')
      .eq('user_id', userId)
    readAlertIds = new Set(readData?.map(r => r.alert_id) || [])
  }
  
  const transformedAlerts = (data || []).map((a: any) => ({
    id: a.id,
    sev: a.sev,
    title: a.title,
    body: a.body,
    ts: new Date(a.created_at).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    read: readAlertIds.has(a.id),
    type: a.type,
    related_entity_id: a.related_entity_id,
    related_entity_type: a.related_entity_type,
    actor_id: a.actor_id,
    actor_name: a.actor_name,
    metadata: a.metadata
  }))
  
  return transformedAlerts
}

export const useAlertStore = () => {
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading: alertsLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    staleTime: 1000 * 30, // 30 seconds since alerts change frequently
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const markAlertRead = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        throw new Error('No user found')
      }

      const { error } = await supabase
        .from('alert_reads')
        .insert({ alert_id: id, user_id: user.id })
      
      if (error && error.code !== '23505') {
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const markAllAlertsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        throw new Error('No user found')
      }

      // Get all unread alerts for current user
      const readAlertIds = new Set(alerts.filter(a => !a.read).map(a => a.id))
      
      if (readAlertIds.size > 0) {
        const inserts = Array.from(readAlertIds).map(alertId => ({
          alert_id: alertId,
          user_id: user.id
        }))
        
        const { error } = await supabase
          .from('alert_reads')
          .insert(inserts)
        
        if (error && error.code !== '23505') {
          throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  return {
    alerts,
    alertsLoading,
    error,
    markAlertRead: markAlertRead.mutateAsync,
    markAllAlertsRead: markAllAlertsRead.mutateAsync,
  }
}

export default useAlertStore