-- Convert firewall_ports from text[] to jsonb to support port reasons
-- This allows storing port objects like [{"port":"80","reason":"Web traffic"}]

-- Step 1: Add outbound firewall columns if they don't exist
ALTER TABLE vm_requests ADD COLUMN IF NOT EXISTS firewall_outbound_allow_all BOOLEAN DEFAULT true;
ALTER TABLE vm_requests ADD COLUMN IF NOT EXISTS firewall_outbound_custom_ports TEXT[] DEFAULT '{}';

-- Step 2: Create temporary columns for new jsonb format
ALTER TABLE vm_requests ADD COLUMN firewall_ports_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE vm_requests ADD COLUMN firewall_outbound_custom_ports_new JSONB DEFAULT '[]'::jsonb;

-- Step 3: Migrate existing data from text[] to jsonb array of objects
-- Convert existing ports to objects with empty reason
UPDATE vm_requests 
SET firewall_ports_new = (
  SELECT jsonb_agg(jsonb_build_object('port', port, 'reason', ''))
  FROM unnest(firewall_ports) AS port
)
WHERE firewall_ports IS NOT NULL AND array_length(firewall_ports, 1) > 0;

-- Step 4: Drop old columns
ALTER TABLE vm_requests DROP COLUMN firewall_ports;
ALTER TABLE vm_requests DROP COLUMN firewall_outbound_custom_ports;

-- Step 5: Rename new columns to original names
ALTER TABLE vm_requests RENAME COLUMN firewall_ports_new TO firewall_ports;
ALTER TABLE vm_requests RENAME COLUMN firewall_outbound_custom_ports_new TO firewall_outbound_custom_ports;

-- Step 6: Add comments
COMMENT ON COLUMN vm_requests.firewall_ports IS 'Array of port objects: [{"port":"80","reason":"Web traffic"}]';
COMMENT ON COLUMN vm_requests.firewall_outbound_custom_ports IS 'Array of outbound port objects: [{"port":"8080","reason":"API access"}]';
COMMENT ON COLUMN vm_requests.firewall_outbound_allow_all IS 'Allow all outbound traffic to selected inbound ports';




-- Convert firewall_ports from text[] to jsonb to support port reasons in vms table
-- This allows storing port objects like [{"port":"80","reason":"Web traffic"}]

-- Step 1: Drop the dependent view
DROP VIEW IF EXISTS public.vms_customer_safe;

-- Step 2: Add outbound firewall columns if they don't exist
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS firewall_outbound_allow_all BOOLEAN DEFAULT true;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS firewall_outbound_custom_ports TEXT[] DEFAULT '{}';

-- Step 3: Create temporary columns for new jsonb format
ALTER TABLE public.vms ADD COLUMN firewall_ports_new JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.vms ADD COLUMN firewall_outbound_custom_ports_new JSONB DEFAULT '[]'::jsonb;

-- Step 5: Drop old columns
ALTER TABLE public.vms DROP COLUMN firewall_ports;
ALTER TABLE public.vms DROP COLUMN firewall_outbound_custom_ports;

-- Step 6: Rename new columns to original names
ALTER TABLE public.vms RENAME COLUMN firewall_ports_new TO firewall_ports;
ALTER TABLE public.vms RENAME COLUMN firewall_outbound_custom_ports_new TO firewall_outbound_custom_ports;

-- Step 7: Add comments
COMMENT ON COLUMN public.vms.firewall_ports IS 'Array of port objects: [{"port":"80","reason":"Web traffic"}]';
COMMENT ON COLUMN public.vms.firewall_outbound_custom_ports IS 'Array of outbound port objects: [{"port":"8080","reason":"API access"}]';
COMMENT ON COLUMN public.vms.firewall_outbound_allow_all IS 'Allow all outbound traffic to selected inbound ports';

-- Step 8: Recreate the vms_customer_safe view with updated column types
CREATE OR REPLACE VIEW public.vms_customer_safe AS
SELECT
  v.id,
  v.hostname,
  v.public_ip,
  v.private_ip,
  v.username,
  v.password,
  v.vcpu,
  v.ram_gb,
  v.storage_gb,
  v.status,
  v.power_state,
  v.customer_id,
  v.vm_request_id,
  v.task_type,
  v.expiry,
  v.legacy_id,
  v.duration,
  v.backup_enabled,
  v.backup_type,
  v.start_date,
  v.end_date,
  v.os_name,
  v.os_version,
  v.custom_os_name,
  v.custom_os_version,
  v.zone,
  v.nics,
  v.public_ip_required,
  v.firewall_ports,
  v.firewall_outbound_allow_all,
  v.firewall_outbound_custom_ports,
  v.request_type,
  v.purpose,
  v.sizing,
  v.storage_partitions,
  v.qty,
  v.provision_status,
  v.created_at,
  v.updated_at,
  vo.id as ownership_record_id
FROM public.vms v
LEFT JOIN public.vm_ownership vo ON vo.vmid = v.assigned_vmid
WHERE v.customer_id = auth.uid() OR public.is_staff();

GRANT SELECT ON public.vms_customer_safe TO authenticated;