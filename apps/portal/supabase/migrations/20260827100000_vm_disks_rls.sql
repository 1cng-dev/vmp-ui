-- Enable RLS on vm_disks
ALTER TABLE public.vm_disks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated portal users to read/insert/update/delete vm_disks rows
CREATE POLICY vm_disks_all ON public.vm_disks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
