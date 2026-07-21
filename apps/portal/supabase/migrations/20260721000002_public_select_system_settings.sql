-- Allow public (anon and authenticated) to read system settings
-- Needed so customer portal and auth pages can display company name and logo
create policy "Public can view system settings"
  on public.system_settings
  for select
  to anon, authenticated
  using (true);
