-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-logos', 'company-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow team members to upload logos
CREATE POLICY "Team members can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
    )
  );

-- Policy: Allow team members to update logos
CREATE POLICY "Team members can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
    )
  );

-- Policy: Allow public read access to logos (since they're displayed on invoices, emails, etc.)
CREATE POLICY "Public can view logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

-- Policy: Allow team members to delete logos
CREATE POLICY "Team members can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
    )
  );
