-- Add customer_id column to addon_services
ALTER TABLE addon_services ADD COLUMN customer_id UUID REFERENCES customers(id);

-- Backfill existing data with customer_id from vms table
UPDATE addon_services 
SET customer_id = (SELECT customer_id FROM vms WHERE vms.id = addon_services.vm_id)
WHERE customer_id IS NULL;

-- Create trigger to auto-set customer_id from vm_id
CREATE OR REPLACE FUNCTION set_addon_service_customer_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    SELECT customer_id INTO NEW.customer_id FROM vms WHERE id = NEW.vm_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_addon_customer_id
  BEFORE INSERT OR UPDATE ON addon_services
  FOR EACH ROW EXECUTE FUNCTION set_addon_service_customer_id();