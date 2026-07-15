import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types'

export interface ActivityStoreValue {
  activity: Activity[]
  activityLoading: boolean
  loadActivity: () => Promise<void>
  logActivity: (text: string, kind?: string, actor?: string, meta?: Record<string, unknown>) => Promise<void>
}

const useActivityStore = (): ActivityStoreValue => {
  const [activity, setActivity] = useState<Activity[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
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
      
      setActivity(transformedActivity)
    } catch (error) {
      console.error('Error loading activity:', error)
    } finally {
      setActivityLoading(false)
    }
  }, [])

  const logActivity = useCallback(async (text: string, kind = 'vm', actor = 'You', meta?: Record<string, unknown>) => {
    try {
      const { error } = await supabase
        .from('activity_log')
        .insert({
          actor,
          actor_role: 'staff',
          kind,
          text,
          meta: meta || {},
        })
      
      if (error) throw error
      
      // Refresh to get the latest activity
      await loadActivity()
    } catch (error) {
      console.error('Error logging activity:', error)
    }
  }, [loadActivity])

  useEffect(() => {
    loadActivity()

    // Poll for new activity every 30 seconds
    const interval = setInterval(() => {
      loadActivity()
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [loadActivity])

  return {
    activity,
    activityLoading,
    loadActivity,
    logActivity,
  }
}

export default useActivityStore