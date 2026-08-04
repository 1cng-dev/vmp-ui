-- =============================================================
-- SECURITY FIX: privilege escalation via client-writable user_metadata
-- =============================================================
--
-- public.jwt_role() read the app-level role straight from the session JWT's
-- user_metadata claim:
--
--   select (current_setting('request.jwt.claims', true)::jsonb
--            -> 'user_metadata' ->> 'role')::text
--
-- user_metadata is client-writable — any authenticated customer can call
-- supabase.auth.updateUser({ data: { role: 'Admin' } }) from the browser.
-- On their next token refresh (automatic; the portal's client has
-- autoRefreshToken: true), their JWT carries user_metadata.role = 'Admin',
-- and every RLS policy built on is_admin()/is_staff() — effectively the
-- entire schema (team_members, customers, vms, vm_ownership, vm_requests,
-- tickets, invoices, receipts, announcements, quotes, addon_requests, ...) —
-- treats them as staff/admin. This requires no backend involvement at all;
-- it's exploitable directly against Supabase's REST API with the anon key.
--
-- Fix: jwt_role() now resolves role from public.team_members (writable only
-- by an existing admin — see the team_members RLS policies) instead of the
-- JWT claim. Same function name/signature, so every existing policy built on
-- is_admin()/is_staff() is fixed without being individually rewritten.
-- Customers (no team_members row) keep resolving to 'Customer', matching
-- today's behavior for legitimate customer accounts. security definer avoids
-- any RLS self-recursion when this runs as part of evaluating team_members'
-- own policies (same pattern already used by public.log_team_member_change()
-- in this schema).
create or replace function public.jwt_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.team_members where user_id = auth.uid() and status = 'Active'),
    'Customer'
  )
$$;

-- Bonus fix found during this audit, same file/area: these three
-- addon_services policies checked `auth.jwt() ->> 'role'`, which is the
-- Postgres/PostgREST role claim ('authenticated' | 'anon' | 'service_role'),
-- never the app-level role — so they always evaluated false and silently
-- blocked staff from managing addon_services via RLS. Not an escalation risk
-- (the opposite: over-restrictive), but cheap to correct while in here.
drop policy if exists "Team can view all addon services" on public.addon_services;
create policy "Team can view all addon services"
  on public.addon_services for select
  using (public.is_staff());

drop policy if exists "Team can insert addon services" on public.addon_services;
create policy "Team can insert addon services"
  on public.addon_services for insert
  with check (public.is_staff());

drop policy if exists "Team can update addon services" on public.addon_services;
create policy "Team can update addon services"
  on public.addon_services for update
  using (public.is_staff());
