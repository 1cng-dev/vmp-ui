-- Enable Realtime for tickets table to allow live updates in support tickets
alter publication supabase_realtime add table public.tickets;

-- Enable Realtime for ticket_replies table to allow live updates in support ticket replies
alter publication supabase_realtime add table public.ticket_replies;
