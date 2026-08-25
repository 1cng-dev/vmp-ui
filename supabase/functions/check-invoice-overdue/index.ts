import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Query all pending invoices
    const { data: invoices, error: queryError } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'Pending')
      .not('due', 'is', null)

    if (queryError) {
      console.error('Error querying invoices:', queryError)
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending invoices to check', updated: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get today's date
    const today = new Date()

    // Filter invoices where due date is past
    const overdueInvoices = invoices.filter(inv => {
      const dueDate = new Date(inv.due)
      return dueDate < today
    })

    if (overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No overdue invoices found', updated: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Update status to 'Overdue' and send notifications
    let updatedCount = 0
    for (const invoice of overdueInvoices) {
      // Deduplication: check if alert already created today for this invoice
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: existingAlerts } = await supabase
        .from('alerts')
        .select('id')
        .eq('related_entity_id', invoice.id)
        .eq('related_entity_type', 'invoice')
        .eq('type', 'finance')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .limit(1)

      // Update status to Overdue
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'Overdue' })
        .eq('id', invoice.id)

      if (updateError) {
        console.error(`Error updating invoice ${invoice.id}:`, updateError)
        continue
      }

      updatedCount++

      // Skip alert + email if already sent today
      if (existingAlerts && existingAlerts.length > 0) continue

      // Get customer email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', invoice.customer_id)
        .single()

      // Create alert
      const formattedDue = new Date(invoice.due).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      const { error: alertError } = await supabase.from('alerts').insert({
        sev: 'urgent',
        title: `Invoice Overdue`,
        body: `Invoice ${invoice.legacy_id || invoice.id} is overdue. Due date: ${formattedDue}`,
        type: 'finance',
        related_entity_id: invoice.id,
        related_entity_type: 'invoice',
        actor_id: null,
        actor_name: 'System',
        customer_id: invoice.customer_id,
        metadata: { invoice_id: invoice.legacy_id || invoice.id, due_date: invoice.due, status: 'Overdue' }
      })

      if (alertError) {
        console.error('Error inserting overdue alert:', alertError)
      }

      // Send email to customer
      if (customer?.email) {
        await sendOverdueEmail({
          to: customer.email,
          customerName: customer.name,
          invoiceId: invoice.legacy_id || invoice.id,
          amount: invoice.gross_amount,
          dueDate: invoice.due
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${updatedCount} invoices to Overdue status`,
        updated: updatedCount
      }),
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

async function sendOverdueEmail(params: {
  to: string
  customerName: string
  invoiceId: string
  amount: number
  dueDate: string
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  const fromName = 'One Cloud Net-Gen'

  const html = buildOverdueEmailTemplate(params)

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
        subject: `Invoice Overdue - ${params.invoiceId}`,
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

function buildOverdueEmailTemplate(params: {
  customerName: string
  invoiceId: string
  amount: number
  dueDate: string
}): string {
  const formattedAmount = new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK'
  }).format(params.amount)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p>Dear Valued Customer,</p>
          <p>This is a reminder regarding your overdue and unpaid invoice.</p>
          <p>Bill Due Date is ${new Date(params.dueDate).toLocaleDateString()}.</p>
          <p>I have attached a copy of the invoice for your reference. We kindly request you to settle the outstanding amount at the earliest.</p>
          <p>If you have any questions regarding the outstanding balance, please do not hesitate to contact us at finance@1cloudng.com.</p>
          <p>Thanks,</p>
          <p>One Cloud Next-Gen</p>
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;">
        </div>
      </div>
    </body>
    </html>
  `
}
