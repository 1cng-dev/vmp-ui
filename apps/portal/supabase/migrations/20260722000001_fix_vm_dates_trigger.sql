CREATE OR REPLACE FUNCTION set_vm_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set start_date if it's NULL (not provided by admin direct VM creation)
  IF NEW.start_date IS NULL THEN
    NEW.start_date = NEW.created_at + INTERVAL '1 day';
  END IF;
  
  -- Set end_date to start_date + duration (in months) with +1 day to match expiry calculation
  IF NEW.end_date IS NULL AND NEW.duration IS NOT NULL THEN
    NEW.end_date = NEW.start_date + (NEW.duration || ' months')::INTERVAL + INTERVAL '1 day';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
