-- =============================================================
-- UPDATE CUSTOMER LEGACY ID FORMAT TO 1CNG-VPS-00xx
-- =============================================================

-- Drop existing trigger
drop trigger if exists trg_customers_code on public.customers;

-- Drop existing sequence
drop sequence if exists public.customer_code_seq;

-- Create new sequence starting from 50
create sequence public.customer_code_seq start 50;

-- Update trigger function to generate format 1CNG-VPS-00xx
create or replace function public.assign_customer_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 
      '1CNG-VPS-' || to_char(
        nextval('public.customer_code_seq'),
        'FM0000'
      );
  end if;

  return new;
end;
$$;

-- Recreate trigger
create trigger trg_customers_code
before insert on public.customers
for each row execute function public.assign_customer_code();
