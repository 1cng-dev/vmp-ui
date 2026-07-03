import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  const { email, userType } = await req.json()
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  
  if (error) {
    return new Response(JSON.stringify({ error: 'Unable to process password reset request' }), { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    })
  }
  
  const user = users.find(u => u.email === email)
  
  if (!user) {
    return new Response(JSON.stringify({ valid: false, reason: 'Unable to process password reset request' }), { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    })
  }
  
  const userRole = user.user_metadata?.role || 'Customer'
  const allowedCustomerRoles = ['Customer']
  const allowedTeamRoles = ['Admin', 'Sales', 'Engineer', 'Finance']
  
  if (userType === 'customer' && !allowedCustomerRoles.includes(userRole)) {
    return new Response(JSON.stringify({ valid: false, reason: 'Unable to process password reset request' }), { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    })
  }
  
  if (userType === 'team' && !allowedTeamRoles.includes(userRole)) {
    return new Response(JSON.stringify({ valid: false, reason: 'Unable to process password reset request' }), { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    })
  }
  
  return new Response(JSON.stringify({ valid: true }), { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    }
  })
})