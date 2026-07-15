-- Drop the old trigger
DROP TRIGGER IF EXISTS trigger_set_vm_dates ON public.vms;
DROP FUNCTION IF EXISTS set_vm_dates();

-- Create new trigger with corrected logic
-- start_date = created_at (VM provision date)
-- expiry = created_at + 1 day + duration  
-- end_date = created_at + 1 day + duration

CREATE OR REPLACE FUNCTION set_vm_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set start_date to created_at (VM provision date)
  NEW.start_date = NEW.created_at;
  
  -- Set end_date to created_at + 1 day + duration (in months) - same as expiry
  IF NEW.duration IS NOT NULL AND NEW.duration > 0 THEN
    NEW.end_date = (NEW.created_at + INTERVAL '1 day') + (NEW.duration || ' months')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on INSERT
CREATE TRIGGER trigger_set_vm_dates
  BEFORE INSERT ON public.vms
  FOR EACH ROW
  EXECUTE FUNCTION set_vm_dates();
