-- Add start_date, end_date, and expiry fields to addon_requests table
-- This allows addon services to have proper date tracking like VMs

ALTER TABLE addon_requests
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN expiry TIMESTAMP WITH TIME ZONE;

-- Add comment to document these fields
COMMENT ON COLUMN addon_requests.start_date IS 'When the addon service subscription starts';
COMMENT ON COLUMN addon_requests.end_date IS 'When the addon service subscription ends';
COMMENT ON COLUMN addon_requests.expiry IS 'When the addon service subscription expires';
