import { supabase } from '../lib/supabase'
import { createAlert } from './notificationService'

interface VMExpiryCheckResult {
  totalChecked: number
  alertsCreated: number
  details: string[]
}

/**
 * Check VM expiry and create alerts for different time thresholds
 * This should be called periodically (e.g., daily via cron job or scheduled task)
 */
export async function checkVMExpiry(): Promise<VMExpiryCheckResult> {
  const result: VMExpiryCheckResult = {
    totalChecked: 0,
    alertsCreated: 0,
    details: []
  }

  try {
    // Get all active VMs with expiry dates
    const { data: vms, error } = await supabase
      .from('vms')
      .select('id, hostname, expiry, customer_id, legacy_id, status')
      .not('expiry', 'is', null)
      .in('status', ['Active', 'Provisioning'])

    if (error) {
      console.error('Error fetching VMs for expiry check:', error)
      throw error
    }

    if (!vms || vms.length === 0) {
      result.details.push('No VMs with expiry dates found')
      return result
    }

    result.totalChecked = vms.length
    const now = new Date()

    for (const vm of vms) {
      if (!vm.expiry) continue

      const expiryDate = new Date(vm.expiry)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Check if alert already exists for this VM and threshold
      const alertExists = await checkAlertExists(vm.id, daysUntilExpiry)
      if (alertExists) {
        result.details.push(`Alert already exists for VM ${vm.hostname} (${daysUntilExpiry} days)`)
        continue
      }

      // Create alerts based on days until expiry
      if (daysUntilExpiry === 30) {
        await createExpiryAlert(vm, 30, '30 days before expiry')
        result.alertsCreated++
        result.details.push(`Created 30-day alert for VM ${vm.hostname}`)
      } else if (daysUntilExpiry === 7) {
        await createExpiryAlert(vm, 7, '7 days before expiry')
        result.alertsCreated++
        result.details.push(`Created 7-day alert for VM ${vm.hostname}`)
      } else if (daysUntilExpiry === 1) {
        await createExpiryAlert(vm, 1, '1 day before expiry')
        result.alertsCreated++
        result.details.push(`Created 1-day alert for VM ${vm.hostname}`)
      } else if (daysUntilExpiry === 0) {
        await createExpiryAlert(vm, 0, 'expired today')
        result.alertsCreated++
        result.details.push(`Created expiry-day alert for VM ${vm.hostname}`)
      } else if (daysUntilExpiry < 0 && daysUntilExpiry >= -7) {
        // Grace period: 0 to 7 days after expiry
        await createExpiryAlert(vm, daysUntilExpiry, `in grace period (${Math.abs(daysUntilExpiry)} days overdue)`)
        result.alertsCreated++
        result.details.push(`Created grace period alert for VM ${vm.hostname}`)
      }
    }

    return result
  } catch (error) {
    console.error('Error in VM expiry check:', error)
    throw error
  }
}

/**
 * Check if an alert already exists for this VM and threshold
 */
async function checkAlertExists(vmId: string, daysUntilExpiry: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id, body')
    .eq('related_entity_id', vmId)
    .eq('related_entity_type', 'vm')
    .eq('type', 'vm')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .limit(1)

  if (error) {
    console.error('Error checking existing alerts:', error)
    return false
  }

  // Check if the alert body contains the same threshold
  if (data && data.length > 0) {
    const alertBody = (data[0] as any).body || ''
    if (daysUntilExpiry === 30 && alertBody.includes('30 days')) return true
    if (daysUntilExpiry === 7 && alertBody.includes('7 days')) return true
    if (daysUntilExpiry === 1 && alertBody.includes('1 day')) return true
    if (daysUntilExpiry === 0 && alertBody.includes('expired today')) return true
    if (daysUntilExpiry < 0 && alertBody.includes('grace period')) return true
  }

  return false
}

/**
 * Create an expiry alert for a VM
 */
async function createExpiryAlert(vm: any, daysUntilExpiry: number, timeframe: string): Promise<void> {
  // Get customer name
  const { data: customer } = await supabase
    .from('customers')
    .select('name, org_name, account_type')
    .eq('id', vm.customer_id)
    .single()

  const customerName = customer?.account_type === 'Organization' && customer?.org_name
    ? `${customer.name} (${customer.org_name})`
    : (customer?.name || 'Unknown')

  // Determine severity based on urgency
  let severity: 'info' | 'warn' | 'urgent' = 'info'
  if (daysUntilExpiry <= 1 && daysUntilExpiry >= 0) {
    severity = 'urgent'
  } else if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
    severity = 'warn'
  } else if (daysUntilExpiry < 0) {
    severity = 'urgent'
  }

  const title = daysUntilExpiry < 0 
    ? 'VM Expired - Grace Period'
    : daysUntilExpiry === 0
    ? 'VM Expiring Today'
    : `VM Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`

  const body = `VM ${vm.hostname} (${vm.legacy_id || vm.id}) for ${customerName} is ${timeframe}. Expiry date: ${new Date(vm.expiry).toLocaleDateString()}`

  await createAlert({
    sev: severity,
    title,
    body,
    type: 'vm',
    related_entity_id: vm.id,
    related_entity_type: 'vm',
    actor_id: 'system',
    actor_name: 'System',
    metadata: {
      vm_id: vm.legacy_id || vm.id,
      hostname: vm.hostname,
      customer_id: vm.customer_id,
      expiry_date: vm.expiry,
      days_until_expiry: daysUntilExpiry,
      timeframe
    }
  })
}

/**
 * Manual trigger for testing - checks expiry for a specific VM
 */
export async function checkSingleVMExpiry(vmId: string): Promise<any> {
  const { data: vm, error } = await supabase
    .from('vms')
    .select('id, hostname, expiry, customer_id, legacy_id, status')
    .eq('id', vmId)
    .single()

  if (error || !vm) {
    throw new Error('VM not found')
  }

  if (!vm.expiry) {
    return { message: 'VM has no expiry date set' }
  }

  const now = new Date()
  const expiryDate = new Date(vm.expiry)
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    vm: vm.hostname,
    expiry: vm.expiry,
    days_until_expiry: daysUntilExpiry,
    status: daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry === 0 ? 'expiring today' : 'active'
  }
}
