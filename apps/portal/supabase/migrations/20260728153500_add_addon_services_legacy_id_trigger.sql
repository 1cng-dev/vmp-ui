-- Add auto-generation for legacy_id in addon_services table
-- Similar to addon_requests table

-- Create function to generate legacy_id for addon services
CREATE OR REPLACE FUNCTION generate_addon_service_legacy_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.legacy_id IS NULL THEN
    SELECT 'AS-' || LPAD(nextval('addon_service_seq')::TEXT, 4, '0') INTO NEW.legacy_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for addon services
CREATE SEQUENCE IF NOT EXISTS addon_service_seq START 1001;

-- Create trigger to auto-generate legacy_id
CREATE TRIGGER set_addon_service_legacy_id
  BEFORE INSERT ON public.addon_services
  FOR EACH ROW EXECUTE FUNCTION generate_addon_service_legacy_id();

