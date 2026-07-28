-- Allow staff to insert into vm_ownership
CREATE POLICY "Staff can insert vm ownership"
  ON public.vm_ownership FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

-- Allow staff to update vm_ownership
CREATE POLICY "Staff can update vm ownership"
  ON public.vm_ownership FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Allow staff to delete vm_ownership
CREATE POLICY "Staff can delete vm ownership"
  ON public.vm_ownership FOR DELETE
  TO authenticated
  USING (public.is_staff());
