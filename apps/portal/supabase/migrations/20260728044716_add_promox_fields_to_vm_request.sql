ALTER TABLE public.vm_requests ADD COLUMN IF NOT EXISTS node TEXT;
ALTER TABLE public.vm_requests ADD COLUMN IF NOT EXISTS assigned_vmid INTEGER;
ALTER TABLE public.vm_requests ADD COLUMN IF NOT EXISTS pmx_type TEXT DEFAULT 'qemu';