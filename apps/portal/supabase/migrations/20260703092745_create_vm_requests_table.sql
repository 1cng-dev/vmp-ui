-- VM Requests table
create table if not exists public.vm_requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  legacy_id       text unique,                                   -- e.g. VR-1001
  
  -- Status
  status          text not null default 'Pending'
    check (status in ('Pending','In Progress','Completed','Rejected')),
  
  -- Request Type
  request_type    text not null default 'paid'
    check (request_type in ('trial','paid')),
  
  -- Spec
  hostname        text not null,
  purpose         text,
  vcpu            integer not null,
  ram_gb          integer not null,
  storage     integer not null,
  qty       integer not null default 1,
  duration  integer,
  sizing        text default 'Standard'
    check (sizing in ('Standard','High Performance')),
  storage_partitions text,
  
  -- OS
  os_name         text,
  os_version      text,
  custom_os_name  text,
  custom_os_version text,
  
  -- Network
  zone            text,
  nics            jsonb default '[]',
  public_ip_required boolean default true,
  
  -- Firewall
  firewall_ports  text[],
  port_forwarding jsonb default '[]',
  
  -- Addons
  backup_enabled  boolean default false,
  backup_type     text, 
    check (backup_type in ('daily','weekly')),
  monitoring      boolean default false,
  
  -- Meta
  notes           text,
  assigned_to     uuid references public.team_members(user_id),
  assigned_vmid   integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Friendly request code generator: VR-0001, VR-0002, ...
create sequence if not exists public.vm_request_code_seq start 1;

create or replace function public.assign_vm_request_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 'VR-' || to_char(nextval('public.vm_request_code_seq'), 'FM0000');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vm_requests_code on public.vm_requests;
create trigger trg_vm_requests_code
before insert on public.vm_requests
for each row execute function public.assign_vm_request_code();

-- updated_at trigger
drop trigger if exists trg_vm_requests_updated on public.vm_requests;
create trigger trg_vm_requests_updated
before update on public.vm_requests
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_vm_requests_customer    on public.vm_requests(customer_id);
create index if not exists idx_vm_requests_status      on public.vm_requests(status);
create index if not exists idx_vm_requests_legacy_id   on public.vm_requests(legacy_id);
create index if not exists idx_vm_requests_assigned_to on public.vm_requests(assigned_to);
create index if not exists idx_vm_requests_created_at  on public.vm_requests(created_at);

-- RLS
alter table public.vm_requests enable row level security;

-- Customers can read own requests
drop policy if exists vm_requests_self_select on public.vm_requests;
create policy vm_requests_self_select on public.vm_requests
  for select to authenticated
  using (auth.uid() = customer_id);

-- Customers can insert own requests
drop policy if exists vm_requests_self_insert on public.vm_requests;
create policy vm_requests_self_insert on public.vm_requests
  for insert to authenticated
  with check (auth.uid() = customer_id);

-- Staff can read all requests
drop policy if exists vm_requests_staff_read on public.vm_requests;
create policy vm_requests_staff_read on public.vm_requests
  for select to authenticated
  using (public.is_staff());

-- Staff can update requests (assign, change status, etc.)
drop policy if exists vm_requests_staff_update on public.vm_requests;
create policy vm_requests_staff_update on public.vm_requests
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Add to realtime publication
alter publication supabase_realtime add table vm_requests;


ALTER TABLE vm_requests ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'New';



alter table public.vm_requests drop constraint if exists vm_requests_status_check;

alter table public.vm_requests 
  add constraint vm_requests_status_check 
  check (status in ('Pending','In Progress','Provisioning','Network','Testing','Completed','Rejected'));



-- Add billing_term field to vm_requests table
ALTER TABLE public.vm_requests ADD COLUMN IF NOT EXISTS billing_term TEXT DEFAULT 'Monthly' CHECK (billing_term IN ('Monthly', 'Annual'));

-- Create index for billing_term queries
CREATE INDEX IF NOT EXISTS idx_vm_requests_billing_term ON public.vm_requests(billing_term);
