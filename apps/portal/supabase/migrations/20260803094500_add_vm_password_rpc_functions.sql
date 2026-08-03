-- RPC functions proxmox-proxcy uses (via its service-role client) to
-- encrypt/decrypt VM login passwords with pgcrypto. The encryption key is
-- passed as a parameter on every call from proxmox-proxcy's env
-- (VM_CREDENTIAL_KEY) — it is never stored in this database.
--
-- security definer so these can update/read password_encrypted regardless of
-- the caller's row-level grants; the service-role key already bypasses RLS,
-- so the real boundary here is the explicit revoke below — only service_role
-- may call these at all, never `authenticated`/`anon` (guessing the key is
-- the only other line of defense, and we don't want to rely on that alone).

create extension if not exists "pgcrypto";

create or replace function public.set_vm_password(p_vm_id uuid, p_password text, p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.vms
  set password_encrypted = pgp_sym_encrypt(p_password, p_key),
      password = null
  where id = p_vm_id;
$$;

create or replace function public.get_vm_password(p_vm_id uuid, p_key text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select pgp_sym_decrypt(password_encrypted, p_key)
  from public.vms
  where id = p_vm_id;
$$;

revoke all on function public.set_vm_password(uuid, text, text) from public, authenticated, anon;
revoke all on function public.get_vm_password(uuid, text) from public, authenticated, anon;
grant execute on function public.set_vm_password(uuid, text, text) to service_role;
grant execute on function public.get_vm_password(uuid, text) to service_role;
