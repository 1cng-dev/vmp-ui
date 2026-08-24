-- Remove ON DELETE CASCADE from addon_requests.vm_id to preserve historical data
-- When a VM is deleted, addon_requests will remain for audit/history purposes

ALTER TABLE public.addon_requests DROP CONSTRAINT IF EXISTS addon_requests_vm_id_fkey;

ALTER TABLE public.addon_requests 
ADD CONSTRAINT addon_requests_vm_id_fkey 
FOREIGN KEY (vm_id) REFERENCES public.vms(id) ON DELETE SET NULL;
