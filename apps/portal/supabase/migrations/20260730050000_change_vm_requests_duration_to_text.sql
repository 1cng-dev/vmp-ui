-- Change duration field from INTEGER to TEXT in vm_requests table
-- This allows storing duration with units (e.g., "14 days", "1 month", "3 months")

-- First, alter the column type to TEXT using a conversion expression
ALTER TABLE public.vm_requests 
ALTER COLUMN duration TYPE TEXT USING 
  CASE 
    WHEN duration = 14 AND request_type = 'trial' THEN '14 days'
    WHEN duration = 1 AND request_type = 'paid' THEN '1 month'
    WHEN duration = 3 AND request_type = 'paid' THEN '3 months'
    WHEN duration = 6 AND request_type = 'paid' THEN '6 months'
    WHEN duration = 12 AND request_type = 'paid' THEN '12 months'
    WHEN duration IS NOT NULL AND request_type = 'paid' THEN duration::TEXT || ' months'
    ELSE duration::TEXT
  END;

-- Add a check constraint to ensure valid duration format
ALTER TABLE public.vm_requests 
ADD CONSTRAINT vm_requests_duration_format 
CHECK (duration ~ '^\d+ (day|days|month|months)$');
