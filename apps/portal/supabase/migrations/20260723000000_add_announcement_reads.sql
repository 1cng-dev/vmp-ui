-- Create announcement_reads table to track which announcements have been read by which customers
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(announcement_id, customer_id)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_customer_id ON announcement_reads(customer_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_read_at ON announcement_reads(read_at DESC);

-- Enable RLS
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Policies: customers can only read their own announcement_reads, service_role can manage all
CREATE POLICY "Customers can view their own announcement reads" ON announcement_reads
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM customers WHERE id = customer_id));

CREATE POLICY "Customers can insert their own announcement reads" ON announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT id FROM customers WHERE id = customer_id));

CREATE POLICY "Service role can manage announcement reads" ON announcement_reads
  FOR ALL TO service_role
  USING (true);

-- Enable real-time for announcement_reads
alter publication supabase_realtime add table public.announcement_reads;
