import { supabase } from '../lib/supabase'
import { createAlert } from './notificationService'

interface AddonExpiryCheckResult {
  totalChecked: number
  alertsCreated: number
  details: string[]
}

/**
 * Check add-on service expiry and create alerts for different time thresholds
 * This should be called periodically (e.g., daily via cron job or scheduled task)
 */
export async function checkAddonExpiry(): Promise<AddonExpiryCheckResult> {
  const result: AddonExpiryCheckResult = {
    totalChecked: 0,
    alertsCreated: 0,
    details: []
  }

  try {
    // Get all completed add-on requests with expiry dates, excluding terminated ones
    const { data: addons, error } = await supabase
      .from('addon_requests')
      .select('id, legacy_id, expiry, customer_id, vm_id, cpfs_enabled, ccis_enabled, status, operational_status')
      .not('expiry', 'is', null)
      .eq('status', 'Completed')
      .neq('operational_status', 'Terminated')

    if (error) {
      console.error('Error fetching add-on requests for expiry check:', error)
      throw error
    }

    if (!addons || addons.length === 0) {
      result.details.push('No add-on requests with expiry dates found')
      return result
    }

    result.totalChecked = addons.length
    const now = new Date()

    for (const addon of addons) {
      if (!addon.expiry) continue

      const expiryDate = new Date(addon.expiry)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Check if alert already exists for this add-on and threshold
      const alertExists = await checkAlertExists(addon.id)
      if (alertExists) {
        result.details.push(`Alert already exists for add-on ${addon.legacy_id || addon.id} (${daysUntilExpiry} days)`)
        continue
      }

      // Create alerts based on days until expiry
      if (daysUntilExpiry === 14) {
        await createExpiryAlert(addon, 14, '14 days before expiry')
        result.alertsCreated++
        result.details.push(`Created 14-day alert for add-on ${addon.legacy_id || addon.id}`)
      } else if (daysUntilExpiry === 7) {
        await createExpiryAlert(addon, 7, '7 days before expiry')
        result.alertsCreated++
        result.details.push(`Created 7-day alert for add-on ${addon.legacy_id || addon.id}`)
      } else if (daysUntilExpiry === 1) {
        await createExpiryAlert(addon, 1, '1 day before expiry')
        result.alertsCreated++
        result.details.push(`Created 1-day alert for add-on ${addon.legacy_id || addon.id}`)
      } else if (daysUntilExpiry === 0) {
        await createExpiryAlert(addon, 0, 'expired today')
        result.alertsCreated++
        result.details.push(`Created expiry-day alert for add-on ${addon.legacy_id || addon.id}`)
      } else if (daysUntilExpiry < 0 && daysUntilExpiry >= -30) {
        // Grace period: 0 to 30 days after expiry (send daily notifications)
        await createExpiryAlert(addon, daysUntilExpiry, `in grace period (${Math.abs(daysUntilExpiry)} days overdue)`)
        result.alertsCreated++
        result.details.push(`Created grace period alert for add-on ${addon.legacy_id || addon.id}`)
      }
    }

    return result
  } catch (error) {
    console.error('Error in add-on expiry check:', error)
    throw error
  }
}

/**
 * Check if an alert already exists for this add-on and threshold
 */
async function checkAlertExists(addonId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id, body')
    .eq('related_entity_id', addonId)
    .eq('related_entity_type', 'addon_request')
    .eq('type', 'addon')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .limit(1)

  if (error) {
    console.error('Error checking existing alerts:', error)
    return false
  }

  // For daily notifications, if an alert exists in the last 24 hours, skip creating a new one
  // This prevents duplicate alerts for the same day
  if (data && data.length > 0) {
    return true
  }

  return false
}

/**
 * Create an expiry alert for an add-on service
 */
async function createExpiryAlert(addon: any, daysUntilExpiry: number, timeframe: string): Promise<void> {
  // Get customer name
  const { data: customer } = await supabase
    .from('customers')
    .select('name, org_name, account_type')
    .eq('id', addon.customer_id)
    .single()

  const customerName = customer?.account_type === 'Organization' && customer?.org_name
    ? `${customer.name} (${customer.org_name})`
    : (customer?.name || 'Unknown')

  // Get VM hostname
  const { data: vm } = await supabase
    .from('vms')
    .select('hostname, legacy_id')
    .eq('id', addon.vm_id)
    .single()

  const vmHostname = vm?.hostname || 'Unknown VM'
  const vmLegacyId = vm?.legacy_id || addon.vm_id

  // Build service names
  const services: string[] = []
  if (addon.cpfs_enabled) services.push('CPFS')
  if (addon.ccis_enabled) services.push('CCIS')
  const serviceName = services.length > 0 ? services.join(' + ') : 'Add-on service'

  // Determine severity based on urgency
  let severity: 'info' | 'warn' | 'urgent' = 'info'
  if (daysUntilExpiry <= 1 && daysUntilExpiry >= 0) {
    severity = 'urgent'
  } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 1) {
    severity = 'warn'
  } else if (daysUntilExpiry === 14) {
    severity = 'info'
  } else if (daysUntilExpiry < 0) {
    severity = 'urgent'
  }

  const title = daysUntilExpiry < 0
    ? 'Add-on Service Expired - Grace Period'
    : daysUntilExpiry === 0
    ? 'Add-on Service Expiring Today'
    : `Add-on Service Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`

  const body = `${serviceName} for VM ${vmHostname} (${vmLegacyId}) for ${customerName} is ${timeframe}. Add-on ID: ${addon.legacy_id || addon.id}. Expiry date: ${new Date(addon.expiry).toLocaleDateString()}`

  await createAlert({
    sev: severity,
    title,
    body,
    type: 'addon',
    related_entity_id: addon.id,
    related_entity_type: 'addon_request',
    actor_id: 'system',
    actor_name: 'System',
    customer_id: addon.customer_id,
    metadata: {
      addon_id: addon.legacy_id || addon.id,
      vm_id: addon.vm_id,
      vm_hostname: vmHostname,
      customer_id: addon.customer_id,
      expiry_date: addon.expiry,
      days_until_expiry: daysUntilExpiry,
      timeframe,
      services
    }
  })
}

/**
 * Manual trigger for testing - checks expiry for a specific add-on service
 */
export async function checkSingleAddonExpiry(addonId: string): Promise<any> {
  const { data: addon, error } = await supabase
    .from('addon_requests')
    .select('id, legacy_id, expiry, customer_id, vm_id, cpfs_enabled, ccis_enabled, status')
    .eq('id', addonId)
    .single()

  if (error || !addon) {
    throw new Error('Add-on request not found')
  }

  if (!addon.expiry) {
    return { message: 'Add-on request has no expiry date set' }
  }

  const now = new Date()
  const expiryDate = new Date(addon.expiry)
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return {
    addon_id: addon.legacy_id || addon.id,
    expiry: addon.expiry,
    days_until_expiry: daysUntilExpiry,
    status: daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry === 0 ? 'expiring today' : 'active'
  }
}
