-- Enable Realtime for the customers table to allow live updates
alter publication supabase_realtime add table public.customers;
