-- Remove ON DELETE CASCADE from vm_requests.vm_id to preserve historical data
-- When a VM is deleted, vm_requests will remain for audit/history purposes

ALTER TABLE public.vm_requests DROP CONSTRAINT IF EXISTS vm_requests_vm_id_fkey;

ALTER TABLE public.vm_requests 
ADD CONSTRAINT vm_requests_vm_id_fkey 
FOREIGN KEY (vm_id) REFERENCES public.vms(id) ON DELETE SET NULL;
