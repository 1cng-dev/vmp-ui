-- Add support for direct VM creation in admin portal (bypassing customer request flow)

-- Make vm_request_id nullable to allow VMs without associated requests
ALTER TABLE public.vms ALTER COLUMN vm_request_id DROP NOT NULL;

-- Add UNIQUE constraint on hostname to prevent conflicts between customer requests and direct VM creation
ALTER TABLE public.vms ADD CONSTRAINT vms_hostname_unique UNIQUE (hostname);

-- Add OS-related fields from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS os_name TEXT;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS os_version TEXT;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS custom_os_name TEXT;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS custom_os_version TEXT;

-- Add network-related fields from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS zone TEXT;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS nics JSONB DEFAULT '[]';
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS public_ip_required BOOLEAN DEFAULT true;

-- Add firewall-related fields from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS firewall_ports TEXT[];

-- Add duration field for direct VM creation (may not exist in older schemas)
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 12;

-- Add request_type field for direct VM creation (trial/paid)
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'paid' CHECK (request_type IN ('trial', 'paid'));

-- Add purpose field from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS purpose TEXT;

-- Add sizing field from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS sizing TEXT DEFAULT 'Standard' CHECK (sizing IN ('Standard', 'High Performance'));

-- Add storage_partitions field from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS storage_partitions TEXT;

-- Add qty field from vm_requests to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;

-- Add provision_status field to track provisioning state for direct VMs
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS provision_status TEXT DEFAULT 'completed' CHECK (provision_status IN ('pending', 'in_progress', 'completed', 'failed'));

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_vms_provision_status ON public.vms(provision_status);
CREATE INDEX IF NOT EXISTS idx_vms_zone ON public.vms(zone);
CREATE INDEX IF NOT EXISTS idx_vms_os_name ON public.vms(os_name);

-- Add comments to document direct VM creation
COMMENT ON COLUMN public.vms.vm_request_id IS 'Optional reference to vm_requests table. NULL for VMs created directly by admin bypassing customer request flow.';
COMMENT ON COLUMN public.vms.provision_status IS 'Provisioning status for direct VM creation. Default is "completed" for admin-created VMs.';
