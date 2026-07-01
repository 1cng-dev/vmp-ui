import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types'

export interface CustomerStoreValue {
  customers: Customer[]
  customersLoading: boolean
  loadCustomers: () => Promise<void>
  addCustomer: (c: Omit<Customer, 'id'>) => Promise<string>
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>
  setKYC: (id: string, decision: 'Pending' | 'Approved' | 'Rejected' | 'Under Review') => Promise<void>
}

const useCustomerStore = (): CustomerStoreValue => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)

  const loadCustomers = useCallback(async () => {
    try {
      setCustomersLoading(true)
      const { data: userRes } = await supabase.auth.getUser()
      const role = userRes?.user?.user_metadata?.role
      const userId = userRes?.user?.id

      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      // For normal customers, fetch only their own row; staff/admin can load all
      if (role !== 'Staff' && role !== 'Admin' && userId) {
        query = query.eq('id', userId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to load customers:', error)
      }
      if (data) {
        setCustomers(data as Customer[])
      }
    } finally {
      setCustomersLoading(false)
    }
  }, [])

  const addCustomer = useCallback(async (c: Omit<Customer, 'id'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert(c)
      .select('id, legacy_id')
      .single()
    
    if (error) throw error
    if (data) {
      await loadCustomers()
      return data.legacy_id || data.id
    }
    throw new Error('Failed to create customer')
  }, [loadCustomers])

  const updateCustomer = useCallback(async (id: string, patch: Partial<Customer>) => {
    const { error } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', id)
    
    if (!error) {
      await loadCustomers()
    }
  }, [loadCustomers])

  const setKYC = useCallback(async (id: string, decision: 'Pending' | 'Approved' | 'Rejected' | 'Under Review') => {
    await updateCustomer(id, { kyc_status: decision })
  }, [updateCustomer])

  return {
    customers,
    customersLoading,
    loadCustomers,
    addCustomer,
    updateCustomer,
    setKYC,
  }
}

export default useCustomerStore
