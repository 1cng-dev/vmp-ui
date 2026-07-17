import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Alert } from '../types'

export interface AlertStoreValue {
  alerts: Alert[]
  alertsLoading: boolean
  loadAlerts: () => Promise<void>
  markAlertRead: (id: string) => Promise<void>
  markAllAlertsRead: () => Promise<void>
}

// ── Global Alert Context Store ─────────────────────────────────────────────
const AlertContext = createContext<AlertStoreValue | null>(null)

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      // Don't try to load alerts if userId is not available yet or invalid
      if (!userId || typeof userId !== 'string' || userId.length < 10 || userId === 'undefined' || userId === 'null') {
        setAlertsLoading(false)
        return
      }

      // Get user's role and customer_id
      let customerId: string | null = null
      let isCustomer = false

      try {
        const { data: userData } = await supabase
          .from('customers')
          .select('id')
          .eq('id', userId)
          .single()

        customerId = userData?.id || null
        isCustomer = !!customerId
      } catch (customerError) {
        // If user can't query customers table, they're not a customer (they're a team member)
        isCustomer = false
        customerId = null
      }

      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Filter by customer_id for customer role
      if (isCustomer && customerId) {
        query = query.eq('customer_id', customerId)
      }
      
      const { data, error } = await query
      
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
        customer_id: a.customer_id,
        metadata: a.metadata
      }))
      
      setAlerts(transformedAlerts)
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  const markAlertRead = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        console.error('No user found')
        return
      }

      // Insert into alert_reads table for current user
      const { error } = await supabase
        .from('alert_reads')
        .insert({ alert_id: id, user_id: user.id })
      
      if (error) {
        // Ignore duplicate key errors (already read)
        if (error.code !== '23505') {
          throw error
        }
      }
      
      setAlerts(s => s.map(a => a.id === id ? { ...a, read: true } : a))
    } catch (error) {
      console.error('Error marking alert as read:', error)
    }
  }, [])

  const markAllAlertsRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        console.error('No user found')
        return
      }

      // Get all unread alerts for current user
      const readAlertIds = new Set(alerts.filter(a => !a.read).map(a => a.id))
      
      // Insert all unread alerts into alert_reads for current user
      if (readAlertIds.size > 0) {
        const inserts = Array.from(readAlertIds).map(alertId => ({
          alert_id: alertId,
          user_id: user.id
        }))
        
        const { error } = await supabase
          .from('alert_reads')
          .insert(inserts)
        
        if (error) {
          // Ignore duplicate key errors (already read)
          if (error.code !== '23505') {
            throw error
          }
        }
      }
      
      setAlerts(s => s.map(a => ({ ...a, read: true })))
    } catch (error) {
      console.error('Error marking all alerts as read:', error)
    }
  }, [alerts])

  const subscribeToAlerts = useCallback(() => {
    const channelName = `alerts-changes-${Date.now()}`
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, async () => {
        // Fetch alerts without loading state to avoid showing full-page spinner on real-time updates
        try {
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id

          if (!userId || typeof userId !== 'string' || userId.length < 10 || userId === 'undefined' || userId === 'null') {
            return
          }

          // Get user's role and customer_id
          let customerId: string | null = null
          let isCustomer = false

          try {
            const { data: userData } = await supabase
              .from('customers')
              .select('id')
              .eq('id', userId)
              .single()

            customerId = userData?.id || null
            isCustomer = !!customerId
          } catch (customerError) {
            isCustomer = false
            customerId = null
          }

          let query = supabase
            .from('alerts')
            .select('*')
            .order('created_at', { ascending: false })

          if (isCustomer && customerId) {
            query = query.eq('customer_id', customerId)
          }

          const { data, error } = await query

          if (error) throw error

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
            customer_id: a.customer_id,
            metadata: a.metadata
          }))

          setAlerts(transformedAlerts)
        } catch (error) {
          console.error('Error loading alerts in subscription:', error)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_reads' }, async () => {
        // Fetch alerts without loading state to avoid showing full-page spinner on real-time updates
        try {
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id

          if (!userId || typeof userId !== 'string' || userId.length < 10 || userId === 'undefined' || userId === 'null') {
            return
          }

          // Get user's role and customer_id
          let customerId: string | null = null
          let isCustomer = false

          try {
            const { data: userData } = await supabase
              .from('customers')
              .select('id')
              .eq('id', userId)
              .single()

            customerId = userData?.id || null
            isCustomer = !!customerId
          } catch (customerError) {
            isCustomer = false
            customerId = null
          }

          let query = supabase
            .from('alerts')
            .select('*')
            .order('created_at', { ascending: false })

          if (isCustomer && customerId) {
            query = query.eq('customer_id', customerId)
          }

          const { data, error } = await query

          if (error) throw error

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
            customer_id: a.customer_id,
            metadata: a.metadata
          }))

          setAlerts(transformedAlerts)
        } catch (error) {
          console.error('Error loading alerts in subscription:', error)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToAlerts()
    loadAlerts() // Initial load
    return unsubscribe
  }, [subscribeToAlerts, loadAlerts])

  const value: AlertStoreValue = {
    alerts,
    alertsLoading,
    loadAlerts,
    markAlertRead,
    markAllAlertsRead,
  }

  return React.createElement(AlertContext.Provider, { value }, children as any)
}

export const useAlertStore = (): AlertStoreValue => {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlertStore must be used within AlertProvider')
  return ctx
}

export default useAlertStore