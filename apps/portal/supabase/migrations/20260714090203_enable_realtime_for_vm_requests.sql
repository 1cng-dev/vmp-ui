-- Enable Realtime for vm_requests table to allow live updates
-- This fixes the issue where sales portal doesn't get real-time updates for customer requests
alter publication supabase_realtime add table public.vm_requests;


alter publication supabase_realtime add table public.quotes;


alter publication supabase_realtime add table public.addon_requests;