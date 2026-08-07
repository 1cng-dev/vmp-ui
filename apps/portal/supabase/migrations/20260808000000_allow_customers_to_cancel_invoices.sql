-- Allow customers to cancel invoices
drop policy if exists invoices_customer_update on public.invoices;
create policy invoices_customer_update on public.invoices
  for update to authenticated
  using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and (
      -- Allow updating payment_proof and status to Customer Transferred
      (payment_proof is not null and status = 'Customer Transferred')
      -- Allow cancelling invoices
      or status = 'Cancelled'
      or status = 'Pending'
    )
  );
