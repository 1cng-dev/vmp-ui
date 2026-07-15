import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { Customer } from '../types'
import useActivityStore from './activityStore'

export interface CustomerStoreValue {
  customers: Customer[]
  customersLoading: boolean
  loadCustomers: () => Promise<void>
  addCustomer: (c: Omit<Customer, 'id'>) => Promise<string>
  addCustomerWithAuth: (c: Omit<Customer, 'id'>, tempPassword: string) => Promise<string>
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>
  setKYC: (id: string, decision: 'Pending' | 'Approved' | 'Rejected') => Promise<void>
  resetPassword: (id: string, password: string) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  subscribeToCustomers: () => () => void
}

// ── Global Customer Context Store ─────────────────────────────────────────────
const CustomerContext = createContext<CustomerStoreValue | null>(null)

export const CustomerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const { logActivity } = useActivityStore()


  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true)
    
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const role = userRes?.user?.user_metadata?.role || userRes?.user?.role
      const userId = userRes?.user?.id

      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      // For normal customers, fetch only their own row; staff/admin can load all
      if (role !== 'Staff' && role !== 'Admin' && role !== 'Sales' && role !== 'Finance' && role !== 'Engineer' && userId) {
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
      setCustomersLoading(false)
    }
  }, [])

  const subscribeToCustomers = useCallback(() => {
    const channelName = `customers-changes`
    const channel = supabase.channel(channelName)
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        loadCustomers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadCustomers])

  // Set up real-time subscription on mount
  useEffect(() => {
    const unsubscribe = subscribeToCustomers()
    return () => unsubscribe()
  }, [subscribeToCustomers])

  const addCustomer = useCallback(async (c: Omit<Customer, 'id'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert(c)
      .select('id, legacy_id')
      .single()

    if (error) throw error
    if (data) {
      await loadCustomers()
      
      // Get current user for activity logging
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
        `Created customer account for ${c.name} (${c.org_name || c.company || 'Individual'})`,
        'customer',
        actorName,
        { customerId: data.id, customerName: c.name, orgName: c.org_name || c.company, accountType: c.account_type }
      )
      
      return data.legacy_id || data.id
    }
    throw new Error('Failed to create customer')
  }, [loadCustomers, logActivity])

  const updateCustomer = useCallback(async (id: string, patch: Partial<Customer>) => {
    const previousCustomer = customers.find(c => c.id === id)
    const { error } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', id)

    if (!error) {
      await loadCustomers()
      
      // Log status changes
      if (patch.status && previousCustomer && patch.status !== previousCustomer.status) {
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
          `Changed customer ${previousCustomer.name} status from ${previousCustomer.status} to ${patch.status}`,
          'customer',
          actorName,
          { customerId: id, customerName: previousCustomer.name, previousStatus: previousCustomer.status, newStatus: patch.status }
        )
      }
    } else {
      console.error('Failed to update customer:', error)
    }
  }, [loadCustomers, customers, logActivity])

  const setKYC = useCallback(async (id: string, decision: 'Pending' | 'Approved' | 'Rejected') => {
    await updateCustomer(id, { kyc_status: decision })
  }, [updateCustomer])

  const resetPassword = useCallback(async (id: string, password: string) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: password
    })

    if (error) {
      console.error('Failed to reset password:', error)
      throw error
    }
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    const customer = customers.find(c => c.id === id)
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
      
      // Log customer deletion
      if (customer) {
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
          `Deleted customer account for ${customer.name} (${customer.org_name || customer.company || 'Individual'})`,
          'customer',
          actorName,
          { customerId: id, customerName: customer.name, orgName: customer.org_name || customer.company, accountType: customer.account_type }
        )
      }
    } catch (error) {
      console.error('Failed to delete customer:', error)
      throw error
    }
  }, [loadCustomers, customers, logActivity])

  const addCustomerWithAuth = useCallback(async (c: Omit<Customer, 'id'>, tempPassword: string) => {
    // Create auth user first
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: c.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: c.name,
        role: 'Customer',
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Failed to create auth user')

    // Create customer record linked to auth user
    const { data, error } = await supabase
      .from('customers')
      .insert({
        id: authData.user.id,
        ...c,
        force_password_change: true,
      })
      .select('id, legacy_id')
      .single()

    if (error) throw error
    if (data) {
      await loadCustomers()
      
      // Get current user for activity logging
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
        `Created customer account with temp password for ${c.name} (${c.org_name || c.company || 'Individual'})`,
        'customer',
        actorName,
        { customerId: data.id, customerName: c.name, orgName: c.org_name || c.company, accountType: c.account_type }
      )
      
      return data.legacy_id || data.id
    }
    throw new Error('Failed to create customer')
  }, [loadCustomers, logActivity])

  const value: CustomerStoreValue = {
    customers,
    customersLoading,
    loadCustomers,
    addCustomer,
    addCustomerWithAuth,
    updateCustomer,
    setKYC,
    resetPassword,
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
