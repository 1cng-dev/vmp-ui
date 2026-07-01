import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { uploadKYCDocument } from '../lib/storage'
import type { Customer } from '../types'

export interface AuthUser {
  id: string
  email: string
  role: string
  name: string
  avatar: string
  customerId?: string
}

export interface AuthStoreValue {
  user: AuthUser | null
  loading: boolean
  signUp: (data: {
    email: string
    password: string
    name: string
    type: 'Individual' | 'Organization'
    phone: string
    customerData: Omit<Customer, 'id'>
  }) => Promise<{ success: boolean; error?: string; customerId?: string }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  createCustomer: (customerData: Omit<Customer, 'id'>) => Promise<{ success: boolean; error?: string; customerId?: string }>
  updateCustomer: (customerId: string, patch: Partial<Customer>) => Promise<{ success: boolean; error?: string }>
  getCustomer: (customerId: string) => Promise<Customer | null>
  getCustomers: () => Promise<Customer[]>
  refreshUser: () => Promise<void>
}

const useAuthStore = (): AuthStoreValue => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Refresh user from Supabase session
  const refreshUser = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const userData = session.user.user_metadata
      setUser({
        id: session.user.id,
        email: session.user.email!,
        role: userData.role || 'Customer',
        name: userData.name || session.user.email!,
        avatar: userData.name || session.user.email!,
        customerId: userData.customerId,
      })
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [])

  // Sign up with Supabase and create customer record
  const signUp = useCallback(async (data: {
    email: string
    password: string
    name: string
    type: 'Individual' | 'Organization'
    phone: string
    customerData: Omit<Customer, 'id'> & {
      nrcFrontFile?: File | null
      nrcBackFile?: File | null
      orgCertFile?: File | null
      orgTaxIdFile?: File | null
      dirIdFile?: File | null
    }
  }) => {
    try {
      console.log('Starting signup for:', data.email)

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: 'Customer',
            type: data.type,
            phone: data.phone,
          }
        }
      })

      console.log('Auth signup result:', { authData, authError })

      if (authError) {
        console.error('Auth error:', authError)
        return { success: false, error: authError.message }
      }

      if (authData.user) {
        console.log('Auth user created:', authData.user.id)

        // Upload KYC documents first
        const uploadPromises = []
        if (data.customerData.nrcFrontFile) {
          uploadPromises.push(uploadKYCDocument(data.customerData.nrcFrontFile, authData.user.id, 'nrc_front'))
        }
        if (data.customerData.nrcBackFile) {
          uploadPromises.push(uploadKYCDocument(data.customerData.nrcBackFile, authData.user.id, 'nrc_back'))
        }
        if (data.customerData.orgCertFile) {
          uploadPromises.push(uploadKYCDocument(data.customerData.orgCertFile, authData.user.id, 'org_cert'))
        }
        if (data.customerData.orgTaxIdFile) {
          uploadPromises.push(uploadKYCDocument(data.customerData.orgTaxIdFile, authData.user.id, 'org_tax_id'))
        }
        if (data.customerData.dirIdFile) {
          uploadPromises.push(uploadKYCDocument(data.customerData.dirIdFile, authData.user.id, 'director_id'))
        }

        const urls = await Promise.all(uploadPromises)
        console.log('KYC documents uploaded:', urls)

        // Remove File objects from customerData before insert
        const { nrcFrontFile, nrcBackFile, orgCertFile, orgTaxIdFile, dirIdFile, ...cleanCustomerData } = data.customerData

        console.log('Inserting customer data:', { id: authData.user.id, ...cleanCustomerData })

        // Create customer record in Supabase with auth user ID and URLs
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert({
            id: authData.user.id, // Link to auth.users.id
            ...cleanCustomerData,
            nrc_front_url: urls[0] || null,
            nrc_back_url: urls[1] || null,
            org_cert_url: urls[2] || null,
            org_tax_id_url: urls[3] || null,
            director_id_url: urls[4] || null,
          })
          .select('id, legacy_id')
          .single()

        console.log('Customer insert result:', { customerData, customerError })

        if (customerError) {
          console.error('Customer insert error:', customerError)
          return { success: false, error: customerError.message }
        }

        // Update user metadata with customerId (using legacy_id for display)
        await supabase.auth.updateUser({
          data: {
            customerId: customerData.id,
            customerLegacyId: customerData.legacy_id
          }
        })

        console.log('Signup successful:', customerData.legacy_id || customerData.id)
        return { success: true, customerId: customerData.legacy_id || customerData.id }
      }

      return { success: false, error: 'Failed to create user' }
    } catch (error) {
      console.error('Signup catch error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [])

  // Sign in with Supabase
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      await refreshUser()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [refreshUser])

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  // Create customer in Supabase
  const createCustomer = useCallback(async (customerData: Omit<Customer, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select('id')
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, customerId: data.id }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [])

  // Update customer in Supabase
  const updateCustomer = useCallback(async (customerId: string, patch: Partial<Customer>) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update(patch)
        .eq('id', customerId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [])

  // Get single customer from Supabase
  const getCustomer = useCallback(async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (error) {
        return null
      }

      return data as Customer
    } catch (error) {
      return null
    }
  }, [])

  // Get all customers from Supabase
  const getCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return []
      }

      return data as Customer[]
    } catch (error) {
      return []
    }
  }, [])

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    createCustomer,
    updateCustomer,
    getCustomer,
    getCustomers,
    refreshUser,
  }
}

export default useAuthStore
