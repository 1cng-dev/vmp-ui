-- Create receipts table
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  legacy_id varchar(16) unique not null,
  receipt_number varchar(20) unique not null,
  message text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.team_members(user_id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_receipts_invoice on public.receipts(invoice_id);
create index if not exists idx_receipts_customer on public.receipts(customer_id);
create index if not exists idx_receipts_legacy on public.receipts(legacy_id);
create index if not exists idx_receipts_number on public.receipts(receipt_number);
create index if not exists idx_receipts_sent_at on public.receipts(sent_at);

-- Enable RLS
alter table public.receipts enable row level security;

-- Staff can read all receipts
drop policy if exists receipts_staff_read on public.receipts;
create policy receipts_staff_read on public.receipts
  for select to authenticated using (public.is_staff());

-- Customers can read their own receipts
drop policy if exists receipts_customer_read on public.receipts;
create policy receipts_customer_read on public.receipts
  for select to authenticated using (customer_id = auth.uid());

-- Staff can insert receipts
drop policy if exists receipts_staff_insert on public.receipts;
create policy receipts_staff_insert on public.receipts
  for insert to authenticated with check (public.is_staff());

-- Staff can update receipts
drop policy if exists receipts_staff_update on public.receipts;
create policy receipts_staff_update on public.receipts
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- Updated at trigger
drop trigger if exists trg_receipts_updated on public.receipts;
create trigger trg_receipts_updated
before update on public.receipts
for each row execute function public.set_updated_at();

-- Add to realtime
alter publication supabase_realtime add table receipts;




ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vm_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.addon_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;