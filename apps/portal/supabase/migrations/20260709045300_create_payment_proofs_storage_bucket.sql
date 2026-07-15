-- Create payment proofs storage bucket
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own payment proofs
create policy "Users can upload their own payment proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own payment proofs
create policy "Users can read their own payment proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow staff to read all payment proofs
create policy "Staff can read all payment proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs' 
  and public.is_staff()
);
