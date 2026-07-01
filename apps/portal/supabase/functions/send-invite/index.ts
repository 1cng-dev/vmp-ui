import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const resendApiKey = Deno.env.get('RESEND_API_KEY')!
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
const fromName = Deno.env.get('RESEND_FROM_NAME')!

interface InviteRequest {
  email: string
  name: string
  role: string
  team: string
  inviteToken: string
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  try {
    const { email, name, role, team, inviteToken }: InviteRequest = await req.json()
    
    const inviteUrl = `${Deno.env.get('APP_URL')}/setup-password?token=${inviteToken}`
    
    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: ['ayezinhtun9@gmail.com'], // Always send to admin email for testing
      subject: `Invite for ${email} - VPS Myanmar Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">New Team Member Invite</h2>
          <p><strong>Recipient:</strong> ${email}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Team:</strong> ${team}</p>
          <p><strong>Role:</strong> ${role}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p>Hi ${name},</p>
          <p>You've been invited to join the <strong>${team}</strong> team as a <strong>${role}</strong>.</p>
          <p>Click the button below to accept your invitation and set up your account:</p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This link will expire in 7 days. If you didn't expect this invitation, please ignore this email.
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 11px;">
            Admin: Please forward this email to <strong>${email}</strong>
          </p>
        </div>
      `,
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailContent),
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Resend error: ${error}`)
    }

    const result = await response.json()
    
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: 200,
    })
  } catch (error) {
    console.error('Error in send-invite function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: 500,
    })
  }
})