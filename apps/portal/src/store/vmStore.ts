import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { NewVMInput } from '../types'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'

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

const fetchVMs = async (): Promise<VM[]> => {
  const { data, error } = await supabase.from('vms').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as VM[]) || []
}

export const useVMs = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: vms = [], isLoading: vmsLoading, error } = useQuery({
    queryKey: ['vms'],
    queryFn: fetchVMs,
    staleTime: 1000 * 60 * 5,
  })

  const addVM = useMutation({
    mutationFn: async (vm: NewVMInput) => {
      const { data, error } = await supabase.from('vms').insert(vm).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
      logActivity({ text: 'VM created', kind: 'vm', meta: { vmId: data.id } })
      createAlert('success', 'VM created successfully')
    },
    onError: (error) => {
      createAlert('error', `Failed to create VM: ${error}`)
    },
  })

  const updateVM = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VM> }) => {
      const { error } = await supabase.from('vms').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
      logActivity({ text: 'VM updated', kind: 'vm', meta: { vmId: id } })
      createAlert('success', 'VM updated successfully')
    },
    onError: (error) => {
      createAlert('error', `Failed to update VM: ${error}`)
    },
  })

  const deleteVM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vms').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
      logActivity({ text: 'VM deleted', kind: 'vm', meta: { vmId: id } })
      createAlert('success', 'VM deleted successfully')
    },
    onError: (error) => {
      createAlert('error', `Failed to delete VM: ${error}`)
    },
  })

  const startVM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vms').update({ power_state: 'Running' }).eq('id', id)
      if (error) throw error
      await logActivity({ text: 'VM started', kind: 'vm', meta: { vmId: id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
    },
  })

  const stopVM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vms').update({ power_state: 'Stopped' }).eq('id', id)
      if (error) throw error
      await logActivity({ text: 'VM stopped', kind: 'vm', meta: { vmId: id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
    },
  })

  const restartVM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vms').update({ power_state: 'Running' }).eq('id', id)
      if (error) throw error
      await logActivity({ text: 'VM restarted', kind: 'vm', meta: { vmId: id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
    },
  })

  const snapshotVM = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('vms').update({ backup_enabled: true, backup_type: name }).eq('id', id)
      if (error) throw error
      await logActivity({ text: `VM snapshot created: ${name}`, kind: 'vm', meta: { vmId: id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
      createAlert('success', 'VM snapshot created successfully')
    },
    onError: (error) => {
      createAlert('error', `Failed to create snapshot: ${error}`)
    },
  })

  const updateVMTags = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase.from('vms').update({ tags }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
      createAlert('success', 'VM tags updated successfully')
    },
    onError: (error) => {
      createAlert('error', `Failed to update tags: ${error}`)
    },
  })

  const updateVMNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from('vms').update({ notes }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vms'] })
      createAlert('success', 'VM notes updated successfully')
    },
    onError: (error) => {
      createAlert('error', `Failed to update notes: ${error}`)
    },
  })

  return {
    vms,
    vmsLoading,
    error,
    addVM: addVM.mutateAsync,
    updateVM: updateVM.mutateAsync,
    deleteVM: deleteVM.mutateAsync,
    startVM: startVM.mutateAsync,
    stopVM: stopVM.mutateAsync,
    restartVM: restartVM.mutateAsync,
    snapshotVM: snapshotVM.mutateAsync,
    updateVMTags: updateVMTags.mutateAsync,
    updateVMNotes: updateVMNotes.mutateAsync,
  }
}