import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { NewVMInput } from '../types'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'

// Use the VM interface that matches the vms table (line 215 in types/index.ts)
export interface VM {
  id: string
  hostname: string
  public_ip?: string
  private_ip?: string
  username?: string
  password?: string
  vcpu: number
  ram_gb: number
  storage_gb: number
  status: 'Active' | 'Suspended' | 'Terminated'
  power_state: 'Running' | 'Stopped' | 'Paused'
  customer_id?: string
  vm_request_id?: string
  task_type?: 'new' | 'change-plan' | 'renewal' | 'addon'
  expiry?: string
  duration?: number
  legacy_id?: string
  assigned_vmid?: number
  created_at: string
  updated_at: string
  start_date?: string | null
  end_date?: string | null
  backup_enabled?: boolean
  backup_type?: string
}

export interface VMStoreValue {
  vms: VM[]
  vmsLoading: boolean
  loadVMs: () => Promise<void>
  addVM: (vm: NewVMInput) => Promise<string>
  updateVM: (id: string, patch: Partial<VM>) => Promise<void>
  deleteVM: (id: string) => Promise<void>
  startVM: (id: string) => Promise<void>
  stopVM: (id: string) => Promise<void>
  restartVM: (id: string) => Promise<void>
  snapshotVM: (id: string, name: string) => Promise<void>
  updateVMTags: (id: string, tags: string[]) => Promise<void>
  updateVMNotes: (id: string, notes: string) => Promise<void>
}

const VMContext = createContext<VMStoreValue | null>(null)

