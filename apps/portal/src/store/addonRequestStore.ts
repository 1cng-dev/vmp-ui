import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface AddonRequest {
  id: string
  customer_id: string
  vm_id: string
  cpfs_enabled: boolean
  cpfs_package: string
  ccis_enabled: boolean
  ccis_package: string
  duration: number
  notes: string
  status: string
  created_at: string
  updated_at: string
  legacy_id: string
}

const fetchAddonRequests = async (): Promise<AddonRequest[]> => {
  const { data, error } = await supabase.from('addon_requests').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as AddonRequest[]) || []
}

export const useAddonRequests = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: addonRequests = [], isLoading: addonRequestsLoading, error } = useQuery({
    queryKey: ['addonRequests'],
    queryFn: fetchAddonRequests,
    staleTime: 1000 * 60 * 5,
  })

  const createAddonRequest = useMutation({
    mutationFn: async (request: Omit<AddonRequest, 'id' | 'legacy_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('addon_requests').insert(request).select().single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addonRequests'] })
      createAlert('success', 'Addon request created successfully')
    },
  })

  const updateAddonRequest = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AddonRequest> }) => {
      const { error } = await supabase.from('addon_requests').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['addonRequests'] })
      logActivity({ text: 'Addon request updated', kind: 'addon_request', meta: { requestId: id } })
      createAlert('success', 'Addon request updated successfully')
    },
  })

  const deleteAddonRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('addon_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['addonRequests'] })
      logActivity({ text: 'Addon request deleted', kind: 'addon_request', meta: { requestId: id } })
      createAlert('success', 'Addon request deleted successfully')
    },
  })

  return {
    addonRequests,
    addonRequestsLoading,
    error,
    createAddonRequest: createAddonRequest.mutateAsync,
    updateAddonRequest: updateAddonRequest.mutateAsync,
    deleteAddonRequest: deleteAddonRequest.mutateAsync,
  }
}