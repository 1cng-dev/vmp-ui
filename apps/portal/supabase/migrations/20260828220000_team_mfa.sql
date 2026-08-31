-- Add 2FA flags to team_members, mirroring the customers table
alter table public.team_members
  add column if not exists mfa_required boolean not null default false,
  add column if not exists mfa_disabled boolean not null default false;
