-- =============================================================
-- ANNOUNCEMENTS TABLE (broadcast messages to all customers)
-- =============================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'Draft' check (status in ('Draft', 'Sent')),
  sent_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add updated_at trigger
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row
  execute procedure public.set_updated_at();

-- Enable RLS
alter table public.announcements enable row level security;

-- RLS Policies
-- Staff (Admin, Sales, Engineer, Finance) can read all announcements
create policy "Staff can read all announcements"
  on public.announcements for select
  to authenticated
  using (public.is_staff());

-- Staff can insert announcements
create policy "Staff can insert announcements"
  on public.announcements for insert
  to authenticated
  with check (public.is_staff());

-- Staff can update announcements
create policy "Staff can update announcements"
  on public.announcements for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Staff can delete announcements
create policy "Staff can delete announcements"
  on public.announcements for delete
  to authenticated
  using (public.is_staff());

-- Customers can only read sent announcements
create policy "Customers can read sent announcements"
  on public.announcements for select
  to authenticated
  using (
    public.jwt_role() = 'Customer' and status = 'Sent'
  );

-- Enable real-time for announcements
alter publication supabase_realtime add table public.announcements;
