import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: invoices, error: queryError } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'Pending')
      .not('due', 'is', null)

    if (queryError) {
      console.error('Error querying invoices:', queryError)
      return new Response(JSON.stringify({ success: false, error: queryError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending invoices', sent: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const today = new Date()
    let sent = 0

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.due)
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Remind daily from 3 days before up to the due date
      if (daysUntil < 0 || daysUntil > 3) continue

      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('related_entity_id', invoice.id)
        .eq('related_entity_type', 'invoice')
        .eq('type', 'finance')
        .eq('title', 'Payment Due Date Reminder')
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString())
        .limit(1)

      if (existing && existing.length > 0) continue

      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', invoice.customer_id)
        .single()

      const formattedDue = dueDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })

      const daysMessage =
        daysUntil === 0
          ? 'due today'
          : `due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`

      const { error: alertError } = await supabase.from('alerts').insert({
        sev: daysUntil <= 1 ? 'urgent' : 'warn',
        title: 'Payment Due Date Reminder',
        body: `Invoice ${invoice.legacy_id || invoice.id} is ${daysMessage}. Due: ${formattedDue}`,
        type: 'finance',
        related_entity_id: invoice.id,
        related_entity_type: 'invoice',
        actor_id: null,
        actor_name: 'System',
        customer_id: invoice.customer_id,
        metadata: {
          invoice_id: invoice.legacy_id || invoice.id,
          due_date: invoice.due,
          days_until_due: daysUntil
        }
      })

      if (alertError) {
        console.error('Error inserting alert:', alertError)
      }

      if (customer?.email) {
        await sendDueSoonEmail({
          to: customer.email,
          customerName: customer.name,
          invoiceId: invoice.legacy_id || invoice.id,
          dueDate: formattedDue,
          amount: invoice.gross_amount,
          daysUntil
        })
        sent++
      }
    }

    return new Response(JSON.stringify({ success: true, message: `Sent ${sent} reminders`, sent }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

async function sendDueSoonEmail(params: {
  to: string
  customerName: string
  invoiceId: string
  dueDate: string
  amount: number
  daysUntil: number
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  const fromName = 'One Cloud Net-Gen'

  const formattedAmount = new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK'
  }).format(params.amount)

  const daysText =
    params.daysUntil === 0
      ? 'Due today'
      : `Due in ${params.daysUntil} day${params.daysUntil > 1 ? 's' : ''}`

  const html = `
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
          <p>Payment Due Date Reminder</p>
          <p>This is a reminder that your invoice payment is due soon.</p>
          <p>
            <strong>Invoice No:</strong> ${params.invoiceId}<br>
            <strong>Due Date:</strong> ${params.dueDate}<br>
            <strong>Amount Due:</strong> ${formattedAmount}
          </p>
          <p>If payment has already been made, please ignore this email.</p>
          <p>Thanks,</p>
          <p>One Cloud Next-Gen</p>
        </div>
        <div class="footer">
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;">
        </div>
      </div>
    </body>
    </html>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject: `${daysText} - Invoice ${params.invoiceId}`,
      html
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Resend API error:', error)
  }
}