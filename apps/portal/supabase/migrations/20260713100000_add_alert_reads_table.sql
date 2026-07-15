-- Create alert_reads junction table to track per-user read status
CREATE TABLE IF NOT EXISTS alert_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(alert_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_alert_reads_alert_id ON alert_reads(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_reads_user_id ON alert_reads(user_id);

-- Enable RLS
ALTER TABLE alert_reads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own alert reads
CREATE POLICY "Users can view their own alert reads"
  ON alert_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own alert reads
CREATE POLICY "Users can insert their own alert reads"
  ON alert_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Enable realtime replication for alerts and alert_reads
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_reads;

-- Remove the global read column from alerts (optional - keeping it for backwards compatibility)
-- ALTER TABLE alerts DROP COLUMN IF EXISTS read;
