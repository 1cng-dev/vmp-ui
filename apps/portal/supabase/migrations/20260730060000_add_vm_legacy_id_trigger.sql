-- Drop existing sequence to force reset
DROP SEQUENCE IF EXISTS public.vm_seq;

-- Create sequence for VMs starting from 3000
CREATE SEQUENCE public.vm_seq START 3000;

-- Create function to generate legacy_id for VMs
CREATE OR REPLACE FUNCTION public.generate_vm_legacy_id()
RETURNS TRIGGER AS $$
DECLARE
  customer_legacy_id TEXT;
  customer_id_digits TEXT;
  customer_name TEXT;
  vm_number TEXT;
BEGIN
  IF NEW.legacy_id IS NULL THEN
    -- Get customer legacy_id
    SELECT legacy_id INTO customer_legacy_id
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    -- Extract digits from customer legacy_id (remove "C-" prefix)
    IF customer_legacy_id IS NOT NULL THEN
      customer_id_digits := REGEXP_REPLACE(customer_legacy_id, '^[A-Za-z-]+', '');
    ELSE
      customer_id_digits := '0000';
    END IF;
    
    -- Get customer name (org_name if exists, else name)
    SELECT 
      COALESCE(NULLIF(org_name, ''), name) INTO customer_name
    FROM public.customers
    WHERE id = NEW.customer_id;
    
    -- Get next VM number from sequence (4 digits)
    vm_number := LPAD(nextval('public.vm_seq')::TEXT, 4, '0');
    
    -- Validate that VM sequence number doesn't exceed 3000
    IF CAST(vm_number AS INTEGER) > 3000 THEN
      RAISE EXCEPTION 'VM sequence number cannot exceed 3000. Current value: %', vm_number;
    END IF;
    
    -- Generate legacy_id: VPS-TDC-{customer_id_digits}-{vm_number}-{customer_name}
    NEW.legacy_id := 'VPS-TDC-' || customer_id_digits || '-' || vm_number || '-' || customer_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate legacy_id
DROP TRIGGER IF EXISTS set_vm_legacy_id ON public.vms;
CREATE TRIGGER set_vm_legacy_id
  BEFORE INSERT ON public.vms
  FOR EACH ROW EXECUTE FUNCTION public.generate_vm_legacy_id();
