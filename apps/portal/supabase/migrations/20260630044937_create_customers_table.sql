-- =============================================================
-- CUSTOMERS TABLE (self-service registered customer accounts)
-- =============================================================

-- Extensions (idempotent)
create extension if not exists "pgcrypto";

-- Helpers to read role from JWT (used by RLS)
create or replace function public.jwt_role()
returns text language sql stable as $$
  select (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role')::text
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(public.jwt_role() = 'Admin', false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select coalesce(public.jwt_role() in ('Admin','Sales','Engineer','Finance'), false)
$$;

-- Shared updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Customers table (1 row per auth.users customer account)
create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade, -- same as auth.users.id
  legacy_id varchar(16) unique,                                   -- human-friendly code e.g. C-1001
  email text unique not null,                                              -- denormalized from auth.users.email (for convenience)
  account_type varchar(20) not null default 'Individual'
    check (account_type in ('Individual','Organization')),
  name text not null,

  -- Contact
  phone varchar(32),
  alt_phone varchar(32),
  preferred_contact_method varchar(32) default 'Email'
    check (preferred_contact_method in ('Email','Phone call','WhatsApp','Viber')),

  -- Address
  address text,
  city text,
  state text,
  postal_code varchar(16),
  country text,

  -- Organization
  org_name text,
  org_reg_no text,
  org_type text,
  org_industry text,
  org_rep_title text,
  org_employees text,
  org_website text,

  -- KYC
  nrc_or_id varchar(64),
  kyc_status varchar(16) not null default 'Pending'
    check (kyc_status in ('Pending','Approved','Rejected')),
  nrc_front_url text,
  nrc_back_url text,
  org_cert_url text,
  org_tax_id_url text,
  director_id_url text,

  -- Payment
  payment_method varchar(64)
    check (payment_method in ('KBZ Pay','AYA Bank','CB Bank','Yoma Bank')),
  payer_name text,
  payer_phone varchar(32),

  -- Account prefs
  -- title text,
  -- timezone text default 'Asia/Yangon',
  -- language text default 'English',

  -- Security prefs (app-level)
  -- two_factor_enabled boolean default false,
  -- session_timeout_minutes integer default 30,

  -- Notifications
  -- notif_vm_expiry boolean default true,
  -- notif_invoice_overdue boolean default true,
  -- notif_task_assigned boolean default true,
  -- notif_kyc_submission boolean default false,
  -- notif_inapp_all boolean default true,
  -- notif_weekly_digest boolean default false,

  -- Status
  status varchar(16) not null default 'Active'
    check (status in ('Active','Inactive','Suspended')),
  agreed_to_terms boolean default false,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Friendly customer code generator: C-0001, C-0002, ...
create sequence if not exists public.customer_code_seq start 1;

create or replace function public.assign_customer_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id :=
      'C-' || to_char(
        nextval('public.customer_code_seq'),
        'FM0000'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_customers_code on public.customers;
create trigger trg_customers_code
before insert on public.customers
for each row execute function public.assign_customer_code();

-- updated_at trigger
drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
before update on public.customers
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_customers_legacy_id     on public.customers(legacy_id);
create index if not exists idx_customers_email         on public.customers(email);
create index if not exists idx_customers_phone         on public.customers(phone);
create index if not exists idx_customers_kyc_status    on public.customers(kyc_status);
create index if not exists idx_customers_account_type  on public.customers(account_type);
create index if not exists idx_customers_org_name      on public.customers(org_name);



-- RLS
alter table public.customers enable row level security;

-- Customer can read own row
drop policy if exists customers_self_select on public.customers;
create policy customers_self_select on public.customers
  for select to authenticated
  using (auth.uid() = id);

-- Customer can update own row
drop policy if exists customers_self_update on public.customers;
create policy customers_self_update on public.customers
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists customers_self_insert on public.customers;
create policy customers_self_insert on public.customers
  for insert to authenticated
  with check (auth.uid() = id);

-- Staff can read customers
drop policy if exists customers_staff_read on public.customers;
create policy customers_staff_read on public.customers
  for select to authenticated
  using (public.is_staff());

drop policy if exists customers_signup_insert on public.customers;
create policy customers_signup_insert on public.customers
  for insert to authenticated
  with check (true);


drop policy if exists customers_self_read on public.customers;
create policy customers_self_read on public.customers
  for select to authenticated
  using (auth.uid() = id);


alter table public.customers 
add column if not exists kyc_reviewer_note text;


alter table public.customers 
add column if not exists kyc_reviewed_by text;

alter table public.customers 
add column if not exists kyc_reviewed_at timestamptz;


-- Add policy to allow staff to update customer records
create policy customers_staff_update on public.customers
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());


alter publication supabase_realtime add table customers;