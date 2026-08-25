import React, { useState, useCallback, createContext, useContext, type ReactNode, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { createAlert } from '../services/notificationService'
import { sendProvisioningCompletedEmail } from '../services/emailService'
import useActivityStore from './activityStore'

export interface VMRequest {
  id: string
  customer_id: string
  request_type: 'trial' | 'paid'
  hostname: string
  purpose?: string
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
  firewall_outbound_allow_all: boolean
  firewall_outbound_custom_ports: string[]
  backup_enabled: boolean
  backup_type: string
  notes?: string
  task_type: 'New' | 'Upgrade' | 'Renewal' | 'Terminate' | 'change-plan'
  status: string
  created_at: string
  updated_at: string
  legacy_id: string
  assigned_to: string | null
  spec_changed?: boolean
  backup_changed?: boolean
  vm_id?: string
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
          .maybeSingle()
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
            .maybeSingle()
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

        // Send email only for Completed status, dashboard notification for other statuses
        if (patch.status === 'Completed') {
          // Get customer email
          const { data: customer } = await supabase
            .from('customers')
            .select('email, name')
            .eq('id', previousRequest.customer_id)
            .single()

          if (customer) {
            // Check if this is a trial to paid conversion
            const isTrialToPaid = previousRequest.purpose?.includes('Convert trial to paid') || 
                                 previousRequest.notes?.includes('Trial to paid conversion')

            let requestType: string
            if (isTrialToPaid) {
              requestType = 'Trial to Paid Conversion'
            } else {
              requestType = previousRequest.task_type === 'change-plan' ? 'Change Plan' :
                            previousRequest.task_type === 'Renewal' ? 'Renewal' :
                            previousRequest.task_type === 'Upgrade' ? 'Upgrade' : 'New VM'
            }

            // Get VM data for all request types
            let vmLegacyId: string | undefined
            let vmPublicIp: string | undefined
            if (isTrialToPaid && previousRequest.notes) {
              // Extract VM legacy_id from notes for trial to paid conversion
              const match = previousRequest.notes.match(/VM:\s*([A-Z0-9-]+)/)
              vmLegacyId = match ? match[1] : undefined
            }
            if (previousRequest.vm_id) {
              const { data: vm } = await supabase
                .from('vms')
                .select('legacy_id, public_ip')
                .eq('id', previousRequest.vm_id)
                .maybeSingle()
              if (vm) {
                if (vm.legacy_id) vmLegacyId = vm.legacy_id
                vmPublicIp = vm.public_ip || undefined
              }
            } else {
              // New VMs may not have vm_id on the request yet; look up by vm_request_id
              const { data: vm } = await supabase
                .from('vms')
                .select('legacy_id, public_ip')
                .eq('vm_request_id', id)
                .limit(1)
                .maybeSingle()
              if (vm) {
                if (vm.legacy_id) vmLegacyId = vm.legacy_id
                vmPublicIp = vm.public_ip || undefined
              }
            }

            try {
              await sendProvisioningCompletedEmail({
                to: customer.email,
                customerName: customer.name,
                requestType: requestType,
                hostname: previousRequest.hostname,
                requestId: previousRequest.legacy_id,
                completionDate: new Date().toISOString(),
                vmLegacyId: vmLegacyId,
                vmName: previousRequest.hostname,
                serviceId: vmLegacyId,
                ipAddress: vmPublicIp
              })
            } catch (emailError) {
              console.error('Failed to send provisioning completion email:', emailError)
              // Don't throw error - email failure shouldn't block the status update
            }
          }

          // Also create dashboard notification for Completed status
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
        } else {
          // For non-Completed statuses, only send dashboard notification
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
      }
    } else {
      console.error('Error updating vm_request:', error)
      throw error
    }
  }, [loadVMRequests, vmRequests, logActivity])

  const deleteVMRequest = useCallback(async (id: string) => {
    const previousRequest = vmRequests.find(r => r.id === id)
    const { error } = await supabase
      .from('vm_requests')
      .delete()
      .eq('id', id)

    if (!error) {
      // Log activity for VM request deletion
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

      if (previousRequest) {
        const requestId = previousRequest.legacy_id || previousRequest.id
        await logActivity(
          `Deleted VM request ${requestId} for ${previousRequest.hostname} (${previousRequest.vcpu} vCPU, ${previousRequest.ram_gb}GB RAM)`,
          'task',
          actorName,
          { vmRequestId: requestId, hostname: previousRequest.hostname, requestType: previousRequest.request_type, vcpu: previousRequest.vcpu, ramGb: previousRequest.ram_gb, customerId: previousRequest.customer_id }
        )
      }

      await loadVMRequests()
    } else {
      console.error('Error deleting vm_request:', error)
      throw error
    }
  }, [loadVMRequests, vmRequests, logActivity])

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
