-- Create VMs table
CREATE TABLE IF NOT EXISTS public.vms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname TEXT NOT NULL,
  public_ip TEXT,
  private_ip TEXT,
  username TEXT,
  password TEXT,
  vcpu INTEGER DEFAULT 2,
  ram_gb INTEGER DEFAULT 8,
  storage_gb INTEGER DEFAULT 100,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Terminated')),
  power_state TEXT DEFAULT 'Running' CHECK (power_state IN ('Running', 'Stopped', 'Paused')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  vm_request_id UUID REFERENCES public.vm_requests(id) ON DELETE CASCADE,
  task_type TEXT, -- 'new', 'upgrade', 'renewal', 'addon'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vms_customer_id ON public.vms(customer_id);
CREATE INDEX IF NOT EXISTS idx_vms_vm_request_id ON public.vms(vm_request_id);

-- Enable RLS
ALTER TABLE public.vms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view all VMs"
  ON public.vms FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can insert VMs"
  ON public.vms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update VMs"
  ON public.vms FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Customers can view their own VMs"
  ON public.vms FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_vms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vms_updated_at
  BEFORE UPDATE ON public.vms
  FOR EACH ROW
  EXECUTE FUNCTION update_vms_updated_at();



-- Add expiry field to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS expiry TIMESTAMPTZ;

-- Create index for expiry queries
CREATE INDEX IF NOT EXISTS idx_vms_expiry ON public.vms(expiry);


-- Add legacy_id field to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS legacy_id TEXT UNIQUE;

-- Create index for legacy_id queries
CREATE INDEX IF NOT EXISTS idx_vms_legacy_id ON public.vms(legacy_id);



-- Add assigned_vmid field to vms table
-- This stores the VM ID from the provisioning system (e.g., Proxmox VM ID)
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS assigned_vmid INTEGER;

-- Create index for assigned_vmid queries
CREATE INDEX IF NOT EXISTS idx_vms_assigned_vmid ON public.vms(assigned_vmid);


-- Add duration field to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Create index for duration queries
CREATE INDEX IF NOT EXISTS idx_vms_duration ON public.vms(duration);


-- Add backup columns to vms table
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS backup_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS backup_type TEXT DEFAULT NULL CHECK (backup_type IN ('daily', 'weekly', NULL));



-- Add start_date and end_date fields to vms table
-- start_date: created_at + 1 day
-- end_date: start_date + duration (in months)
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Create indexes for date queries
CREATE INDEX IF NOT EXISTS idx_vms_start_date ON public.vms(start_date);
CREATE INDEX IF NOT EXISTS idx_vms_end_date ON public.vms(end_date);