import React, { useState, useCallback, createContext, useContext, type ReactNode, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'

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
  backup_enabled: boolean
  backup_type: string
  notes: string
  task_type: 'New' | 'Upgrade' | 'Renewal' | 'Terminate' | 'change-plan'
  status: string
  created_at: string
  updated_at: string
  legacy_id: string
  assigned_to: string | null
  spec_changed?: boolean
  backup_changed?: boolean
}

export interface VMRequestStoreValue {
  vmRequests: VMRequest[]
  vmRequestsLoading: boolean
  loadVMRequests: () => Promise<void>
  addVMRequest: (request: any) => Promise<void>
  updateVMRequest: (id: string, patch: any) => Promise<void>
  deleteVMRequest: (id: string) => Promise<void>
}

// ── Global VM Request Context Store ─────────────────────────────────────────────
const VMRequestContext = createContext<VMRequestStoreValue | null>(null)

export const VMRequestProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vmRequests, setVmRequests] = useState<VMRequest[]>([])
  const [vmRequestsLoading, setVmRequestsLoading] = useState(false)
  const { logActivity } = useActivityStore()


  const loadVMRequests = useCallback(async () => {
    setVmRequestsLoading(true)
    
    const MIN_LOADING_TIME = 400 // 400ms minimum loading time
    const startTime = Date.now()
    
    try {
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
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      setVmRequestsLoading(false)
    }
  }, [])

  // Set up realtime subscription on mount
  useEffect(() => {
    const channelName = 'vm-requests-changes'
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vm_requests' }, () => {
        loadVMRequests()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadVMRequests])

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
      
      // Get current user (staff member) who created the request
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
          actorId = user.id
        }
      }
      
      // Create notification and activity log for new VM request
      await logActivity(
        `Created ${request.request_type} VM request for ${request.hostname} (${request.vcpu} vCPU, ${request.ram_gb}GB RAM)`,
        'task',
        actorName,
        { vmRequestId: data[0].id, hostname: request.hostname, requestType: request.request_type, vcpu: request.vcpu, ramGb: request.ram_gb, customerId: request.customer_id, taskType: request.task_type }
      )
      
      // Create alert for team roles (customer_id = NULL so customer doesn't see it)
      // Include task_type in title for change-plan and renewal requests
      const title = request.task_type === 'change-plan' 
        ? 'Change Plan Request'
        : request.task_type === 'Renewal' || request.task_type === 'renewal'
        ? 'Renewal Request'
        : 'New VM Request'
      
      await createAlert({
        sev: 'info',
        title: title,
        body: `${title} for ${request.hostname} (${request.vcpu} vCPU, ${request.ram_gb}GB RAM)`,
        type: 'vm',
        related_entity_id: data[0].id,
        related_entity_type: 'vm_request',
        actor_id: actorId,
        actor_name: actorName,
        customer_id: null, // NULL so team roles see it, customer doesn't
        metadata: {
          hostname: request.hostname,
          request_type: request.request_type,
          vcpu: request.vcpu,
          ram_gb: request.ram_gb,
          customer_id: request.customer_id,
          task_type: request.task_type
        }
      })
    }
  }, [loadVMRequests, logActivity])

  const updateVMRequest = useCallback(async (id: string, patch: any) => {
    const previousRequest = vmRequests.find(r => r.id === id)
    const { error } = await supabase
      .from('vm_requests')
      .update(patch)
      .eq('id', id)

    if (!error) {
      await loadVMRequests()
      
      // Create notification for status change
      if (patch.status && previousRequest && patch.status !== previousRequest.status) {
        // Get current user (staff member) who made the change
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
          }
        }
        
        await logActivity(
          `Changed VM request ${previousRequest.hostname} status from ${previousRequest.status} to ${patch.status}`,
          'task',
          actorName,
          { vmRequestId: id, hostname: previousRequest.hostname, previousStatus: previousRequest.status, newStatus: patch.status, customerId: previousRequest.customer_id }
        )
        
        await createAlert({
          sev: 'info',
          title: 'VM Request Status Changed',
          body: `VM request for ${previousRequest.hostname} status changed from ${previousRequest.status} to ${patch.status}`,
          type: 'vm',
          related_entity_id: id,
          related_entity_type: 'vm_request',
          actor_id: actorId,
          actor_name: actorName,
          customer_id: previousRequest.customer_id,
          metadata: {
            hostname: previousRequest.hostname,
            previous_status: previousRequest.status,
            new_status: patch.status,
            customer_id: previousRequest.customer_id
          }
        })
      }
    } else {
      console.error('Error updating vm_request:', error)
      throw error
    }
  }, [loadVMRequests, vmRequests, logActivity])

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
  }

  return React.createElement(VMRequestContext.Provider, { value }, children as any)
}

export const useVMRequestStore = (): VMRequestStoreValue => {
  const ctx = useContext(VMRequestContext)
  if (!ctx) throw new Error('useVMRequestStore must be used within VMRequestProvider')
  return ctx
}

export default useVMRequestStore
