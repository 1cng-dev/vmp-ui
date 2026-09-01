import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { uploadKYCDocument } from '../lib/storage'
import type { Customer } from '../types'
import { createAlert } from '../services/notificationService'
import useActivityStore from './activityStore'
import { sendSignupEmail } from '../services/emailService'

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
  }) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>
  completeCustomer: (data: {
    customerData: Omit<Customer, 'id'> & {
      nrcFrontFile?: File | null
      nrcBackFile?: File | null
      orgCertFile?: File | null
      orgTaxIdFile?: File | null
      dirIdFile?: File | null
    }
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
  const { logActivity } = useActivityStore()

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

  // Create auth user and store profile data in user_metadata.
  // Customer record and KYC upload happen later, after email verification.
  const signUp = useCallback(async (data: {
    email: string
    password: string
    name: string
    type: 'Individual' | 'Organization'
    phone: string
    customerData: Omit<Customer, 'id'>
  }) => {
    try {
      const redirectTo = `${window.location.origin}/auth/confirm`
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: 'Customer',
            type: data.type,
            phone: data.phone,
            customerData: data.customerData,
          },
          emailRedirectTo: redirectTo,
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        // Custom error message for already registered email (security: don't reveal email existence)
        if (authError.message.includes('already registered') || authError.message.includes('already been registered') || authError.message.includes('User already registered')) {
          return { success: false, error: 'Unable to create account. Please try again or contact support.' }
        }
        return { success: false, error: authError.message }
      }

      if (authData.user) {
        return { success: true, requiresEmailConfirmation: !authData.user.email_confirmed_at }
      }

      return { success: false, error: 'Failed to create user' }
    } catch (error) {
      console.error('Signup catch error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [])

  // Complete signup: upload KYC documents and create customer record.
  // Must be called after the user has verified their email and has a session.
  const completeCustomer = useCallback(async (data: {
    customerData: Omit<Customer, 'id'> & {
      nrcFrontFile?: File | null
      nrcBackFile?: File | null
      orgCertFile?: File | null
      orgTaxIdFile?: File | null
      dirIdFile?: File | null
    }
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'Not authenticated' }
      }

      const userData = user.user_metadata
      const signupData = (userData.customerData || {}) as Partial<Customer>

      // Upload KYC documents
      const uploadPromises: Promise<string>[] = []
      if (data.customerData.nrcFrontFile) {
        uploadPromises.push(uploadKYCDocument(data.customerData.nrcFrontFile, user.id, 'nrc_front'))
      }
      if (data.customerData.nrcBackFile) {
        uploadPromises.push(uploadKYCDocument(data.customerData.nrcBackFile, user.id, 'nrc_back'))
      }
      if (data.customerData.orgCertFile) {
        uploadPromises.push(uploadKYCDocument(data.customerData.orgCertFile, user.id, 'org_cert'))
      }
      if (data.customerData.orgTaxIdFile) {
        uploadPromises.push(uploadKYCDocument(data.customerData.orgTaxIdFile, user.id, 'org_tax_id'))
      }
      if (data.customerData.dirIdFile) {
        uploadPromises.push(uploadKYCDocument(data.customerData.dirIdFile, user.id, 'director_id'))
      }

      const urls = await Promise.all(uploadPromises)

      // Remove File objects from customerData before insert
      const { nrcFrontFile, nrcBackFile, orgCertFile, orgTaxIdFile, dirIdFile, ...cleanCustomerData } = data.customerData

      // Create customer record in Supabase with auth user ID and URLs
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          id: user.id,
          ...signupData,
          ...cleanCustomerData,
          nrc_front_url: urls[0] || null,
          nrc_back_url: urls[1] || null,
          org_cert_url: urls[2] || null,
          org_tax_id_url: urls[3] || null,
          director_id_url: urls[4] || null,
        })
        .select('id, legacy_id')
        .single()

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

      // Create notification for new customer signup
      // Note: Customer signup uses customer as actor since they perform the action themselves
      await createAlert({
        sev: 'info',
        title: 'New Customer Signup',
        body: `New customer ${signupData.name} (${signupData.email}) has signed up with ${signupData.account_type} account`,
        type: 'kyc',
        related_entity_id: customerData.id,
        related_entity_type: 'customer',
        actor_id: customerData.id,
        actor_name: signupData.name || userData.name || user.email!,
        metadata: {
          customer_name: signupData.name,
          customer_email: signupData.email,
          account_type: signupData.account_type,
          phone: signupData.phone,
          kyc_status: 'Pending'
        }
      })

      // Log activity for customer signup
      await logActivity(
        `New customer signup: ${signupData.name} (${signupData.email})`,
        'customer',
        signupData.name || userData.name || user.email!,
        { customerId: customerData.id, customerName: signupData.name, email: signupData.email, accountType: signupData.account_type, kycStatus: 'Pending' }
      )

      // Send signup success email to customer
      await sendSignupEmail({
        to: signupData.email || user.email!,
        customerName: signupData.name || userData.name || user.email!,
        accountType: signupData.account_type || 'Individual',
        email: signupData.email || user.email!
      })

      return { success: true, customerId: customerData.legacy_id || customerData.id }
    } catch (error) {
      console.error('Complete customer catch error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }, [])

  // Sign in with Supabase
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut()
        return { success: false, error: 'Please verify your email before signing in.' }
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
    completeCustomer,
    createCustomer,
    updateCustomer,
    getCustomer,
    getCustomers,
    refreshUser,
  }
}

export default useAuthStore
