import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const vmResult = await checkVMExpiry(supabase)
    console.log('VM expiry check:', vmResult)

    const addonResult = await checkAddonExpiry(supabase)
    console.log('Add-on expiry check:', addonResult)

    return new Response(
      JSON.stringify({ success: true, vm: vmResult, addon: addonResult }), 
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function checkVMExpiry(supabase: any) {
  const { data: vms } = await supabase
    .from('vms')
    .select('id, hostname, expiry, customer_id, legacy_id, status')
    .not('expiry', 'is', null)
    .in('status', ['Active', 'Provisioning'])

  if (!vms) return { totalChecked: 0, alertsCreated: 0 }

  const now = new Date()
  let alertsCreated = 0

  for (const vm of vms) {
    if (!vm.expiry) continue

    const expiryDate = new Date(vm.expiry)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Check duplicate for same day only (not 24 hours)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: existingAlerts } = await supabase
      .from('alerts')
      .select('id')
      .eq('related_entity_id', vm.id)
      .eq('related_entity_type', 'vm')
      .eq('type', 'vm')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .limit(1)

    if (existingAlerts && existingAlerts.length > 0) continue

    // Create alerts at specific thresholds: 14, 7, 1, 0 days and grace period
    if (daysUntilExpiry === 14 || daysUntilExpiry === 7 || daysUntilExpiry === 1 || 
        daysUntilExpiry === 0 || (daysUntilExpiry < 0 && daysUntilExpiry >= -30)) {
      
      const severity = daysUntilExpiry <= 1 || daysUntilExpiry < 0 ? 'urgent' : 
                      daysUntilExpiry === 7 ? 'warn' : 'info'

      const title = daysUntilExpiry < 0 
        ? `VM Expired - Grace Period`
        : daysUntilExpiry === 0
        ? `VM Expiring Today`
        : `VM Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`

      // Format expiry date for readability
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })

      // Build message with days
      const daysMessage = daysUntilExpiry < 0 
        ? `expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) > 1 ? 's' : ''} ago`
        : daysUntilExpiry === 0 
        ? 'expiring today'
        : `expiring in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`

      const insertResult = await supabase.from('alerts').insert({
        sev: severity,
        title,
        body: `VM ${vm.hostname} (${vm.legacy_id || vm.id}) is ${daysMessage}. Expiry: ${formattedExpiry}`,
        type: 'vm',
        related_entity_id: vm.id,
        related_entity_type: 'vm',
        actor_id: null,
        actor_name: 'System',
        customer_id: vm.customer_id,
        metadata: { vm_id: vm.legacy_id || vm.id, hostname: vm.hostname, expiry_date: vm.expiry, days_until_expiry: daysUntilExpiry }
      })

      if (insertResult.error) {
        console.error('Error inserting VM alert:', insertResult.error)
        continue
      }
      alertsCreated++
    }
  }

  return { totalChecked: vms.length, alertsCreated }
}

async function checkAddonExpiry(supabase: any) {
  const { data: addons } = await supabase
    .from('addon_requests')
    .select('id, legacy_id, expiry, customer_id, vm_id, cpfs_enabled, ccis_enabled, status, operational_status')
    .not('expiry', 'is', null)
    .eq('status', 'Completed')
    .neq('operational_status', 'Terminated')

  if (!addons) return { totalChecked: 0, alertsCreated: 0 }

  const now = new Date()
  let alertsCreated = 0

  for (const addon of addons) {
    if (!addon.expiry) continue

    const expiryDate = new Date(addon.expiry)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Check duplicate for same day only (not 24 hours)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: existingAlerts } = await supabase
      .from('alerts')
      .select('id')
      .eq('related_entity_id', addon.id)
      .eq('related_entity_type', 'addon_request')
      .eq('type', 'expiry')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .limit(1)

    if (existingAlerts && existingAlerts.length > 0) continue

    // Create alerts at specific thresholds: 14, 7, 1, 0 days and grace period
    if (daysUntilExpiry === 14 || daysUntilExpiry === 7 || daysUntilExpiry === 1 || 
        daysUntilExpiry === 0 || (daysUntilExpiry < 0 && daysUntilExpiry >= -30)) {
      
      const severity = daysUntilExpiry <= 1 || daysUntilExpiry < 0 ? 'urgent' : 
                      daysUntilExpiry === 7 ? 'warn' : 'info'

      const title = daysUntilExpiry < 0 
        ? `Add-on Service Expired - Grace Period`
        : daysUntilExpiry === 0
        ? `Add-on Service Expiring Today`
        : `Add-on Service Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`

      // Format expiry date for readability
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })

      // Build message with days
      const daysMessage = daysUntilExpiry < 0 
        ? `expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) > 1 ? 's' : ''} ago`
        : daysUntilExpiry === 0 
        ? 'expiring today'
        : `expiring in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`

      const insertResult = await supabase.from('alerts').insert({
        sev: severity,
        title,
        body: `Add-on service ${addon.legacy_id || addon.id} is ${daysMessage}. Expiry: ${formattedExpiry}`,
        type: 'expiry',
        related_entity_id: addon.id,
        related_entity_type: 'addon_request',
        actor_id: null,
        actor_name: 'System',
        customer_id: addon.customer_id,
        metadata: { addon_id: addon.legacy_id || addon.id, vm_id: addon.vm_id, expiry_date: addon.expiry, days_until_expiry: daysUntilExpiry }
      })

      if (insertResult.error) {
        console.error('Error inserting add-on alert:', insertResult.error)
        continue
      }
      alertsCreated++
    }
  }

  return { totalChecked: addons.length, alertsCreated }
}