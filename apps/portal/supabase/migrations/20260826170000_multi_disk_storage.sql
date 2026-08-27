-- 1. Track all real disks
CREATE TABLE IF NOT EXISTS public.vm_disks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id UUID NOT NULL REFERENCES public.vms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_gb INTEGER NOT NULL CHECK (size_gb > 0),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vm_disks_one_primary
ON public.vm_disks (vm_id)
WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_vm_disks_vm_id ON public.vm_disks (vm_id);

-- 2. Disk change actions on requests
ALTER TABLE public.vm_requests
ADD COLUMN IF NOT EXISTS requested_disks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vm_requests.requested_disks IS
'Disk change actions: [{"action":"new","name":"data","size_gb":50}] or [{"action":"extend","disk_id":"...","add_gb":30}]';

-- 3. Keep vms.storage_gb in sync with vm_disks
CREATE OR REPLACE FUNCTION recalc_vm_storage_total()
RETURNS TRIGGER AS $$
DECLARE
  target_vm_id UUID;
BEGIN
  target_vm_id := COALESCE(NEW.vm_id, OLD.vm_id);

  UPDATE public.vms
  SET storage_gb = COALESCE((
    SELECT SUM(size_gb)
    FROM public.vm_disks
    WHERE vm_id = target_vm_id
  ), 0)
  WHERE id = target_vm_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_storage ON public.vm_disks;
CREATE TRIGGER trg_recalc_storage
AFTER INSERT OR UPDATE OR DELETE ON public.vm_disks
FOR EACH ROW
EXECUTE FUNCTION recalc_vm_storage_total();