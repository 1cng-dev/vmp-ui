-- Extensions
create extension if not exists "pgcrypto";

-- VM Requests table
create table if not exists public.vm_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  legacy_id varchar(20) unique,
  
  -- Status workflow
  status varchar(20) not null default 'Pending'
    check (status in ('Pending','In Progress','Completed','Rejected','Blocked')),
  wf_stage integer default 0,
  assigned_to varchar(128),
  created_vm_id varchar(20),
  
  -- Request metadata
  request_type varchar(16) not null default 'paid'
    check (request_type in ('trial','paid')),
  purpose text not null,
  hostname text not null,
  
  -- Specifications
  vcpu integer not null,
  ram_gb integer not null,
  storage_gb integer not null,
  sizing varchar(16) default 'standard'
    check (sizing in ('standard','premium')),
  capacity varchar(64),
  storage_partitions text,
  
  -- Volumes (JSONB)
  volumes jsonb not null default '[]'::jsonb,
  
  -- Networking
  public_ip_required boolean default true,
  bandwidth text,
  zone text default 'yangon-dc1',
  nics jsonb default '[]'::jsonb,
  
  -- OS
  os_name text not null,
  os_version text not null,
  custom_os_name text,
  custom_os_version text,
  
  -- Security
  firewall_ports text[] default array[]::text[],
  port_forwarding jsonb default '[]'::jsonb,
  
  -- Add-ons
  backup_enabled boolean default false,
  backup_freq varchar(16),
  backup_time varchar(8),
  backup_retention integer,
  monitoring boolean default false,
  vm_protection varchar(16) default 'none',
  ddos_protection varchar(16) default 'none',
  ssl_certificate varchar(16) default 'none',
  load_balancer varchar(16) default 'none',
  
  -- Additional info
  notes text,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Legacy ID generator
create sequence if not exists public.vm_request_code_seq start 1;

create or replace function public.assign_vm_request_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 'VMR-' || to_char(nextval('public.vm_request_code_seq'), 'FM0000');
  end if;
  return new;
end;
$$;

create trigger trg_vm_requests_code
before insert on public.vm_requests
for each row execute function public.assign_vm_request_code();

-- Updated at trigger
create trigger trg_vm_requests_updated
before update on public.vm_requests
for each row execute function public.set_updated_at();

-- Indexes
create index idx_vm_requests_customer on public.vm_requests(customer_id);
create index idx_vm_requests_status on public.vm_requests(status);
create index idx_vm_requests_legacy on public.vm_requests(legacy_id);

-- RLS
alter table public.vm_requests enable row level security;

-- Customers can see own requests
create policy vm_requests_self_select on public.vm_requests
  for select to authenticated
  using (auth.uid() = customer_id);

-- Customers can insert own requests
create policy vm_requests_self_insert on public.vm_requests
  for insert to authenticated
  with check (auth.uid() = customer_id);

-- Staff can read all requests
create policy vm_requests_staff_read on public.vm_requests
  for select to authenticated
  using (public.is_staff());

-- Staff can update requests
create policy vm_requests_staff_update on public.vm_requests
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Realtime
alter publication supabase_realtime add table vm_requests;