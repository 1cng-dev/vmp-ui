-- Create addon_services table (like vms table for active addon instances)
CREATE TABLE addon_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT UNIQUE,
  vm_id UUID REFERENCES vms(id) ON DELETE CASCADE,
  cpfs_enabled BOOLEAN DEFAULT FALSE,
  cpfs_package TEXT DEFAULT 'standard',
  ccis_enabled BOOLEAN DEFAULT FALSE,
  ccis_package TEXT DEFAULT 'standard',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  expiry TIMESTAMPTZ,
  duration TEXT,
  status TEXT DEFAULT 'Active',
  operational_status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for lookups
CREATE INDEX idx_addon_services_vm_id ON addon_services(vm_id);
CREATE INDEX idx_addon_services_status ON addon_services(status);

-- Enable RLS
ALTER TABLE addon_services ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Team can view all addon services" ON addon_services FOR SELECT USING (auth.jwt() ->> 'role' IN ('Admin', 'Sales', 'Engineer', 'Finance'));
CREATE POLICY "Customers can view their addon services" ON addon_services FOR SELECT USING (
  vm_id IN (SELECT id FROM vms WHERE customer_id = auth.uid())
);
CREATE POLICY "Team can insert addon services" ON addon_services FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Engineer'));
CREATE POLICY "Team can update addon services" ON addon_services FOR UPDATE USING (auth.jwt() ->> 'role' IN ('Admin', 'Engineer'));
