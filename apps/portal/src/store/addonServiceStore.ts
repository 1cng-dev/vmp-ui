import React, { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface AddonService {
  id: string
  legacy_id?: string
  vm_id: string
  customer_id?: string
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
  deleteAddonService: (id: string) => Promise<void>
  getAddonServicesForVM: (vmId: string) => AddonService[]
  getAllAddonServicesForVM: (vmId: string) => AddonService[]
}

const AddonServiceContext = React.createContext<AddonServiceStoreValue | null>(null)

export const AddonServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [addonServices, setAddonServices] = useState<AddonService[]>([])
  const [addonServicesLoading, setAddonServicesLoading] = useState(false)
  const { logActivity } = useActivityStore()

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

    // Log activity for addon service creation
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
        actorName = user.user_metadata?.name || user.email || 'System'
      }
    }

    const serviceId = data[0].legacy_id || data[0].id
    const services = []
    if (service.cpfs_enabled) services.push(`CPFS (${service.cpfs_package})`)
    if (service.ccis_enabled) services.push(`CCIS (${service.ccis_package})`)

    await logActivity(
      `Created addon service ${serviceId} for VM ${service.vm_id}: ${services.join(', ')}`,
      'addon',
      actorName,
      { addonServiceId: serviceId, vmId: service.vm_id, customerId: service.customer_id, services }
    )

    // Real-time subscription will handle data update
    return data[0].id
  }, [logActivity])

  const updateAddonService = useCallback(async (id: string, patch: Partial<AddonService>) => {
    const previousService = addonServices.find(s => s.id === id)
    const { error } = await supabase.from('addon_services').update(patch).eq('id', id)
    if (error) throw error

    // Log activity and create alerts when operational_status changes
    if (patch.operational_status && previousService && patch.operational_status !== previousService.operational_status) {
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
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }

      const serviceId = previousService.legacy_id || previousService.id
      if (patch.operational_status === 'Terminated') {
        await logActivity(
          `Terminated addon service ${serviceId}`,
          'addon',
          actorName,
          { addonServiceId: serviceId, vmId: previousService.vm_id, customerId: previousService.customer_id, previousStatus: previousService.operational_status }
        )
        await createAlert({
          sev: 'warn',
          title: 'Add-on Service Terminated',
          body: `Add-on service ${serviceId} has been terminated`,
          type: 'addon',
          related_entity_id: id,
          customer_id: null, // NULL so team roles see it, customer doesn't
          actor_id: user?.id,
          actor_name: actorName,
          related_entity_type: 'addon_service',
          metadata: {
            addonServiceId: serviceId,
            vmId: previousService.vm_id,
            customerId: previousService.customer_id
          }
        })
      } else if (patch.operational_status === 'Active' && previousService.operational_status === 'Terminated') {
        await logActivity(
          `Activated addon service ${serviceId}`,
          'addon',
          actorName,
          { addonServiceId: serviceId, vmId: previousService.vm_id, customerId: previousService.customer_id, previousStatus: previousService.operational_status }
        )
        await createAlert({
          sev: 'info',
          title: 'Add-on Service Activated',
          body: `Add-on service ${serviceId} has been activated`,
          type: 'addon',
          related_entity_id: id,
          customer_id: null, // NULL so team roles see it, customer doesn't
          actor_id: user?.id,
          actor_name: actorName,
          related_entity_type: 'addon_service',
          metadata: {
            addonServiceId: serviceId,
            vmId: previousService.vm_id,
            customerId: previousService.customer_id
          }
        })
      }
    } else if (previousService && Object.keys(patch).some(key => key !== 'operational_status' && patch[key as keyof AddonService] !== previousService[key as keyof AddonService])) {
      // Log activity for other field changes (not operational_status)
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
          actorName = user.user_metadata?.name || user.email || 'System'
        }
      }

      const serviceId = previousService.legacy_id || previousService.id
      await logActivity(
        `Updated addon service ${serviceId}`,
        'addon',
        actorName,
        { addonServiceId: serviceId, vmId: previousService.vm_id, customerId: previousService.customer_id }
      )
    }

    // Real-time subscription will handle data update
  }, [addonServices, logActivity])

  const deleteAddonService = useCallback(async (id: string) => {
    const previousService = addonServices.find(s => s.id === id)
    const { error } = await supabase.from('addon_services').delete().eq('id', id)
    if (error) throw error

    // Log activity for addon service deletion
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
        actorName = user.user_metadata?.name || user.email || 'System'
      }
    }

    if (previousService) {
      const serviceId = previousService.legacy_id || previousService.id
      const services = []
      if (previousService.cpfs_enabled) services.push(`CPFS (${previousService.cpfs_package})`)
      if (previousService.ccis_enabled) services.push(`CCIS (${previousService.ccis_package})`)

      await logActivity(
        `Deleted addon service ${serviceId} for VM ${previousService.vm_id}: ${services.join(', ')}`,
        'addon',
        actorName,
        { addonServiceId: serviceId, vmId: previousService.vm_id, customerId: previousService.customer_id, services }
      )
    }

    // Real-time subscription will handle data update
  }, [addonServices, logActivity])

  const getAddonServicesForVM = useCallback((vmId: string): AddonService[] => {
    return addonServices.filter(
      (service) =>
        service.vm_id === vmId &&
        service.status === 'Active' &&
        service.operational_status !== 'Terminated'
    )
  }, [addonServices])

  const getAllAddonServicesForVM = useCallback((vmId: string): AddonService[] => {
    return addonServices.filter(
      (service) =>
        service.vm_id === vmId &&
        service.status === 'Active'
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

  const value = { addonServices, addonServicesLoading, loadAddonServices, addAddonService, updateAddonService, deleteAddonService, getAddonServicesForVM, getAllAddonServicesForVM }
  return React.createElement(AddonServiceContext.Provider, { value }, children as any)
}

export const useAddonServiceStore = (): AddonServiceStoreValue => {
  const ctx = React.useContext(AddonServiceContext)
  if (!ctx) throw new Error('useAddonServiceStore must be used within AddonServiceProvider')
  return ctx
}

export default useAddonServiceStore