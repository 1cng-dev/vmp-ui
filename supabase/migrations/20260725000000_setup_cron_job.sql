
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to call the check-expiry function daily at 9 AM Myanmar time (2:30 AM UTC)
-- This runs as a background job in PostgreSQL
-- Set search path to include net schema
SELECT cron.schedule(
  'check-expiry-job',
  '0 3 * * *',  -- 3:00 AM UTC = 9:30 AM Myanmar time (for testing)
  $$
  SET search_path TO public, net;
  SELECT net.http_post(
    url := 'http://10.0.111.23:8000/functions/v1/check-expiry',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4OTY0MjksImV4cCI6MTk0MDU3NjQyOX0.PPm-_z8lJSNWOFqsE5UbyVhqToxPZbPVpZL8oVY8-7g',
      'Content-Type', 'application/json'
    ),
    body := '{"name":"daily-reminder"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'check-expiry-job';
