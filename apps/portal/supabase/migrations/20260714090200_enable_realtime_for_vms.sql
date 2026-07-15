-- Enable Realtime for the vms table to allow live updates
-- This enables the application to receive real-time changes without page refresh

alter publication supabase_realtime add table public.vms;
