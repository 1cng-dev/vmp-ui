CREATE TABLE IF NOT EXISTS public.vm_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  vmid INTEGER NOT NULL,
  node TEXT NOT NULL,
  pmx_type TEXT NOT NULL DEFAULT 'qemu',
  status_cache TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (node, vmid)
);

CREATE INDEX IF NOT EXISTS idx_vm_ownership_user ON public.vm_ownership(user_id);
CREATE INDEX IF NOT EXISTS idx_vm_ownership_vmid ON public.vm_ownership(vmid, node);

ALTER TABLE public.vm_ownership ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vm ownership"
  ON public.vm_ownership FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.vm_action_audit (
  id bigserial PRIMARY KEY,
  user_id UUID NOT NULL,
  vmid INTEGER NOT NULL,
  node TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vm_action_audit_vmid ON public.vm_action_audit(vmid, node);
CREATE INDEX IF NOT EXISTS idx_vm_action_audit_user ON public.vm_action_audit(user_id);