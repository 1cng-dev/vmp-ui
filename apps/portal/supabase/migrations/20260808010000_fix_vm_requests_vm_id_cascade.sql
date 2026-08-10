-- Fix foreign key constraint to allow VM deletion when vm_requests reference it
-- Drop the existing constraint and recreate it with ON DELETE CASCADE

ALTER TABLE public.vm_requests DROP CONSTRAINT IF EXISTS vm_requests_vm_id_fkey;

ALTER TABLE public.vm_requests 
ADD CONSTRAINT vm_requests_vm_id_fkey 
FOREIGN KEY (vm_id) REFERENCES public.vms(id) ON DELETE CASCADE;
