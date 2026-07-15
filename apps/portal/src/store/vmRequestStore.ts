import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface VMRequest {
  id: string
  customer_id: string
  hostname: string
  vcpu: number
  ram_gb: number
  storage_gb: number
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
}

const fetchVMRequests = async (): Promise<VMRequest[]> => {
  const { data, error } = await supabase.from('vm_requests').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as VMRequest[]) || []
}

export const useVMRequests = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: vmRequests = [], isLoading: vmRequestsLoading, error } = useQuery({
    queryKey: ['vmRequests'],
    queryFn: fetchVMRequests,
    staleTime: 1000 * 60 * 5,
  })

  const addVMRequest = useMutation({
    mutationFn: async (request: Omit<VMRequest, 'id' | 'created_at' | 'updated_at' | 'legacy_id'>) => {
      const { data, error } = await supabase.from('vm_requests').insert(request).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vmRequests'] })
      createAlert('success', 'VM request created successfully')
    },
  })

  const updateVMRequest = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VMRequest> }) => {
      const { error } = await supabase.from('vm_requests').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vmRequests'] })
      logActivity({ text: 'VM request updated', kind: 'vm_request', meta: { requestId: id } })
      createAlert('success', 'VM request updated successfully')
    },
  })

  const deleteVMRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vm_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['vmRequests'] })
      logActivity({ text: 'VM request deleted', kind: 'vm_request', meta: { requestId: id } })
      createAlert('success', 'VM request deleted successfully')
    },
  })

  return {
    vmRequests,
    vmRequestsLoading,
    error,
    addVMRequest: addVMRequest.mutateAsync,
    updateVMRequest: updateVMRequest.mutateAsync,
    deleteVMRequest: deleteVMRequest.mutateAsync,
  }
}