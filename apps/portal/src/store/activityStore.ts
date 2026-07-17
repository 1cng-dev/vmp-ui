import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types'

export interface ActivityStoreValue {
  activity: Activity[]
  activityLoading: boolean
  loadActivity: () => Promise<void>
  logActivity: (text: string, kind?: string, actor?: string, meta?: Record<string, unknown>) => Promise<void>
  subscribeToActivity: () => () => void
}

// ── Global Activity Context Store ─────────────────────────────────────────────
const ActivityContext = createContext<ActivityStoreValue | null>(null)

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activity, setActivity] = useState<Activity[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    
    const MIN_LOADING_TIME = 400 // 400ms minimum loading time
    const startTime = Date.now()
    
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
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
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

  const subscribeToActivity = useCallback(() => {
    const channelName = 'activity-log-changes'
    const channel = supabase.channel(channelName)
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        loadActivity()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadActivity])

  // Set up real-time subscription on mount
  useEffect(() => {
    loadActivity()
    const unsubscribe = subscribeToActivity()
    return () => unsubscribe()
  }, [subscribeToActivity])

  const value: ActivityStoreValue = {
    activity,
    activityLoading,
    loadActivity,
    logActivity,
    subscribeToActivity,
  }

  return React.createElement(ActivityContext.Provider, { value }, children as any)
}

export const useActivityStore = (): ActivityStoreValue => {
  const ctx = useContext(ActivityContext)
  if (!ctx) throw new Error('useActivityStore must be used within ActivityProvider')
  return ctx
}

export default useActivityStore