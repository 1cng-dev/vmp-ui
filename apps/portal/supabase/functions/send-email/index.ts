import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve(async (req) => {
  try {
    const { to, subject, html, from, attachments } = await req.json()

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = from || Deno.env.get('RESEND_FROM_EMAIL')

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body: any = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html
    }

    if (attachments && attachments.length > 0) {
      body.attachments = attachments
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return new Response(
        JSON.stringify({ success: false, error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})