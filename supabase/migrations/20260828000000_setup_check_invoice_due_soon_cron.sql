CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'check-invoice-due-soon-job',
  '30 2 * * *',  -- 2:30 AM UTC = 9:00 AM Myanmar time
  $$
  SET search_path TO public, net;
  SELECT net.http_post(
    url := 'http://10.0.111.23:8000/functions/v1/check-invoice-due-soon',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <your_service_role_jwt>',
      'Content-Type', 'application/json'
    ),
    body := '{"name":"daily-due-soon-check"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

SELECT * FROM cron.job WHERE jobname = 'check-invoice-due-soon-job';