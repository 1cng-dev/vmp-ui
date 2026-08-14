-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to call the cleanup-activity-logs function daily at 3 AM Myanmar time (8:30 PM UTC)
-- This runs as a background job in PostgreSQL
-- Deletes activity logs older than 90 days
SELECT cron.schedule(
  'cleanup-activity-logs-job',
  '30 20 * * *',  -- 8:30 PM UTC = 3:00 AM Myanmar time (next day)
  $$
  SET search_path TO public, net;
  SELECT net.http_post(
    url := 'http://10.0.111.23:8000/functions/v1/cleanup-activity-logs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODI4OTY0MjksImV4cCI6MTk0MDU3NjQyOX0.PPm-_z8lJSNWOFqsE5UbyVhqToxPZbPVpZL8oVY8-7g',
      'Content-Type', 'application/json'
    ),
    body := '{"name":"daily-cleanup"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'cleanup-activity-logs-job';
