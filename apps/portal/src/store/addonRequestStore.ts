import React, { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AddonRequest } from '../types'

export interface AddonRequestStoreValue {
  addonRequests: AddonRequest[]
  loadAddonRequests: () => Promise<void>
  createAddonRequest: (request: Omit<AddonRequest, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateAddonRequest: (id: string, patch: Partial<AddonRequest>) => Promise<void>
}

const AddonRequestContext = React.createContext<AddonRequestStoreValue | null>(null)

export const AddonRequestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [addonRequests, setAddonRequests] = useState<AddonRequest[]>([])

  const loadAddonRequests = useCallback(async () => {
    const { data, error } = await supabase.from('addon_requests').select('*').order('created_at', { ascending: false })
    if (error) throw error
    setAddonRequests((data as AddonRequest[]) || [])
  }, [])

  const createAddonRequest = useCallback(async (request) => {
    const { error, data } = await supabase.from('addon_requests').insert(request).select()
    if (error) throw error
    await loadAddonRequests()
    return data[0].id
  }, [loadAddonRequests])

  const updateAddonRequest = useCallback(async (id, patch) => {
    const { error } = await supabase.from('addon_requests').update(patch).eq('id', id)
    if (error) throw error
    await loadAddonRequests()
  }, [loadAddonRequests])

  const value = { addonRequests, loadAddonRequests, createAddonRequest, updateAddonRequest }
  return React.createElement(AddonRequestContext.Provider, { value }, children as any)
}

export const useAddonRequestStore = (): AddonRequestStoreValue => {
  const ctx = React.useContext(AddonRequestContext)
  if (!ctx) throw new Error('useAddonRequestStore must be used within AddonRequestProvider')
  return ctx
}

export default useAddonRequestStore
