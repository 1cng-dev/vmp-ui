-- Create KYC documents storage bucket
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own KYC documents
create policy "Users can upload their own KYC documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'kyc-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own KYC documents
create policy "Users can read their own KYC documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'kyc-documents' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow staff to read all KYC documents
create policy "Staff can read all KYC documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'kyc-documents' 
  and public.is_staff()
);
