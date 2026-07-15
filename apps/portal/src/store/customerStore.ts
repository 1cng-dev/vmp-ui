import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import useActivityStore from './activityStore'
import { createAlert } from '../services/notificationService'

export interface Customer {
  id: string
  name: string
  email: string
  org_name?: string
  role: string
  status: string
  created_at: string
  updated_at: string
  last_login_at?: string
}

const fetchCustomers = async (): Promise<Customer[]> => {
  const { data: userRes } = await supabase.auth.getUser()
  const role = userRes?.user?.user_metadata?.role || userRes?.user?.role
  const userId = userRes?.user?.id

  let query = supabase.from('customers').select('*').order('created_at', { ascending: false })

  if (role !== 'Staff' && role !== 'Admin' && role !== 'Sales' && role !== 'Finance' && role !== 'Engineer' && userId) {
    query = query.eq('id', userId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as Customer[]) || []
}

export const useCustomers = () => {
  const queryClient = useQueryClient()
  const { logActivity } = useActivityStore()

  const { data: customers = [], isLoading: customersLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    staleTime: 1000 * 60 * 5,
  })

  const addCustomer = useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('customers').insert(customer).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      createAlert('success', 'Customer created successfully')
    },
  })

  const updateCustomer = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Customer> }) => {
      const { error } = await supabase.from('customers').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      logActivity({ text: 'Customer updated', kind: 'customer', meta: { customerId: id } })
      createAlert('success', 'Customer updated successfully')
    },
  })

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      logActivity({ text: 'Customer deleted', kind: 'customer', meta: { customerId: id } })
      createAlert('success', 'Customer deleted successfully')
    },
  })

  return {
    customers,
    customersLoading,
    error,
    addCustomer: addCustomer.mutateAsync,
    updateCustomer: updateCustomer.mutateAsync,
    deleteCustomer: deleteCustomer.mutateAsync,
  }
}