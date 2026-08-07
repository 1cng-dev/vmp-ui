-- Update invoice legacy ID format to IV-YYYYMMDDNNN
-- Format: IV + Year (4 digits) + Month (2 digits) + Day (2 digits) + Sequence (3 digits)
-- Example: IV2026070823 (IV-2026-07-08-023)
-- Start sequence at 23

-- Drop existing trigger
drop trigger if exists trg_invoices_code on public.invoices;

-- Update the sequence to start at 23
-- First, get the current max sequence value if any
DO $$
DECLARE
  max_seq bigint;
BEGIN
  -- Check if there are any existing invoices
  SELECT COALESCE(MAX(CAST(SUBSTRING(legacy_id FROM '\d+$') AS bigint)), 0) INTO max_seq
  FROM public.invoices
  WHERE legacy_id ~ 'INV-\d+$';
  
  -- Set sequence to start at 23 (or max + 1 if higher)
  IF max_seq < 23 THEN
    PERFORM setval('public.invoice_code_seq', 22, false); -- Start at 23
  ELSE
    PERFORM setval('public.invoice_code_seq', max_seq, true);
  END IF;
END $$;

-- Update the function to use new format: IV-YYYYMMNNN
create or replace function public.assign_invoice_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 
      'IV' || 
      to_char(now(), 'YYYYMM') || 
      to_char(nextval('public.invoice_code_seq'), 'FM000');
  end if;

  return new;
end;
$$;

-- Recreate the trigger
create trigger trg_invoices_code
before insert on public.invoices
for each row execute function public.assign_invoice_code();
