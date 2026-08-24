-- Add DELETE RLS policy for addon_services
-- Allows staff users to delete addon services (e.g., terminated cleanup)

drop policy if exists "Team can delete addon services" on public.addon_services;

create policy "Team can delete addon services"
  on public.addon_services for delete
  using (public.is_staff());
