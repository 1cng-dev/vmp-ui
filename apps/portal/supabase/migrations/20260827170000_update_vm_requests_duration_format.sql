-- Allow compound durations like "1 month 14 days" for change-plan requests
ALTER TABLE public.vm_requests
DROP CONSTRAINT IF EXISTS vm_requests_duration_format;

ALTER TABLE public.vm_requests
ADD CONSTRAINT vm_requests_duration_format
CHECK (duration ~ '^\d+ (day|days|month|months)( \d+ (day|days))?$');
