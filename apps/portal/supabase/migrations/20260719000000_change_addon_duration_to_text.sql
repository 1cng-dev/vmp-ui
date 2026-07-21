-- Change addon_requests.duration from INTEGER to TEXT to store precise duration
-- This allows storing "5 months 29 days" format for accurate billing
ALTER TABLE public.addon_requests ALTER COLUMN duration TYPE TEXT;
