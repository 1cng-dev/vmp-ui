
-- Team members table (1 row per staff user in auth.users)
create table if not exists public.team_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  staff_code text unique,                                    -- e.g. U-0001
  email      text unique not null,
  name       text not null,
  role       text not null check (role in ('Admin','Sales','Engineer','Finance')),
  team       text not null,                                  -- e.g. Sales, Provisioning, Network, Finance, Management
  status     text not null default 'Active' check (status in ('Active','Inactive','Suspended')),
  invited_by uuid references auth.users(id),
  notes      text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Friendly staff code generator: U-0001, U-0002, ...
create sequence if not exists public.staff_code_seq start 1;

create or replace function public.assign_staff_code()
returns trigger language plpgsql as $$
begin
  if new.staff_code is null or new.staff_code = '' then
    new.staff_code := 'U-' || to_char(nextval('public.staff_code_seq'), 'FM0000');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_code on public.team_members;
create trigger trg_team_code
before insert on public.team_members
for each row execute function public.assign_staff_code();

-- updated_at trigger
drop trigger if exists trg_team_updated on public.team_members;
create trigger trg_team_updated
before update on public.team_members
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_team_role        on public.team_members(role);
create index if not exists idx_team_team        on public.team_members(team);
create index if not exists idx_team_status      on public.team_members(status);
-- ADDED: invited_by was missing an index despite being a likely filter/join column
create index if not exists idx_team_invited_by  on public.team_members(invited_by);

-- RLS
alter table public.team_members enable row level security;

-- Admins: full control (select/insert/update/delete)
drop policy if exists team_admin_all on public.team_members;
create policy team_admin_all on public.team_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Staff: read own record
drop policy if exists team_self_read on public.team_members;
create policy team_self_read on public.team_members
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists team_staff_read_all on public.team_members;
create policy team_staff_read_all on public.team_members
  for select to authenticated
  using (public.is_staff());


create table if not exists public.team_members_audit (
  id bigserial primary key,
  user_id uuid not null,
  changed_by uuid,
  old_role text,
  new_role text,
  old_status text,
  new_status text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_team_audit_user_id on public.team_members_audit(user_id);
create index if not exists idx_team_audit_changed_at on public.team_members_audit(changed_at);


-- Add invite token fields to team_members
alter table public.team_members
add column if not exists invite_token text unique,
add column if not exists invite_expires_at timestamptz,
add column if not exists accepted_at timestamptz;

-- Add index for invite token lookup
create index if not exists idx_team_invite_token on public.team_members(invite_token);

drop policy if exists team_staff_insert on public.team_members;
create policy team_staff_insert on public.team_members
  for insert to authenticated
  with check (public.is_staff());





create or replace function public.log_team_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.role is distinct from new.role) or (old.status is distinct from new.status) then
    insert into public.team_members_audit (
      user_id, changed_by, old_role, new_role, old_status, new_status
    ) values (
      new.user_id, auth.uid(), old.role, new.role, old.status, new.status
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_members_audit on public.team_members;
create trigger trg_team_members_audit
after insert or update on public.team_members
for each row execute function public.log_team_member_change();

-- Audit table RLS: admin read-only, no client writes (writes only via trigger)
alter table public.team_members_audit enable row level security;

drop policy if exists team_audit_admin_read on public.team_members_audit;
create policy team_audit_admin_read on public.team_members_audit
  for select to authenticated
  using (public.is_admin());








CREATE POLICY "Allow invite token read"
ON team_members
FOR SELECT
TO anon
USING (invite_token IS NOT NULL);


DROP POLICY IF EXISTS "Allow invite acceptance" ON team_members;
 
CREATE POLICY "Allow invite acceptance"
ON team_members
FOR UPDATE
TO anon
USING (invite_token IS NOT NULL)
WITH CHECK (invite_token IS NOT NULL);


alter publication supabase_realtime add table team_members;