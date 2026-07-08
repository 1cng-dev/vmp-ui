-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;


-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated can upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete ticket attachments" ON storage.objects;

-- RLS Policies for ticket-attachments bucket

-- Allow authenticated users to upload ticket attachments
CREATE POLICY "Authenticated can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

-- Allow authenticated users to view ticket attachments
CREATE POLICY "Authenticated can view ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- Allow staff to delete ticket attachments
CREATE POLICY "Staff can delete ticket attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND public.is_staff()
);