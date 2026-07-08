CREATE TABLE IF NOT EXISTS public.addon_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vm_id UUID NOT NULL REFERENCES public.vms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  cpfs_enabled BOOLEAN DEFAULT FALSE,
  cpfs_package TEXT CHECK (cpfs_package IN ('standard', 'premium')),
  ccis_enabled BOOLEAN DEFAULT FALSE,
  ccis_package TEXT CHECK (ccis_package IN ('basic', 'standard', 'professional', 'enterprise')),
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed','Rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.addon_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their addon requests" ON public.addon_requests
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create addon requests" ON public.addon_requests
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their addon requests" ON public.addon_requests
  FOR UPDATE USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Staff can manage addon requests" ON public.addon_requests
  FOR ALL USING (public.is_staff());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_addon_requests_customer ON public.addon_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_addon_requests_vm ON public.addon_requests(vm_id);
CREATE INDEX IF NOT EXISTS idx_addon_requests_status ON public.addon_requests(status);

-- Legacy ID trigger
CREATE OR REPLACE FUNCTION generate_addon_legacy_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.legacy_id IS NULL THEN
    SELECT 'AD-' || LPAD(nextval('addon_seq')::TEXT, 4, '0') INTO NEW.legacy_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS addon_seq START 1001;

CREATE TRIGGER set_addon_legacy_id
  BEFORE INSERT ON public.addon_requests
  FOR EACH ROW EXECUTE FUNCTION generate_addon_legacy_id();

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_addon_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER addon_updated_at
  BEFORE UPDATE ON public.addon_requests
  FOR EACH ROW EXECUTE FUNCTION update_addon_updated_at();
