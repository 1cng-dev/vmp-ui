-- Trigger function to update vms table when vm_requests status changes to Completed
CREATE OR REPLACE FUNCTION update_vms_on_request_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update for change-plan requests that are being set to Completed
  IF NEW.status = 'Completed' AND NEW.task_type = 'change-plan' AND OLD.status != 'Completed' THEN
    -- Only update backup columns if the purpose indicates a backup change
    IF NEW.purpose ILIKE '%Backup%' THEN
      -- Find the VM by hostname (for change-plan, the VM already exists)
      UPDATE public.vms
      SET 
        backup_enabled = NEW.backup_enabled,
        backup_type = NEW.backup_type,
        updated_at = NOW()
      WHERE hostname = NEW.hostname AND customer_id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_vms_on_request_completion ON public.vm_requests;
CREATE TRIGGER trigger_update_vms_on_request_completion
  AFTER UPDATE OF status ON public.vm_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_vms_on_request_completion();