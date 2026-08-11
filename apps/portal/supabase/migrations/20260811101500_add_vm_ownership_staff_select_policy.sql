CREATE POLICY "Staff can view vm ownership"
  ON public.vm_ownership FOR SELECT
  TO authenticated
  USING (public.is_staff());
