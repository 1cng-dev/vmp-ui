create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  legacy_id varchar(16) unique,
  vm_request_ids uuid[] default '{}',
  addon_request_ids uuid[] default '{}',
  amount numeric not null default 0,
  vat numeric not null default 0,
  gross_amount numeric not null default 0,
  discount numeric default 0,
  currency text default 'MMK',
  issued timestamptz not null default now(),
  due timestamptz not null default (now() + interval '7 days'),
  status text not null default 'Pending' check (status in ('Pending', 'Customer Transferred', 'Payment Received', 'Overdue', 'Cancelled')),
  receipt text,
  invoice_date timestamptz,
  quote_id uuid references public.quotes(id) on delete set null,
  sales_person uuid references public.team_members(user_id) on delete set null,
  billing_term text,
  line_items jsonb default '[]',
  payment_proof text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_customer on public.invoices(customer_id);
create index if not exists idx_invoices_quote on public.invoices(quote_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_created_at on public.invoices(created_at);
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS legacy_id varchar(16) unique;

create index if not exists idx_invoices_legacy_id on public.invoices(legacy_id);

-- Friendly invoice code generator: INV-0001, INV-0002, ...
create sequence if not exists public.invoice_code_seq start 1;

create or replace function public.assign_invoice_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id :=
      'INV-' || to_char(
        nextval('public.invoice_code_seq'),
        'FM0000'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_code on public.invoices;
create trigger trg_invoices_code
before insert on public.invoices
for each row execute function public.assign_invoice_code();

alter table public.invoices enable row level security;

drop policy if exists invoices_staff_read on public.invoices;
create policy invoices_staff_read on public.invoices
  for select to authenticated using (public.is_staff());

drop policy if exists invoices_customer_read on public.invoices;
create policy invoices_customer_read on public.invoices
  for select to authenticated using (
    customer_id = auth.uid()
  );

drop policy if exists invoices_staff_insert on public.invoices;
create policy invoices_staff_insert on public.invoices
  for insert to authenticated with check (public.is_staff());

drop policy if exists invoices_staff_update on public.invoices;
create policy invoices_staff_update on public.invoices
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists invoices_customer_update on public.invoices;
create policy invoices_customer_update on public.invoices
  for update to authenticated
  using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and (
      -- Allow updating payment_proof and status to Customer Transferred
      (payment_proof is not null and status = 'Customer Transferred')
      or status = 'Pending'
    )
  );

drop trigger if exists trg_invoices_updated on public.invoices;
create trigger trg_invoices_updated
before update on public.invoices
for each row execute function public.set_updated_at();

alter publication supabase_realtime add table invoices;




ALTER TABLE public.invoices
ADD COLUMN net_amount numeric DEFAULT 0,
ADD COLUMN paid_date timestamptz;