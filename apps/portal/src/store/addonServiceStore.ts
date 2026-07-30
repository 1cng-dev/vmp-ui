import React, { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface AddonService {
  id: string
  legacy_id?: string
  vm_id: string
  cpfs_enabled: boolean
  cpfs_package?: string
  ccis_enabled: boolean
  ccis_package?: string
  start_date?: string
  end_date?: string
  expiry?: string
  duration?: string
  status: string
  operational_status?: string
  created_at: string
  updated_at: string
}

export interface AddonServiceStoreValue {
  addonServices: AddonService[]
  addonServicesLoading: boolean
  loadAddonServices: () => Promise<void>
  addAddonService: (service: Omit<AddonService, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateAddonService: (id: string, patch: Partial<AddonService>) => Promise<void>
  getAddonServicesForVM: (vmId: string) => AddonService[]
}

const AddonServiceContext = React.createContext<AddonServiceStoreValue | null>(null)

export const AddonServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [addonServices, setAddonServices] = useState<AddonService[]>([])
  const [addonServicesLoading, setAddonServicesLoading] = useState(false)

  const loadAddonServices = useCallback(async () => {
    setAddonServicesLoading(true)
    try {
      const { data, error } = await supabase.from('addon_services').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setAddonServices((data as AddonService[]) || [])
    } catch (err) {
      console.error('Error loading addon services:', err)
    } finally {
      setAddonServicesLoading(false)
    }
  }, [])

  const addAddonService = useCallback(async (service: Omit<AddonService, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => {
    const { error, data } = await supabase.from('addon_services').insert(service).select()
    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Addon service insert returned no data')
    }
    // Real-time subscription will handle data update
    return data[0].id
  }, [])

  const updateAddonService = useCallback(async (id: string, patch: Partial<AddonService>) => {
    const { error } = await supabase.from('addon_services').update(patch).eq('id', id)
    if (error) throw error
    // Real-time subscription will handle data update
  }, [])

  const getAddonServicesForVM = useCallback((vmId: string): AddonService[] => {
    return addonServices.filter(
      (service) =>
        service.vm_id === vmId &&
        service.status === 'Active' &&
        service.operational_status !== 'Terminated'
    )
  }, [addonServices])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('addon-services-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addon_services' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAddonServices(prev => [...prev, payload.new as AddonService])
        } else if (payload.eventType === 'UPDATE') {
          setAddonServices(prev => prev.map(s => s.id === payload.new.id ? payload.new as AddonService : s))
        } else if (payload.eventType === 'DELETE') {
          setAddonServices(prev => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadAddonServices()
  }, [loadAddonServices])

  const value = { addonServices, addonServicesLoading, loadAddonServices, addAddonService, updateAddonService, getAddonServicesForVM }
  return React.createElement(AddonServiceContext.Provider, { value }, children as any)
}

export const useAddonServiceStore = (): AddonServiceStoreValue => {
  const ctx = React.useContext(AddonServiceContext)
  if (!ctx) throw new Error('useAddonServiceStore must be used within AddonServiceProvider')
  return ctx
}

export default useAddonServiceStore