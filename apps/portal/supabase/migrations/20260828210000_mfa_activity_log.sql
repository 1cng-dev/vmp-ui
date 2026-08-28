-- Allow the GoTrue MFA hook to write audit rows to the existing activity_log table
GRANT INSERT ON public.activity_log TO supabase_auth_admin;

-- Add an RLS policy so the GoTrue hook role can actually insert
DROP POLICY IF EXISTS "Auth admin can insert activity logs" ON public.activity_log;
CREATE POLICY "Auth admin can insert activity logs" ON public.activity_log
  FOR INSERT TO supabase_auth_admin
  WITH CHECK (true);
