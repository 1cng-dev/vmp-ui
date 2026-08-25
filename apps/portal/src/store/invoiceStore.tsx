import { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { DBInvoice, NewInvoiceInput } from '../types'
import { createAlert } from '../services/notificationService'
import { sendInvoiceEmail } from '../services/emailService'
import { generateInvoicePDFBase64 } from '../lib/pdfExport'
import useActivityStore from './activityStore'
import useAddonRequestStore from './addonRequestStore'

export interface InvoiceStoreValue {
  invoices: DBInvoice[]
  invoicesLoading: boolean
  loadInvoices: () => Promise<void>
  addInvoice: (i: NewInvoiceInput) => Promise<string>
  updateInvoice: (id: string, patch: Partial<DBInvoice>) => Promise<void>
  markPaid: (id: string, receipt: string) => Promise<void>
  cancelInvoice: (id: string) => Promise<void>
}

const InvoiceContext = createContext<InvoiceStoreValue | null>(null)

export const InvoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [invoices, setInvoices] = useState<DBInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const { logActivity } = useActivityStore()
  const { createAddonRequest } = useAddonRequestStore()


  const loadInvoices = useCallback(async () => {
    // Don't set loading state if we already have data
    const shouldShowLoading = invoices.length === 0
    if (shouldShowLoading) {
      setInvoicesLoading(true)
    }
    
    const MIN_LOADING_TIME = 400 // 400ms minimum loading time
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.from('invoices').select('*').order('issued', { ascending: false })
      if (error) throw error
      // Map database fields to DBInvoice interface
      const mappedData = (data || []).map((inv: any) => ({
        ...inv,
        issued: inv.issued,
        due: inv.due,
        paid_date: inv.paid_date,
        gross_amount: inv.gross_amount || inv.amount,
        net_amount: inv.net_amount || inv.amount,
        vat: inv.vat || 0,
        line_items: inv.line_items || [],
      })) as DBInvoice[]
      setInvoices(mappedData)
    } finally {
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      if (shouldShowLoading) {
        setInvoicesLoading(false)
      }
    }
  }, [invoices.length])

  // Real-time subscription for invoice changes
  useEffect(() => {
    const channelName = `invoices-changes`
    const channel = supabase.channel(channelName)
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        () => {
          loadInvoices()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadInvoices])

  const addInvoice = useCallback(async (i: NewInvoiceInput) => {
    // Get current user (staff member) who created the invoice
    const { data: { user } } = await supabase.auth.getUser()
    let actorName = 'System'
    let actorId = i.customer_id
    if (user) {
      const { data: staff } = await supabase
        .from('team_members')
        .select('name, staff_code')
        .eq('user_id', user.id)
        .maybeSingle()
      if (staff) {
        actorName = `${staff.name} (${staff.staff_code})`
        actorId = user.id
      } else {
        // Fallback to user's name or email if not in team_members
        actorName = user.user_metadata?.name || user.email || 'System'
        actorId = user.id
      }
    }

    // Round all monetary values to 2 decimal places before saving to database
    const roundTo2Decimals = (num: number) => Math.round(num * 100) / 100

    // Add created_by to the invoice data with rounded values
    const invoiceWithCreator = {
      ...i,
      created_by: actorName,
      amount: roundTo2Decimals(i.amount),
      vat: roundTo2Decimals(i.vat || 0),
      gross_amount: roundTo2Decimals(i.gross_amount),
      net_amount: roundTo2Decimals(i.net_amount || i.amount),
      discount: roundTo2Decimals(i.discount || 0)
    }

    const { data, error } = await supabase.from('invoices').insert(invoiceWithCreator).select().single()
    if (error) throw error
    await loadInvoices()

    const invoice = data as DBInvoice

    // Query again to get the legacy_id (trigger-generated)
    const { data: invoiceWithLegacy } = await supabase
      .from('invoices')
      .select('legacy_id')
      .eq('id', invoice.id)
      .single()

    if (invoiceWithLegacy?.legacy_id) {
      invoice.legacy_id = invoiceWithLegacy.legacy_id
    }
    
    // Get customer information for notification and email
    const { data: customer } = await supabase
      .from('customers')
      .select('name, org_name, account_type, email')
      .eq('id', invoice.customer_id)
      .single()

    const customerName = customer?.account_type === 'Organization' && customer?.org_name
      ? `${customer.name} (${customer.org_name})`
      : (customer?.name || 'Unknown')

    // Send invoice email to customer with PDF attachment
    if (customer?.email) {
      let pdfAttachmentBase64: string | undefined
      try {
        pdfAttachmentBase64 = await generateInvoicePDFBase64(invoice, customer)
      } catch (err) {
        console.error('Failed to generate invoice PDF for email attachment:', err)
      }

      await sendInvoiceEmail({
        to: customer.email,
        customerName: customerName,
        invoiceId: invoice.legacy_id || invoice.id,
        amount: invoice.gross_amount,
        dueDate: invoice.due,
        pdfAttachmentBase64
      })
    }
    
    // Create notification and activity log for new invoice
    await logActivity(
      `Created invoice ${invoice.legacy_id || invoice.id} for ${customerName} - MMK ${invoice.gross_amount}`,
      'finance',
      actorName,
      { invoiceId: invoice.legacy_id || invoice.id, amount: invoice.gross_amount, customerId: invoice.customer_id, dueDate: invoice.due }
    )
    
    await createAlert({
      sev: 'info',
      title: 'New Invoice Created',
      body: `New invoice ${invoice.legacy_id || invoice.id} created for ${customerName} - MMK ${invoice.gross_amount}`,
      type: 'finance',
      related_entity_id: invoice.id,
      related_entity_type: 'invoice',
      actor_id: actorId,
      actor_name: actorName,
      customer_id: invoice.customer_id,
      metadata: {
        invoice_id: invoice.legacy_id || invoice.id,
        amount: invoice.gross_amount,
        customer_id: invoice.customer_id,
        due_date: invoice.due
      }
    })

    return invoice.legacy_id || invoice.id
  }, [loadInvoices])

  const updateInvoice = useCallback(async (id: string, patch: Partial<DBInvoice>) => {
    let previousInvoice = invoices.find(i => i.id === id)
    
    // If invoice not found in local state, fetch from database
    if (!previousInvoice) {
      const { data: fetchedInvoice } = await supabase.from('invoices').select('*').eq('id', id).single()
      previousInvoice = fetchedInvoice as DBInvoice
    }
    
    const { error } = await supabase.from('invoices').update(patch).eq('id', id)
    if (error) throw error
    await loadInvoices()
    
    // Create notification for status change
    if (patch.status && previousInvoice && patch.status !== previousInvoice.status) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      let actorId = previousInvoice.customer_id
      
      // Check if current user is a staff member
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .maybeSingle()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
          actorId = user.id
        } else {
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || 'System'
          actorId = user.id
        }
      }
      
      await logActivity(
        `Changed invoice ${previousInvoice.legacy_id || previousInvoice.id} status from ${previousInvoice.status} to ${patch.status}`,
        'finance',
        actorName,
        { invoiceId: previousInvoice.legacy_id || previousInvoice.id, previousStatus: previousInvoice.status, newStatus: patch.status, customerId: previousInvoice.customer_id }
      )
      
      await createAlert({
        sev: 'info',
        title: 'Invoice Status Changed',
        body: `Invoice ${previousInvoice.legacy_id || previousInvoice.id} status changed from ${previousInvoice.status} to ${patch.status}`,
        type: 'finance',
        related_entity_id: id,
        related_entity_type: 'invoice',
        actor_id: actorId,
        actor_name: actorName,
        customer_id: previousInvoice.customer_id,
        metadata: {
          invoice_id: previousInvoice.legacy_id || previousInvoice.id,
          previous_status: previousInvoice.status,
          new_status: patch.status,
          customer_id: previousInvoice.customer_id
        }
      })
    }
  }, [loadInvoices, invoices, logActivity])

  const markPaid = useCallback(async (id: string, receipt: string) => {
    const invoice = invoices.find(i => i.id === id)
    await updateInvoice(id, { status: 'Payment Received', receipt, paid_date: new Date().toISOString() })
    
    // Auto-create addon requests if invoice has addon services in line_items but no addon_request_ids
    if (invoice && invoice.addon_request_ids.length === 0 && invoice.line_items) {
      const addonItems = invoice.line_items.filter((item: any) => 
        item.spec && (item.spec.includes('CPFS') || item.spec.includes('CCIS'))
      )
      
      if (addonItems.length > 0 && invoice.vm_request_ids.length > 0) {
        // Get the VM from the vm_request_id
        const { data: vm } = await supabase
          .from('vms')
          .select('id')
          .eq('vm_request_id', invoice.vm_request_ids[0])
          .single()
        
        if (vm) {
          let cpfsEnabled = false
          let cpfsPackage: 'standard' | 'premium' = 'standard'
          let ccisEnabled = false
          let ccisPackage: 'basic' | 'standard' | 'professional' | 'enterprise' = 'basic'
          
          // Parse addon items to determine which services to enable
          for (const item of addonItems) {
            if (item.spec.includes('CPFS')) {
              cpfsEnabled = true
              const parts = item.spec.split('|')
              if (parts.length > 1) {
                const pkg = parts[1].toLowerCase()
                cpfsPackage = pkg === 'premium' ? 'premium' : 'standard'
              }
            }
            if (item.spec.includes('CCIS')) {
              ccisEnabled = true
              const parts = item.spec.split('|')
              if (parts.length > 1) {
                const pkg = parts[1].toLowerCase()
                if (pkg === 'standard') ccisPackage = 'standard'
                else if (pkg === 'professional') ccisPackage = 'professional'
                else if (pkg === 'enterprise') ccisPackage = 'enterprise'
                else ccisPackage = 'basic'
              }
            }
          }
          
          // Create addon request
          if (cpfsEnabled || ccisEnabled) {
            // Get VM's start_date to match VM calculation logic
            const { data: vmData } = await supabase
              .from('vms')
              .select('start_date')
              .eq('id', vm.id)
              .single()
            
            const vmStartDate = vmData?.start_date ? new Date(vmData.start_date) : new Date()
            // Don't modify start_date - add +1 day to expiry instead

            // Calculate addon expiry using billing term (parse both months and days)
            const term = invoice.billing_term || '12'
            const monthsMatch = term.match(/(\d+)\s*months?/i)
            const daysMatch = term.match(/(\d+)\s*days?/i)

            const durationMonths = monthsMatch ? parseInt(monthsMatch[1]) : 12
            const durationDays = daysMatch ? parseInt(daysMatch[1]) : 0

            const expiryDate = new Date(vmStartDate)
            expiryDate.setMonth(expiryDate.getMonth() + durationMonths)
            expiryDate.setDate(expiryDate.getDate() + durationDays + 1) // Add 1 day to expiry
            
            await createAddonRequest({
              vm_id: vm.id,
              customer_id: invoice.customer_id,
              status: 'Completed',
              cpfs_enabled: cpfsEnabled,
              cpfs_package: cpfsEnabled ? cpfsPackage : undefined,
              ccis_enabled: ccisEnabled,
              ccis_package: ccisEnabled ? ccisPackage : undefined,
              duration: invoice.billing_term || '12',
              start_date: vmData?.start_date || new Date().toISOString(),
              end_date: expiryDate.toISOString(),
              expiry: expiryDate.toISOString(),
            })
          }
        }
      }
    }
    
    // Create notification for payment received
    if (invoice) {
      // Get current user (staff member) who marked as paid
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      let actorId = invoice.customer_id
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .maybeSingle()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
          actorId = user.id
        } else {
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || 'System'
          actorId = user.id
        }
      }
      
      await logActivity(
        `Marked invoice ${invoice.legacy_id || invoice.id} as paid - MMK ${invoice.gross_amount}`,
        'finance',
        actorName,
        { invoiceId: invoice.legacy_id || invoice.id, amount: invoice.gross_amount, customerId: invoice.customer_id, receiptNumber: receipt }
      )
      
      await createAlert({
        sev: 'info',
        title: 'Payment Received',
        body: `Payment of MMK ${invoice.gross_amount} received for invoice ${invoice.legacy_id || invoice.id}`,
        type: 'finance',
        related_entity_id: id,
        related_entity_type: 'invoice',
        actor_id: actorId,
        actor_name: actorName,
        customer_id: invoice.customer_id,
        metadata: { 
          amount: invoice.gross_amount, 
          invoice_id: invoice.legacy_id || invoice.id,
          customer_id: invoice.customer_id,
          receipt_number: receipt
        }
      })
    }
  }, [updateInvoice, invoices, logActivity])

  const cancelInvoice = useCallback(async (id: string) => {
    const invoice = invoices.find(i => i.id === id)
    await updateInvoice(id, { status: 'Cancelled' })
    
    // Create notification for invoice cancellation
    if (invoice) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      let actorName = 'System'
      let actorId = invoice.customer_id
      
      // Check if current user is a staff member
      if (user) {
        const { data: staff } = await supabase
          .from('team_members')
          .select('name, staff_code')
          .eq('user_id', user.id)
          .maybeSingle()
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`
          actorId = user.id
        } else {
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || 'System'
          actorId = user.id
        }
      }
      
      await logActivity(
        `Cancelled invoice ${invoice.legacy_id || invoice.id} - MMK ${invoice.gross_amount}`,
        'finance',
        actorName,
        { invoiceId: invoice.legacy_id || invoice.id, amount: invoice.gross_amount, customerId: invoice.customer_id }
      )
      
      await createAlert({
        sev: 'info',
        title: 'Invoice Cancelled',
        body: `Invoice ${invoice.legacy_id || invoice.id} has been cancelled - MMK ${invoice.gross_amount}`,
        type: 'finance',
        related_entity_id: id,
        related_entity_type: 'invoice',
        actor_id: actorId,
        actor_name: actorName,
        customer_id: invoice.customer_id,
        metadata: {
          invoice_id: invoice.legacy_id || invoice.id,
          amount: invoice.gross_amount,
          customer_id: invoice.customer_id
        }
      })
    }
  }, [updateInvoice, invoices, logActivity])

  const value: InvoiceStoreValue = {
    invoices,
    invoicesLoading,
    loadInvoices,
    addInvoice,
    updateInvoice,
    markPaid,
    cancelInvoice,
  }

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  )
}

const useInvoiceStore = (): InvoiceStoreValue => {
  const context = useContext(InvoiceContext)
  if (!context) throw new Error('useInvoiceStore must be used within InvoiceProvider')
  return context
}

export default useInvoiceStore