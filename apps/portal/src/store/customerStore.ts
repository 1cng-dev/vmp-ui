import React, { useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { Customer } from '../types'

export interface CustomerStoreValue {
  customers: Customer[]
  customersLoading: boolean
  loadCustomers: () => Promise<void>
  addCustomer: (c: Omit<Customer, 'id'>) => Promise<string>
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>
  setKYC: (id: string, decision: 'Pending' | 'Approved' | 'Rejected') => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  subscribeToCustomers: () => () => void
}

// ── Global Customer Context Store ─────────────────────────────────────────────
const CustomerContext = createContext<CustomerStoreValue | null>(null)

export const CustomerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)

  const loadCustomers = useCallback(async () => {
    const shouldShowSpinner = customers.length === 0
    try {
      if (shouldShowSpinner) setCustomersLoading(true)
      const { data: userRes } = await supabase.auth.getUser()
      const role = userRes?.user?.user_metadata?.role || userRes?.user?.role
      const userId = userRes?.user?.id

      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      // For normal customers, fetch only their own row; staff/admin can load all
      if (role !== 'Staff' && role !== 'Admin' && role !== 'Sales' && role !== 'Finance' && userId) {
        query = query.eq('id', userId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to load customers:', error)
      }
      if (data) {
        // Enrich with last login timestamp from auth.users for admin/staff views
        let usersMap: Record<string, string | undefined> = {}
        const isPrivileged = role === 'Staff' || role === 'Admin' || role === 'Sales' || role === 'Finance'
        if (isPrivileged) {
          try {
            const { data: usersRes, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
            if (!usersErr && usersRes?.users) {
              usersMap = usersRes.users.reduce((acc: Record<string, string | undefined>, u: any) => {
                acc[u.id] = u.last_sign_in_at
                return acc
              }, {})
            }
          } catch (e) {
            // ignore admin lookup failures; keep base data
          }
        }

        const enriched = (data as Customer[]).map((c: any) => ({
          ...c,
          last_login_at: c.last_login_at || usersMap[c.id]
        })) as Customer[]
        setCustomers(enriched)
      }
    } finally {
      if (shouldShowSpinner) setCustomersLoading(false)
    }
  }, [customers.length])

  const subscribeToCustomers = useCallback(() => {
    const channelName = `customers-changes-${Date.now()}`
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        loadCustomers()
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }, [loadCustomers])

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
    } else {
      console.error('Failed to update customer:', error)
    }
  }, [loadCustomers])

  const setKYC = useCallback(async (id: string, decision: 'Pending' | 'Approved' | 'Rejected') => {
    await updateCustomer(id, { kyc_status: decision })
  }, [updateCustomer])

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      // Delete from dependent tables that don't have cascade delete
      // (tables with ON DELETE CASCADE will be handled automatically when customers is deleted)
      await supabase.from('tickets').delete().eq('customer', id)
      await supabase.from('alerts').delete().eq('customer', id)
      
      // Delete from auth.users - this will cascade delete from customers table
      // and from tables that have ON DELETE CASCADE (vms, invoices, tasks)
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
      
      if (authError) {
        console.error('Failed to delete auth user:', authError)
        throw authError
      }
      
      await loadCustomers()
    } catch (error) {
      console.error('Failed to delete customer:', error)
      throw error
    }
  }, [loadCustomers])

  const value: CustomerStoreValue = {
    customers,
    customersLoading,
    loadCustomers,
    addCustomer,
    updateCustomer,
    setKYC,
    deleteCustomer,
    subscribeToCustomers,
  }

  return React.createElement(CustomerContext.Provider, { value }, children as any)
}

export const useCustomerStore = (): CustomerStoreValue => {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error('useCustomerStore must be used within CustomerProvider')
  return ctx
}

export default useCustomerStore
