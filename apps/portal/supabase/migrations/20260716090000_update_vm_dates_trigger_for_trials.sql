-- Update trigger to handle trial requests
-- For trials (duration is null), end_date should match expiry (14 days)
-- For paid requests, end_date = created_at + 1 day + duration
-- Don't override end_date if already set by application code

DROP TRIGGER IF EXISTS trigger_set_vm_dates ON public.vms;
DROP FUNCTION IF EXISTS set_vm_dates();

CREATE OR REPLACE FUNCTION set_vm_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set start_date to created_at (VM provision date)
  NEW.start_date = NEW.created_at;
  
  -- Only set end_date if not already provided by application code
  IF NEW.end_date IS NULL THEN
    IF NEW.duration IS NOT NULL AND NEW.duration > 0 THEN
      -- Paid requests: end_date = created_at + 1 day + duration (in months)
      NEW.end_date = (NEW.created_at + INTERVAL '1 day') + (NEW.duration || ' months')::INTERVAL;
    ELSIF NEW.expiry IS NOT NULL THEN
      -- Trial requests (duration is null): end_date should match expiry
      NEW.end_date = NEW.expiry;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on INSERT
CREATE TRIGGER trigger_set_vm_dates
  BEFORE INSERT ON public.vms
  FOR EACH ROW
  EXECUTE FUNCTION set_vm_dates();
