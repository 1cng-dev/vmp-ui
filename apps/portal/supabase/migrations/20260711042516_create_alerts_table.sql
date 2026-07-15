-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sev TEXT NOT NULL CHECK (sev IN ('urgent', 'warn', 'info')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expiry', 'kyc', 'finance', 'task', 'system', 'vm')),
  read BOOLEAN DEFAULT FALSE,
  related_entity_id UUID,
  related_entity_type TEXT,
  actor_id UUID,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_alerts_sev ON alerts(sev);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_related_entity ON alerts(related_entity_id, related_entity_type);

-- Add RLS policies
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all alerts" ON alerts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert alerts" ON alerts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update alerts" ON alerts
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins can delete alerts" ON alerts
  FOR DELETE TO authenticated
  USING (true);