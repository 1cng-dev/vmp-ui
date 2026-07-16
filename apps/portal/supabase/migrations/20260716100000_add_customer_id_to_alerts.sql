-- Add customer_id field to alerts table for customer-specific notifications
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;

-- Create index for faster customer-specific queries
CREATE INDEX IF NOT EXISTS idx_alerts_customer_id ON alerts(customer_id);

-- Drop existing policies to recreate them with customer-specific logic
DROP POLICY IF EXISTS "Admins can view all alerts" ON alerts;
DROP POLICY IF EXISTS "Admins can insert alerts" ON alerts;
DROP POLICY IF EXISTS "Admins can update alerts" ON alerts;
DROP POLICY IF EXISTS "Admins can delete alerts" ON alerts;

-- Create new policies
CREATE POLICY "Admins can view all alerts" ON alerts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Customers can view their own alerts" ON alerts
  FOR SELECT TO authenticated
  USING (customer_id IS NULL OR customer_id IN (SELECT id FROM customers WHERE id = auth.uid()));

CREATE POLICY "Admins can insert alerts" ON alerts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts" ON alerts
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins can delete alerts" ON alerts
  FOR DELETE TO authenticated
  USING (true);
