import React, { useState, useCallback, createContext, useContext, type ReactNode, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface VMRequest {
  id: string
  customer_id: string
  request_type: 'trial' | 'paid'
  hostname: string
  purpose: string
  vcpu: number
  ram_gb: number
  storage: number
  qty: number
  duration: number | null
  billing_term: 'Monthly' | 'Annual' | null
  sizing: string
  storage_partitions: string
  os_name: string
  os_version: string
  custom_os_name: string | null
  custom_os_version: string | null
  zone: string
  nics: any[]
  public_ip_required: boolean
  firewall_ports: string[]
  port_forwarding: any[]
  backup_enabled: boolean
  backup_type: string
  monitoring: boolean
  notes: string
  task_type: 'New' | 'Upgrade' | 'Renewal' | 'Terminate'
  status: string
  created_at: string
  updated_at: string
  legacy_id: string
  assigned_to: string | null
}

export interface VMRequestStoreValue {
  vmRequests: VMRequest[]
  vmRequestsLoading: boolean
  loadVMRequests: () => Promise<void>
  addVMRequest: (request: any) => Promise<void>
  updateVMRequest: (id: string, patch: any) => Promise<void>
  deleteVMRequest: (id: string) => Promise<void>
  subscribeToVMRequests: () => () => void
}

// ── Global VM Request Context Store ─────────────────────────────────────────────
const VMRequestContext = createContext<VMRequestStoreValue | null>(null)

export const VMRequestProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vmRequests, setVmRequests] = useState<VMRequest[]>([])
  const [vmRequestsLoading, setVmRequestsLoading] = useState(false)

  const loadVMRequests = useCallback(async () => {
    const shouldShowSpinner = vmRequests.length === 0
    try {
      if (shouldShowSpinner) setVmRequestsLoading(true)
      const { data, error } = await supabase
        .from('vm_requests')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching vm_requests:', error)
      } else {
        setVmRequests(data || [])
      }
    } finally {
      if (shouldShowSpinner) setVmRequestsLoading(false)
    }
  }, [vmRequests.length])

  const subscribeToVMRequests = useCallback(() => {
    const channelName = `vm-requests-changes-${Date.now()}`
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vm_requests' }, () => {
        loadVMRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [loadVMRequests])

  // Set up realtime subscription on mount
  useEffect(() => {
    const unsubscribe = subscribeToVMRequests()
    return unsubscribe
  }, [subscribeToVMRequests])

  const addVMRequest = useCallback(async (request: any) => {
    const { data, error } = await supabase
      .from('vm_requests')
      .insert(request)
      .select()
    
    if (error) {
      console.error('Error adding vm_request:', error)
      throw error
    } else if (data) {
      await loadVMRequests()
    }
  }, [loadVMRequests])

  const updateVMRequest = useCallback(async (id: string, patch: any) => {
    const { error } = await supabase
      .from('vm_requests')
      .update(patch)
      .eq('id', id)

    if (!error) {
      await loadVMRequests()
    } else {
      console.error('Error updating vm_request:', error)
      throw error
    }
  }, [loadVMRequests])

  const deleteVMRequest = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('vm_requests')
      .delete()
      .eq('id', id)

    if (!error) {
      await loadVMRequests()
    } else {
      console.error('Error deleting vm_request:', error)
      throw error
    }
  }, [loadVMRequests])

  const value: VMRequestStoreValue = {
    vmRequests,
    vmRequestsLoading,
    loadVMRequests,
    addVMRequest,
    updateVMRequest,
    deleteVMRequest,
    subscribeToVMRequests,
  }

  return React.createElement(VMRequestContext.Provider, { value }, children as any)
}

export const useVMRequestStore = (): VMRequestStoreValue => {
  const ctx = useContext(VMRequestContext)
  if (!ctx) throw new Error('useVMRequestStore must be used within VMRequestProvider')
  return ctx
}

export default useVMRequestStore
