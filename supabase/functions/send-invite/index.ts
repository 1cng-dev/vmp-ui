import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const resendApiKey = Deno.env.get('RESEND_API_KEY')!
const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
const fromName = Deno.env.get('RESEND_FROM_NAME') || 'VMP Portal'

interface InviteRequest {
  email: string
  name: string
  role: string
  team: string
  inviteToken: string
  inviteLink?: string
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
    const { email, name, role, team, inviteToken, inviteLink }: InviteRequest = await req.json()
    
    // Use the provided inviteLink if available, otherwise construct it
    const inviteUrl = inviteLink || `${Deno.env.get('APP_URL') || 'http://localhost:5173'}/setup-password?token=${inviteToken}`
    
    console.log('Sending invite email to:', email)
    console.log('Invite URL:', inviteUrl)
    
    const emailContent = {
      from: `${fromName} <${fromEmail}>`,
      to: [email], // Send to the actual recipient
      subject: `You're invited to join the ${team} team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151;">Hi ${name},</p>
            <p style="font-size: 16px; color: #374151;">You've been invited to join the <strong>${team}</strong> team as a <strong>${role}</strong>.</p>
            <p style="font-size: 16px; color: #374151;">Click the button below to set up your account and get started.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Set Up Your Account
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #6b7280; word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${inviteUrl}</p>
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">This link will expire in 7 days.</p>
          </div>
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
      console.error('Resend error:', error)
      throw new Error(`Resend error: ${error}`)
    }

    const result = await response.json()
    console.log('Email sent successfully:', result)
    
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: 200,
    })
  } catch (error: any) {
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
