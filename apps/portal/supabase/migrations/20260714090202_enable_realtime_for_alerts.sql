-- Enable Realtime for the alerts table to allow live updates
alter publication supabase_realtime add table public.alerts;
