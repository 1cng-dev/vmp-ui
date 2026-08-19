import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const vmResult = await checkVMExpiry(supabase)

    const addonResult = await checkAddonExpiry(supabase)

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

async function sendExpiryEmail(params: {
  to: string
  customerName: string
  type: 'vm' | 'addon'
  entityName: string
  expiryDate: string
  daysUntilExpiry: number
  entityId: string
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  const fromName = 'One Cloud Net-Gen'

  const subject = params.daysUntilExpiry < 0
    ? `URGENT: ${params.type === 'vm' ? 'VM' : 'Add-on'} Expired - ${params.entityName}`
    : params.daysUntilExpiry === 0
      ? `URGENT: ${params.type === 'vm' ? 'VM' : 'Add-on'} Expiring Today - ${params.entityName}`
      : `Reminder: ${params.type === 'vm' ? 'VM' : 'Add-on'} Expiring in ${params.daysUntilExpiry} days`

  const html = buildEmailTemplate(params)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: params.to,
        subject: subject,
        html: html
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

function buildEmailTemplate(params: {
  customerName: string
  type: 'vm' | 'addon'
  entityName: string
  expiryDate: string
  daysUntilExpiry: number
  entityId: string
}): string {
  const urgencyText = params.daysUntilExpiry < 0
    ? `EXPIRED ${Math.abs(params.daysUntilExpiry)} days ago`
    : params.daysUntilExpiry === 0
      ? 'EXPIRING TODAY'
      : `Expiring in ${params.daysUntilExpiry} days`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { max-width: 600px; margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
        .info-box { margin: 20px 0; text-align: left; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p>Dear Valued Customer,</p>
          <div class="info-box">
            <p><strong>${params.type === 'vm' ? 'VM' : 'Add-on Service'}:</strong> ${params.entityName}</p>
            <p><strong>ID:</strong> ${params.entityId}</p>
            <p><strong>Expiry Date:</strong> ${params.expiryDate}</p>
            <p><strong>Status:</strong> ${urgencyText}</p>
          </div>
          <p>${params.daysUntilExpiry < 0
      ? 'Your service has expired. Please renew as soon as possible to avoid service interruption.'
      : params.daysUntilExpiry === 0
        ? 'Your service expires today. Please renew immediately to avoid service interruption.'
        : 'Your service will expire soon. Please renew to avoid service interruption.'}</p>
          <p>Our Portal: <a href="https://vmp.1cloudng.com">https://vmp.1cloudng.com</a></p>
        </div>
        <div class="footer">
          <p>Best Regards,<br>
          One Cloud Next-Gen Co., Ltd<br>
          support@system.1cloudng.com<br>
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;"></p>
        </div>
      </div>
    </body>
    </html>
  `
}

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
      .eq('type', 'expiry')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .limit(1)

    if (existingAlerts && existingAlerts.length > 0) continue

    // Create alerts for expiring within next 14 days or expired within last 30 days
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 14) {
      // Expiring soon
      const severity = daysUntilExpiry <= 1 ? 'urgent' : daysUntilExpiry <= 7 ? 'warn' : 'info'

      const title = daysUntilExpiry === 0
        ? `VM Expiring Today`
        : `VM Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`

      // Format expiry date for readability
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      // Build message with days
      const daysMessage = daysUntilExpiry === 0
        ? 'expiring today'
        : `expiring in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`


      // Get customer email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', vm.customer_id)
        .single()

      const insertResult = await supabase.from('alerts').insert({
        sev: severity,
        title,
        body: `VM ${vm.hostname} (${vm.legacy_id || vm.id}) is ${daysMessage}. Expiry: ${formattedExpiry}`,
        type: 'expiry',
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

      // Send email to customer
      if (customer?.email) {
        await sendExpiryEmail({
          to: customer.email,
          customerName: customer.name,
          type: 'vm',
          entityName: vm.hostname,
          expiryDate: formattedExpiry,
          daysUntilExpiry,
          entityId: vm.legacy_id || vm.id
        })
      }

      alertsCreated++
    } else if (daysUntilExpiry < 0 && daysUntilExpiry >= -30) {
      // Grace period - expired
      const severity = 'urgent'

      const title = `VM Expired - Grace Period`

      // Format expiry date for readability
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      // Build message with days
      const daysMessage = `expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) > 1 ? 's' : ''} ago`

      // Get customer email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', vm.customer_id)
        .single()

      const insertResult = await supabase.from('alerts').insert({
        sev: severity,
        title,
        body: `VM ${vm.hostname} (${vm.legacy_id || vm.id}) is ${daysMessage}. Expiry: ${formattedExpiry}`,
        type: 'expiry',
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

      // Send email to customer
      if (customer?.email) {
        await sendExpiryEmail({
          to: customer.email,
          customerName: customer.name,
          type: 'vm',
          entityName: vm.hostname,
          expiryDate: formattedExpiry,
          daysUntilExpiry,
          entityId: vm.legacy_id || vm.id
        })
      }

      alertsCreated++
    }
  }

  return { totalChecked: vms.length, alertsCreated }
}

async function checkAddonExpiry(supabase: any) {
  const { data: addons } = await supabase
    .from('addon_services')
    .select('id, legacy_id, expiry, customer_id, vm_id, cpfs_enabled, ccis_enabled, status, operational_status')
    .not('expiry', 'is', null)
    .eq('status', 'Active')
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
      .eq('related_entity_type', 'addon_service')
      .eq('type', 'expiry')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .limit(1)

    if (existingAlerts && existingAlerts.length > 0) continue

    // Create alerts for expiring within next 14 days or expired within last 30 days
    if (daysUntilExpiry >= 0 && daysUntilExpiry <= 14) {
      // Expiring soon
      const severity = daysUntilExpiry <= 1 ? 'urgent' : daysUntilExpiry <= 7 ? 'warn' : 'info'

      const title = daysUntilExpiry === 0
        ? `Add-on Service Expiring Today`
        : `Add-on Service Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`

      // Format expiry date for readability
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      // Build message with days
      const daysMessage = daysUntilExpiry === 0
        ? 'expiring today'
        : `expiring in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`

      // Get customer email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', addon.customer_id)
        .single()

      const insertResult = await supabase.from('alerts').insert({
        sev: severity,
        title,
        body: `Add-on service ${addon.legacy_id || addon.id} is ${daysMessage}. Expiry: ${formattedExpiry}`,
        type: 'expiry',
        related_entity_id: addon.id,
        related_entity_type: 'addon_service',
        actor_id: null,
        actor_name: 'System',
        customer_id: addon.customer_id,
        metadata: { addon_id: addon.legacy_id || addon.id, vm_id: addon.vm_id, expiry_date: addon.expiry, days_until_expiry: daysUntilExpiry }
      })

      if (insertResult.error) {
        console.error('Error inserting add-on alert:', insertResult.error)
        continue
      }

      // Send email to customer
      if (customer?.email) {
        await sendExpiryEmail({
          to: customer.email,
          customerName: customer.name,
          type: 'addon',
          entityName: `Add-on ${addon.legacy_id || addon.id}`,
          expiryDate: formattedExpiry,
          daysUntilExpiry,
          entityId: addon.legacy_id || addon.id
        })
      }

      alertsCreated++
    } else if (daysUntilExpiry < 0 && daysUntilExpiry >= -30) {
      // Grace period - expired
      const severity = 'urgent'

      const title = `Add-on Service Expired - Grace Period`

      // Format expiry date for readability
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      // Build message with days
      const daysMessage = `expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) > 1 ? 's' : ''} ago`

      // Get customer email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', addon.customer_id)
        .single()

      const insertResult = await supabase.from('alerts').insert({
        sev: severity,
        title,
        body: `Add-on service ${addon.legacy_id || addon.id} is ${daysMessage}. Expiry: ${formattedExpiry}`,
        type: 'expiry',
        related_entity_id: addon.id,
        related_entity_type: 'addon_service',
        actor_id: null,
        actor_name: 'System',
        customer_id: addon.customer_id,
        metadata: { addon_id: addon.legacy_id || addon.id, vm_id: addon.vm_id, expiry_date: addon.expiry, days_until_expiry: daysUntilExpiry }
      })

      if (insertResult.error) {
        console.error('Error inserting add-on alert:', insertResult.error)
        continue
      }

      // Send email to customer
      if (customer?.email) {
        await sendExpiryEmail({
          to: customer.email,
          customerName: customer.name,
          type: 'addon',
          entityName: `Add-on ${addon.legacy_id || addon.id}`,
          expiryDate: formattedExpiry,
          daysUntilExpiry,
          entityId: addon.legacy_id || addon.id
        })
      }

      alertsCreated++
    }
  }

  return { totalChecked: addons.length, alertsCreated }
}