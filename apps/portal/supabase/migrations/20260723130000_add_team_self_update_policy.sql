-- Add policy to allow team members to update their own force_password_change field
-- This is needed for the password change flow

drop policy if exists team_self_update on public.team_members;
create policy team_self_update on public.team_members
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
