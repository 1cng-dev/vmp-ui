ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS node TEXT NOT NULL DEFAULT 'pve1';
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS pmx_type TEXT NOT NULL DEFAULT 'qemu';
CREATE INDEX IF NOT EXISTS idx_vms_node ON public.vms(node);
CREATE INDEX IF NOT EXISTS idx_vms_node_vmid ON public.vms(node, assigned_vmid);
UPDATE public.vms SET node = 'pve1', pmx_type = 'qemu' WHERE node IS NULL OR pmx_type IS NULL;