-- Update quote legacy ID format to Qt-YYYYMMNNN
-- Format: Qt + Year (4 digits) + Month (2 digits) + Sequence (3 digits)
-- Example: Qt202608036 (Qt-2026-08-036)
-- Start sequence at 36

-- Drop existing trigger
drop trigger if exists trg_quotes_code on public.quotes;

-- Update the sequence to start at 36
-- First, get the current max sequence value if any
DO $$
DECLARE
  max_seq bigint;
BEGIN
  -- Check if there are any existing quotes
  SELECT COALESCE(MAX(CAST(SUBSTRING(legacy_id FROM '\d+$') AS bigint)), 0) INTO max_seq
  FROM public.quotes
  WHERE legacy_id ~ 'QT-\d+$';
  
  -- Set sequence to start at 36 (or max + 1 if higher)
  IF max_seq < 36 THEN
    PERFORM setval('public.quote_code_seq', 35, false); -- Start at 36
  ELSE
    PERFORM setval('public.quote_code_seq', max_seq, true);
  END IF;
END $$;

-- Update the function to use new format: Qt-YYYYMMNNN
create or replace function public.assign_quote_code()
returns trigger
language plpgsql
as $$
begin
  if new.legacy_id is null or new.legacy_id = '' then
    new.legacy_id := 
      'Qt' || 
      to_char(now(), 'YYYYMM') || 
      to_char(nextval('public.quote_code_seq'), 'FM000');
  end if;

  return new;
end;
$$;

-- Recreate the trigger
create trigger trg_quotes_code
before insert on public.quotes
for each row execute function public.assign_quote_code();
