import React, { useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { VM as VMType, NewVMInput } from '../types'

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
  billing_term?: 'Monthly' | 'Annual'
  legacy_id?: string
  assigned_vmid?: number
  created_at: string
  updated_at: string
}

export interface VMStoreValue {
  vms: VM[]
  vmsLoading: boolean
  loadVMs: () => Promise<void>
  addVM: (vm: NewVMInput) => Promise<string>
  updateVM: (id: string, patch: Partial<VM>) => Promise<void>
  deleteVM: (id: string) => Promise<void>
}

const VMContext = createContext<VMStoreValue | null>(null)

export const VMProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vms, setVms] = useState<VM[]>([])
  const [vmsLoading, setVmsLoading] = useState(false)

  const loadVMs = useCallback(async () => {
    const spin = vms.length === 0
    try {
      if (spin) setVmsLoading(true)
      const { data, error } = await supabase.from('vms').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setVms((data as VM[]) || [])
    } finally {
      if (spin) setVmsLoading(false)
    }
  }, [vms.length])

  const addVM = useCallback(async (vm: NewVMInput) => {
    console.log('addVM called with VM data:', vm)
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
      billing_term: vm.billing_term,
      legacy_id: vm.legacy_id,
      assigned_vmid: (vm as any).assigned_vmid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log('About to insert VM into database:', newVM)
    // Persist to Supabase
    const { error, data } = await supabase.from('vms').insert(newVM).select()
    if (error) {
      console.error('Error adding VM to database:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      throw error
    }
    console.log('VM inserted successfully:', data)
    setVms(s => [newVM, ...s])
    return id
  }, [])

  const updateVM = useCallback(async (id: string, patch: Partial<VM>) => {
    const { error } = await supabase.from('vms').update(patch).eq('id', id)
    if (error) throw error
    await loadVMs()
  }, [loadVMs])

  const deleteVM = useCallback(async (id: string) => {
    const { error } = await supabase.from('vms').delete().eq('id', id)
    if (error) throw error
    await loadVMs()
  }, [loadVMs])

  const value: VMStoreValue = { vms, vmsLoading, loadVMs, addVM, updateVM, deleteVM }
  return React.createElement(VMContext.Provider, { value }, children as any)
}

export const useVMStore = (): VMStoreValue => {
  const ctx = useContext(VMContext)
  if (!ctx) throw new Error('useVMStore must be used within VMProvider')
  return ctx
}

export default useVMStore