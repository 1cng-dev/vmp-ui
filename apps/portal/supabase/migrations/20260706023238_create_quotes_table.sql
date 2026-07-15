create table if not exists public.quotes (
  id                uuid primary key default gen_random_uuid(),
  vm_request_id     uuid not null references public.vm_requests(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete cascade,
  legacy_id         text unique,
  status            text not null default 'Draft' check (status in ('Draft','Sent','Accepted','Rejected','Expired')),
  validity_date     timestamptz not null default (now() + interval '30 days'),
  subtotal_monthly  numeric not null default 0,
  subtotal_annual   numeric not null default 0,
  total_annual      numeric not null default 0,
  currency          text default 'MMK',
  line_items        jsonb default '[]',
  created_by        uuid references public.team_members(user_id),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create sequence if not exists public.quote_code_seq start 1;

create or replace function public.assign_quote_code()
returns trigger language plpgsql as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 'QT-' || to_char(nextval('public.quote_code_seq'), 'FM0000');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quotes_code on public.quotes;
create trigger trg_quotes_code
before insert on public.quotes
for each row execute function public.assign_quote_code();

-- Keep customer_id in sync with the linked request
create or replace function public.sync_quote_customer_from_request()
returns trigger language plpgsql as $$
begin
  select customer_id into new.customer_id
  from public.vm_requests
  where id = new.vm_request_id;
  return new;
end;
$$;

drop trigger if exists trg_quotes_sync_customer on public.quotes;
create trigger trg_quotes_sync_customer
before insert or update of vm_request_id on public.quotes
for each row execute function public.sync_quote_customer_from_request();

-- updated_at trigger (assumes public.set_updated_at exists)
drop trigger if exists trg_quotes_updated on public.quotes;
create trigger trg_quotes_updated
before update on public.quotes
for each row execute function public.set_updated_at();

create index if not exists idx_quotes_vm_request on public.quotes(vm_request_id);
create index if not exists idx_quotes_customer   on public.quotes(customer_id);
create index if not exists idx_quotes_status     on public.quotes(status);
create index if not exists idx_quotes_created_at on public.quotes(created_at);

alter table public.quotes enable row level security;

drop policy if exists quotes_staff_read on public.quotes;
create policy quotes_staff_read on public.quotes
  for select to authenticated using (public.is_staff());

drop policy if exists quotes_customer_read on public.quotes;
create policy quotes_customer_read on public.quotes
  for select to authenticated using (
    customer_id in (select id from public.customers where id = auth.uid())
  );

drop policy if exists quotes_staff_insert on public.quotes;
create policy quotes_staff_insert on public.quotes
  for insert to authenticated with check (public.is_staff());

drop policy if exists quotes_staff_update on public.quotes;
create policy quotes_staff_update on public.quotes
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table quotes;


-- Add addon_request_id to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS addon_request_id UUID REFERENCES public.addon_requests(id) ON DELETE CASCADE;

-- Add index for addon_request_id
CREATE INDEX IF NOT EXISTS idx_quotes_addon_request ON public.quotes(addon_request_id);


-- Make vm_request_id nullable to support both VM requests and addon requests
ALTER TABLE public.quotes 
ALTER COLUMN vm_request_id DROP NOT NULL;

-- Update the trigger to sync customer_id from either vm_request or addon_request
CREATE OR REPLACE FUNCTION public.sync_quote_customer_from_request()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vm_request_id IS NOT NULL THEN
    SELECT customer_id INTO NEW.customer_id
    FROM public.vm_requests
    WHERE id = NEW.vm_request_id;
  ELSIF NEW.addon_request_id IS NOT NULL THEN
    SELECT customer_id INTO NEW.customer_id
    FROM public.addon_requests
    WHERE id = NEW.addon_request_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER TABLE public.quotes 
DROP COLUMN IF EXISTS subtotal_monthly,
DROP COLUMN IF EXISTS subtotal_annual,
DROP COLUMN IF EXISTS total_annual,
ADD COLUMN IF NOT EXISTS instance_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS public_ip_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS backup_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_term TEXT DEFAULT 'Monthly';