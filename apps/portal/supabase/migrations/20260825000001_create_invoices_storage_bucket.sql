-- Create invoices storage bucket
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- Allow staff to upload invoice PDFs
create policy "Staff can upload invoice PDFs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'invoices'
  and public.is_staff()
);

-- Allow staff to update invoice PDFs
create policy "Staff can update invoice PDFs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'invoices'
  and public.is_staff()
)
with check (
  bucket_id = 'invoices'
  and public.is_staff()
);

-- Allow authenticated users to read invoice PDFs (public access for downloads)
create policy "Public can read invoice PDFs"
on storage.objects for select
to authenticated
using (bucket_id = 'invoices');
