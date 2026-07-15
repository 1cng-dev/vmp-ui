-- Enable Realtime for activity_log table to allow live updates in admin dashboard
alter publication supabase_realtime add table public.activity_log;


alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.ticket_replies;