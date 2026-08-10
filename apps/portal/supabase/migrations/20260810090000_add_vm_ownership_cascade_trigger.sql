-- Add trigger to automatically delete vm_ownership records when a VM is deleted
-- This ensures cleanup even if the manual delete in the application code fails

CREATE OR REPLACE FUNCTION delete_vm_ownership_on_vm_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete vm_ownership records where vmid matches the deleted VM's assigned_vmid
  DELETE FROM public.vm_ownership
  WHERE vmid = OLD.assigned_vmid;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on vms table
DROP TRIGGER IF EXISTS trigger_delete_vm_ownership ON public.vms;

CREATE TRIGGER trigger_delete_vm_ownership
  AFTER DELETE ON public.vms
  FOR EACH ROW
  EXECUTE FUNCTION delete_vm_ownership_on_vm_delete();
