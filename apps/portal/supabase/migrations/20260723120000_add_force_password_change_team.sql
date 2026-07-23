-- Add force_password_change field to team_members table
-- This flag is used to force team members to change their password on first login

alter table public.team_members 
add column if not exists force_password_change boolean default false;
