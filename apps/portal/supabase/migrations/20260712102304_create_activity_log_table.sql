-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor VARCHAR(128),
  actor_role VARCHAR(16),
  kind VARCHAR(32),
  text TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor);
CREATE INDEX IF NOT EXISTS idx_activity_log_kind ON activity_log(kind);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- Add RLS policies
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs" ON activity_log
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert activity logs" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (true);