export const VMProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with cached data from localStorage if available
  const [vms, setVms] = useState<VM[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('vms-cache')
      return cached ? JSON.parse(cached) : []
    }
    return []
  })
  const [vmsLoading, setVmsLoading] = useState(false)
  const { logActivity } = useActivityStore()

  // Save to localStorage whenever vms changes
  useEffect(() => {
    if (typeof window !== 'undefined' && vms.length > 0) {
      localStorage.setItem('vms-cache', JSON.stringify(vms))
    }
  }, [vms])

  const loadVMs = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('vms').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setVms((data as VM[]) || [])
    } finally {
      setVmsLoading(false)
    }
  }, [])

  // Real-time subscription for VM changes
  useEffect(() => {
    const channel = supabase
      .channel(`vms-changes-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'vms'
        },
        () => {
          // Reload VMs when any change occurs
          loadVMs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadVMs])

  // Initial load
  useEffect(() => {
    loadVMs()
  }, [loadVMs])

  const addVM = useCallback(async (vm: NewVMInput) => {
    const id = crypto.randomUUID()
    const newVM: VM = {
      id,
      hostname: vm.hostname,
      public_ip: vm.public_ip,
      private_ip: vm.private_ip,
      username: vm.username,
      password: vm.password,
      vcpu: vm.vcpu || 2,
      ram_gb: vm.ram_gb || 8,
      storage_gb: vm.storage_gb || 100,
      status: (vm.status as any) || 'Active',
      power_state: (vm.power_state as any) || 'Running',
      customer_id: vm.customer_id,
      vm_request_id: vm.vm_request_id,
      task_type: vm.task_type as any,
      expiry: vm.expiry,
      duration: vm.duration,
      legacy_id: vm.legacy_id,
      assigned_vmid: (vm as any).assigned_vmid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      start_date: null,
      end_date: null,
      backup_enabled: (vm as any).backup_enabled || false,
      backup_type: (vm as any).backup_type || 'weekly',
    }

    // Persist to Supabase
    const { error, data } = await supabase.from('vms').insert(newVM).select()
    if (error) {
      throw error
    }
    setVms(s => [newVM, ...s])
    
    // Get current user (staff member) who created the VM
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
      `Created VM: ${newVM.hostname}`,
      'vm',
      actorName,
      { vmId: newVM.legacy_id || newVM.id, hostname: newVM.hostname, customerId: newVM.customer_id }
    )
    return id
  }, [])

  const updateVM = useCallback(async (id: string, patch: Partial<VM>) => {
    const previousVM = vms.find(v => v.id === id)
    const { error } = await supabase.from('vms').update(patch).eq('id', id)
    if (error) throw error
    await loadVMs()
    
    // Get current user (staff member) who made the change
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
    
    // Create notification and activity log for status change
    if (patch.status && previousVM && patch.status !== previousVM.status) {
      await logActivity(
        `Changed VM ${previousVM.hostname} status from ${previousVM.status} to ${patch.status}`,
        'vm',
        actorName,
        { vmId: previousVM.legacy_id || previousVM.id, hostname: previousVM.hostname, previousStatus: previousVM.status, newStatus: patch.status }
      )
      
      let actorId = previousVM.customer_id
      if (user) actorId = user.id
      
      await createAlert({
        sev: 'info',
        title: 'VM Status Changed',
        body: `VM ${previousVM.hostname} (${previousVM.legacy_id || previousVM.id}) status changed from ${previousVM.status} to ${patch.status}`,
        type: 'vm',
        related_entity_id: id,
        related_entity_type: 'vm',
        actor_id: actorId,
        actor_name: actorName,
        metadata: {
          vm_id: previousVM.legacy_id || previousVM.id,
          hostname: previousVM.hostname,
          previous_status: previousVM.status,
          new_status: patch.status,
          customer_id: previousVM.customer_id
        }
      })
    }
  }, [loadVMs, vms, logActivity])

  const startVM = useCallback(async (id: string) => {
    const vm = vms.find(v => v.id === id)
    const previousPowerState = vm?.power_state || 'Unknown'
    
    const { error } = await supabase.from('vms').update({ power_state: 'Running' }).eq('id', id)
    if (error) throw error
    await loadVMs()

    // Log activity
    if (vm) {
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
      
      await logActivity(
        `Started VM ${vm.hostname} (power state changed from ${previousPowerState} to Running)`,
        'vm',
        actorName,
        { vmId: vm.legacy_id || vm.id, hostname: vm.hostname, previousPowerState, newPowerState: 'Running' }
      )
    }
  }, [loadVMs, vms, logActivity])

  const stopVM = useCallback(async (id: string) => {
    const vm = vms.find(v => v.id === id)
    const previousPowerState = vm?.power_state || 'Unknown'
    
    const { error } = await supabase.from('vms').update({ power_state: 'Stopped' }).eq('id', id)
    if (error) throw error
    await loadVMs()

    // Log activity
    if (vm) {
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
      
      await logActivity(
        `Stopped VM ${vm.hostname} (power state changed from ${previousPowerState} to Stopped)`,
        'vm',
        actorName,
        { vmId: vm.legacy_id || vm.id, hostname: vm.hostname, previousPowerState, newPowerState: 'Stopped' }
      )
    }
  }, [loadVMs, vms, logActivity])

  const restartVM = useCallback(async (id: string) => {
    const vm = vms.find(v => v.id === id)
    
    // In the future, this will call Proxmox API to restart the VM
    // For now, we'll just update the power state
    await stopVM(id)
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate restart delay
    await startVM(id)

    // Log restart activity separately
    if (vm) {
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
      
      await logActivity(
        `Restarted VM ${vm.hostname}`,
        'vm',
        actorName,
        { vmId: vm.legacy_id || vm.id, hostname: vm.hostname }
      )
    }
  }, [startVM, stopVM, vms, logActivity])

  const snapshotVM = useCallback(async (id: string, name: string) => {
    // In the future, this will call Proxmox API to create a snapshot
    // For now, it's a placeholder
  }, [])

  const updateVMTags = useCallback(async (id: string, tags: string[]) => {
    const { error } = await supabase.from('vms').update({ tags }).eq('id', id)
    if (error) throw error
    await loadVMs()
  }, [loadVMs])

  const updateVMNotes = useCallback(async (id: string, notes: string) => {
    const { error } = await supabase.from('vms').update({ notes }).eq('id', id)
    if (error) throw error
    await loadVMs()
  }, [loadVMs])

  const deleteVM = useCallback(async (id: string) => {
    const { error } = await supabase.from('vms').delete().eq('id', id)
    if (error) throw error
    await loadVMs()
  }, [loadVMs])

  const value: VMStoreValue = { vms, vmsLoading, loadVMs, addVM, updateVM, deleteVM, startVM, stopVM, restartVM, snapshotVM, updateVMTags, updateVMNotes }
  return React.createElement(VMContext.Provider, { value }, children as any)
}

export const useVMStore = (): VMStoreValue => {
  const ctx = useContext(VMContext)
  if (!ctx) throw new Error('useVMStore must be used within VMProvider')
  return ctx
}

export default useVMStore