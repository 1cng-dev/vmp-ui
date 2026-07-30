-- Add conversion_history field to track VM origin history
ALTER TABLE public.vms ADD COLUMN IF NOT EXISTS conversion_history TEXT;
