// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 })
  }

  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
    if (userErr || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { userId } = await req.json()

    const role = user.user_metadata?.role || ''
    const allowed = ['Admin', 'Engineer', 'Sales', 'Finance']
    if (!allowed.includes(role)) {
      return new Response('Forbidden', { status: 403 })
    }

    const baseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const factorsUrl = `${baseUrl}/auth/v1/admin/users/${userId}/factors`
    const headers = {
      'apikey': anonKey,
      'Authorization': `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    }

    const listRes = await fetch(factorsUrl, { headers })
    const listText = await listRes.text()
    if (!listRes.ok) {
      console.error('list factors failed:', listRes.status, listText)
      return new Response(JSON.stringify({ error: listText }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const data = JSON.parse(listText)
    const factors = Array.isArray(data) ? data : data.factors || []

    for (const f of factors) {
      const delRes = await fetch(`${factorsUrl}/${f.id}`, { method: 'DELETE', headers })
      const delText = await delRes.text()
      if (!delRes.ok) {
        console.error('delete factor failed:', delRes.status, delText)
        return new Response(JSON.stringify({ error: delText }), { status: 500, headers: { 'Content-Type': 'application/json' } })
      }
    }

    try {
      await supabaseAdmin.from('activity_log').insert({
        actor: user.email || user.id,
        actor_role: role.toLowerCase(),
        kind: 'auth',
        text: `Admin removed 2FA for user ${userId}`,
        meta: {
          target_user_id: userId,
          event: 'mfa_admin_reset',
          admin_email: user.email
        }
      })
    } catch (err) {
      console.error('activity log insert error:', err)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
