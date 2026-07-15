-- Trigger to automatically set start_date and end_date when a VM is inserted
-- start_date: created_at + 1 day (matches expiry calculation)
-- end_date: start_date + duration (in months) with +1 day (matches expiry calculation)

CREATE OR REPLACE FUNCTION set_vm_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set start_date to created_at + 1 day
  NEW.start_date = NEW.created_at + INTERVAL '1 day';
  
  -- Set end_date to start_date + duration (in months) with +1 day to match expiry calculation
  IF NEW.duration IS NOT NULL AND NEW.duration > 0 THEN
    NEW.end_date = (NEW.created_at + INTERVAL '1 day') + (NEW.duration || ' months')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on INSERT
DROP TRIGGER IF EXISTS trigger_set_vm_dates ON public.vms;
CREATE TRIGGER trigger_set_vm_dates
  BEFORE INSERT ON public.vms
  FOR EACH ROW
  EXECUTE FUNCTION set_vm_dates();
