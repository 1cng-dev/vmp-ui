import React, { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { AddonRequest } from '../types'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface AddonRequestStoreValue {
  addonRequests: AddonRequest[]
  addonRequestsLoading: boolean
  loadAddonRequests: () => Promise<void>
  createAddonRequest: (request: Omit<AddonRequest, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateAddonRequest: (id: string, patch: Partial<AddonRequest>) => Promise<void>
  deleteAddonRequest: (id: string) => Promise<void>
}

const AddonRequestContext = React.createContext<AddonRequestStoreValue | null>(null)

export const AddonRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [addonRequests, setAddonRequests] = useState<AddonRequest[]>([])
  const [addonRequestsLoading, setAddonRequestsLoading] = useState(false)
  const { logActivity } = useActivityStore()

  const loadAddonRequests = useCallback(async () => {
    setAddonRequestsLoading(true)
    
    const MIN_LOADING_TIME = 400 // 400ms minimum loading time
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.from('addon_requests').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setAddonRequests((data as AddonRequest[]) || [])
    } finally {
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      setAddonRequestsLoading(false)
    }
  }, [])

  // Set up realtime subscription on mount
  useEffect(() => {
    const channelName = 'addon-requests-changes'
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_requests' }, (payload) => {
        // Handle real-time updates directly without full reload
        if (payload.eventType === 'INSERT') {
          setAddonRequests(prev => [...prev, payload.new as AddonRequest])
        } else if (payload.eventType === 'UPDATE') {
          setAddonRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new as AddonRequest : r))
        } else if (payload.eventType === 'DELETE') {
          setAddonRequests(prev => prev.filter(r => r.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const createAddonRequest = useCallback(async (request: Omit<AddonRequest, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => {
    const { error, data } = await supabase.from('addon_requests').insert(request).select()
    if (error) throw error
    // Real-time subscription will handle data update, no need to call loadAddonRequests
    
    // Get current user for activity logging
    const { data: { user } } = await supabase.auth.getUser()
    let actorName = 'System'
    let actorId = request.customer_id
    if (user) {
      const { data: staff } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', user.id)
        .single()
      if (staff) {
        actorName = `${staff.name} (${staff.staff_code})`
        actorId = user.id
      } else {
        // Fallback to user's name or email if not in team_members
        actorName = user.user_metadata?.name || user.email || 'System'
      }
    }
    
    await logActivity(
      `Created addon request for VM ${request.vm_id}`,
      'vm',
      actorName,
      { addonRequestId: data[0].id, vmId: request.vm_id, customerId: request.customer_id, status: request.status }
    )
    
    // Create alert for team roles (customer_id = NULL so customer doesn't see it)
    const services = []
    if (request.cpfs_enabled) services.push(`CPFS (${request.cpfs_package})`)
    if (request.ccis_enabled) services.push(`CCIS (${request.ccis_package})`)
    
    await createAlert({
      sev: 'info',
      title: 'Add-on Service Request',
      body: `Add-on Service Request for VM ${request.vm_id}: ${services.join(', ')}`,
      type: 'vm',
      related_entity_id: data[0].id,
      related_entity_type: 'addon_request',
      actor_id: actorId,
      actor_name: actorName,
      customer_id: null, // NULL so team roles see it, customer doesn't
      metadata: {
        vm_id: request.vm_id,
        customer_id: request.customer_id,
        cpfs_enabled: request.cpfs_enabled,
        cpfs_package: request.cpfs_package,
        ccis_enabled: request.ccis_enabled,
        ccis_package: request.ccis_package,
        duration: request.duration
      }
    })
    
    return data[0].id
  }, [logActivity])

  const updateAddonRequest = useCallback(async (id: string, patch: Partial<AddonRequest>) => {
    const previousRequest = addonRequests.find(r => r.id === id)
    const { error } = await supabase.from('addon_requests').update(patch).eq('id', id)
    if (error) throw error
    // Real-time subscription will handle data update, no need to call loadAddonRequests
    
    // Log status changes
    if (patch.status && previousRequest && patch.status !== previousRequest.status) {
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      let actorId = previousRequest.customer_id
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .single()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
          actorId = user.id
        } else {
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }
      
      await logActivity(
        `Changed addon request status from ${previousRequest.status} to ${patch.status}`,
        'task',
        actorName,
        { addonRequestId: id, vmId: previousRequest.vm_id, previousStatus: previousRequest.status, newStatus: patch.status }
      )
      
      // Create alert for customer (customer_id set so customer sees it)
      await createAlert({
        sev: 'info',
        title: 'Add-on Request Status Changed',
        body: `Add-on request for VM ${previousRequest.vm_id} status changed from ${previousRequest.status} to ${patch.status}`,
        type: 'vm',
        related_entity_id: id,
        related_entity_type: 'addon_request',
        actor_id: actorId,
        actor_name: actorName,
        customer_id: previousRequest.customer_id,
        metadata: {
          vm_id: previousRequest.vm_id,
          previous_status: previousRequest.status,
          new_status: patch.status,
          customer_id: previousRequest.customer_id
        }
      })
    }
  }, [addonRequests, logActivity])

  const deleteAddonRequest = useCallback(async (id: string) => {
    const { error } = await supabase.from('addon_requests').delete().eq('id', id)
    if (error) throw error
    // Real-time subscription will handle data update, no need to call loadAddonRequests
  }, [])

  const value = { addonRequests, addonRequestsLoading, loadAddonRequests, createAddonRequest, updateAddonRequest, deleteAddonRequest }
  return React.createElement(AddonRequestContext.Provider, { value }, children as any)
}

export const useAddonRequestStore = (): AddonRequestStoreValue => {
  const ctx = React.useContext(AddonRequestContext)
  if (!ctx) throw new Error('useAddonRequestStore must be used within AddonRequestProvider')
  return ctx
}

export default useAddonRequestStore
