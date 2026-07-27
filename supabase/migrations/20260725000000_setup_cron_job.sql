-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;


-- Remove existing job if it exists
SELECT cron.unschedule('check-expiry-job');

-- Create a cron job to call the check-expiry function daily at 9 AM Myanmar time (2:30 AM UTC)
-- This runs as a background job in PostgreSQL
-- Set search path to include net schema
SELECT cron.schedule(
  'check-expiry-job',
  '30 2 * * *',
  $$
  SET search_path TO public, net;
  SELECT net.http_post(
    url := 'https://pivjokgbztjahbvvyzce.supabase.co/functions/v1/check-expiry',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdmpva2dienRqYWhidnZ5emNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgwMjMzNiwiZXhwIjoyMDk4Mzc4MzM2fQ.K_JPm2s8CunNc-8q2q_m8g1hCXalZt3IO23J9lJMotQ',
      'Content-Type', 'application/json'
    ),
    body := '{"name":"daily-reminder"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'check-expiry-job';
