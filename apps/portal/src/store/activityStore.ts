import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types'

const fetchActivity = async (): Promise<Activity[]> => {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  
  if (error) throw error
  
  const transformedActivity = (data || []).map((a: any) => ({
    ts: new Date(a.created_at).toLocaleString(),
    actor: a.actor || 'System',
    kind: a.kind || 'system',
    text: a.text,
  }))
  
  return transformedActivity
}

const useActivityStore = () => {
  const queryClient = useQueryClient()

  const { data: activity = [], isLoading: activityLoading, error } = useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    staleTime: 1000 * 30, // 30 seconds since activity changes frequently
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const logActivity = useMutation({
    mutationFn: async ({ text, kind, actor, meta }: { text: string; kind?: string; actor?: string; meta?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('activity_log')
        .insert({
          actor: actor || 'You',
          actor_role: 'staff',
          kind: kind || 'vm',
          text,
          meta: meta || {},
        })
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] })
    },
  })

  return {
    activity,
    activityLoading,
    error,
    logActivity: logActivity.mutateAsync,
  }
}

export default useActivityStore