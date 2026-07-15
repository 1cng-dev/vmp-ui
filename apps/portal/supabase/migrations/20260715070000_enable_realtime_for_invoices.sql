-- Enable Realtime for invoices table to allow live updates in admin and customer portals
alter publication supabase_realtime add table public.invoices;
