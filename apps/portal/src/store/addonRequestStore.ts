import React, { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { AddonRequest } from '../types'
import useActivityStore from './activityStore'

export interface AddonRequestStoreValue {
  addonRequests: AddonRequest[]
  loadAddonRequests: () => Promise<void>
  createAddonRequest: (request: Omit<AddonRequest, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateAddonRequest: (id: string, patch: Partial<AddonRequest>) => Promise<void>
  deleteAddonRequest: (id: string) => Promise<void>
}

const AddonRequestContext = React.createContext<AddonRequestStoreValue | null>(null)

export const AddonRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with cached data from localStorage if available
  const [addonRequests, setAddonRequests] = useState<AddonRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('addon-requests-cache')
      return cached ? JSON.parse(cached) : []
    }
    return []
  })
  const { logActivity } = useActivityStore()

  // Save to localStorage whenever addonRequests changes
  useEffect(() => {
    if (typeof window !== 'undefined' && addonRequests.length > 0) {
      localStorage.setItem('addon-requests-cache', JSON.stringify(addonRequests))
    }
  }, [addonRequests])

  const loadAddonRequests = useCallback(async () => {
    const { data, error } = await supabase.from('addon_requests').select('*').order('created_at', { ascending: false })
    if (error) throw error
    setAddonRequests((data as AddonRequest[]) || [])
  }, [])

  const subscribeToAddonRequests = useCallback(() => {
    const channelName = `addon-requests-changes-${Date.now()}`
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_requests' }, () => {
        loadAddonRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [loadAddonRequests])

  // Set up realtime subscription on mount
  useEffect(() => {
    const unsubscribe = subscribeToAddonRequests()
    return unsubscribe
  }, [subscribeToAddonRequests])

  const createAddonRequest = useCallback(async (request: Omit<AddonRequest, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => {
    const { error, data } = await supabase.from('addon_requests').insert(request).select()
    if (error) throw error
    await loadAddonRequests()
    
    // Get current user for activity logging
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
    
    return data[0].id
  }, [loadAddonRequests, logActivity])

  const updateAddonRequest = useCallback(async (id: string, patch: Partial<AddonRequest>) => {
    const previousRequest = addonRequests.find(r => r.id === id)
    const { error } = await supabase.from('addon_requests').update(patch).eq('id', id)
    if (error) throw error
    await loadAddonRequests()
    
    // Log status changes
    if (patch.status && previousRequest && patch.status !== previousRequest.status) {
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
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }
      
      await logActivity(
        `Changed addon request status from ${previousRequest.status} to ${patch.status}`,
        'vm',
        actorName,
        { addonRequestId: id, vmId: previousRequest.vm_id, previousStatus: previousRequest.status, newStatus: patch.status }
      )
    }
  }, [loadAddonRequests, addonRequests, logActivity])

  const deleteAddonRequest = useCallback(async (id: string) => {
    const { error } = await supabase.from('addon_requests').delete().eq('id', id)
    if (error) throw error
    await loadAddonRequests()
  }, [loadAddonRequests])

  const value = { addonRequests, loadAddonRequests, createAddonRequest, updateAddonRequest, deleteAddonRequest }
  return React.createElement(AddonRequestContext.Provider, { value }, children as any)
}

export const useAddonRequestStore = (): AddonRequestStoreValue => {
  const ctx = React.useContext(AddonRequestContext)
  if (!ctx) throw new Error('useAddonRequestStore must be used within AddonRequestProvider')
  return ctx
}

export default useAddonRequestStore
