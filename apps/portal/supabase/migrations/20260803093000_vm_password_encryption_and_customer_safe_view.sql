-- =============================================================
-- PHASE 1 — VM ownership/status: hide assigned_vmid/node from
-- customers, encrypt VM login passwords at rest, add an opaque
-- per-VM identifier for the customer-facing proxmox-proxcy routes.
-- =============================================================

create extension if not exists "pgcrypto";

-- Encrypted replacement for the plaintext `password` column. Populated by
-- proxmox-proxcy's admin bindings endpoint (POST /api/admin/vms/:vmId/bindings)
-- via pgp_sym_encrypt with a key held in proxmox-proxcy's env — never in this
-- database, not even via ALTER DATABASE ... SET. The app stops writing to
-- `password` as of this change; existing plaintext rows need a one-time
-- backfill (encrypt into password_encrypted, then null out password) that the
-- operator must run themselves — this sandbox has no network path to the live
-- database to run it here.
alter table public.vms add column if not exists password_encrypted bytea;

-- IMPORTANT — column-hiding boundary, spelled out explicitly per the design
-- brief's own request:
--
-- RLS is row-level only; it cannot hide columns. A real Postgres-level fix
-- would `revoke select (assigned_vmid, node, pmx_type, password,
-- password_encrypted) on vms from authenticated` — but in this schema,
-- customers AND staff are the *same* Postgres role (`authenticated`; staff
-- vs. customer is distinguished entirely by RLS policies calling
-- is_staff(), not by a separate DB role). A blanket column REVOKE would
-- therefore also break every existing staff/service code path that still
-- does `.from('vms').select('*')` directly (invoicing, expiry jobs, quote
-- review, admin/engineer VM creation — ~10 call sites outside this task's
-- scope), without a role-split this schema doesn't have today. That's a
-- bigger, riskier change than "hide assigned_vmid," so it's out of scope
-- for this pass.
--
-- What Phase 1 actually closes: the worst-case leak — a plaintext VM login
-- password — is closed unconditionally by the encryption above, regardless
-- of which column a query asks for; there is no plaintext to return, and no
-- key in this database to decrypt password_encrypted with. What remains an
-- *application-layer* boundary, not a hard database one: the customer-facing
-- portal code exclusively queries vms_customer_safe (see vmStore.ts), so a
-- customer using this app never sees assigned_vmid/node — but a customer who
-- crafts their own PostgREST request against the base `vms` table directly
-- could still read assigned_vmid/node (an internal identifier, not a
-- credential) for their own row, since RLS still legitimately grants them
-- that row. Closing that fully needs a staff/customer Postgres role split —
-- flagged as follow-up work, not attempted here.
--
-- Customer-facing view: every current customer-safe vms column, plus
-- ownership_record_id (vm_ownership.id) — the opaque UUID the frontend now
-- sends instead of the real Proxmox vmid when calling proxmox-proxcy's
-- /api/vms/by-record/:recordId/* routes. The WHERE clause explicitly
-- replicates vms' own row-visibility rules (rather than relying on
-- Postgres 15's security_invoker view option, so this works regardless of
-- the self-hosted instance's Postgres version) — a customer only ever sees
-- their own rows, staff see all. left join so an unprovisioned VM (no
-- assigned_vmid yet) still lists, with ownership_record_id = null.
create or replace view public.vms_customer_safe as
select
  v.id,
  v.hostname,
  v.public_ip,
  v.private_ip,
  v.username,
  v.vcpu,
  v.ram_gb,
  v.storage_gb,
  v.status,
  v.power_state,
  v.customer_id,
  v.vm_request_id,
  v.task_type,
  v.expiry,
  v.legacy_id,
  v.duration,
  v.backup_enabled,
  v.backup_type,
  v.start_date,
  v.end_date,
  v.os_name,
  v.os_version,
  v.custom_os_name,
  v.custom_os_version,
  v.zone,
  v.nics,
  v.public_ip_required,
  v.firewall_ports,
  v.firewall_outbound_allow_all,
  v.firewall_outbound_custom_ports,
  v.request_type,
  v.purpose,
  v.sizing,
  v.storage_partitions,
  v.qty,
  v.provision_status,
  v.created_at,
  v.updated_at,
  vo.id as ownership_record_id
from public.vms v
left join public.vm_ownership vo on vo.vmid = v.assigned_vmid
where v.customer_id = auth.uid() or public.is_staff();

grant select on public.vms_customer_safe to authenticated;
