-- Engineers can now perform the VM provisioning/binding action (previously
-- Admin-only) — see proxmox-proxcy's requireVMProvisioner. user_id alone is
-- enough to attribute an audit row to a person, but not to a *role* at the
-- time of the action: if that person's team_members.role later changes,
-- joining vm_action_audit to team_members for historical role would give
-- the wrong answer for anything logged before the change. Capturing the
-- role at insert time keeps "was this bound by an admin or an engineer?"
-- answerable regardless of later role changes.
alter table public.vm_action_audit add column if not exists performed_by_role text;
