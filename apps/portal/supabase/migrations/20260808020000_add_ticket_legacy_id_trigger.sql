-- Auto-generate ticket legacy ID format: TKT-YYYYMMNNN
-- Format: TKT + Year (4 digits) + Month (2 digits) + Sequence (3 digits)
-- Example: TKT202608001 (TKT-2026-08-001)

-- Create sequence for ticket codes
CREATE SEQUENCE IF NOT EXISTS public.ticket_code_seq
  START WITH 1
  INCREMENT BY 1;

-- Function to assign ticket legacy_id
CREATE OR REPLACE FUNCTION public.assign_ticket_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.legacy_id IS NULL OR NEW.legacy_id = '' THEN
    NEW.legacy_id := 
      'TKT' || 
      TO_CHAR(NOW(), 'YYYYMM') || 
      TO_CHAR(NEXTVAL('public.ticket_code_seq'), 'FM000');
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to assign legacy_id before insert
DROP TRIGGER IF EXISTS trg_tickets_code ON public.tickets;
CREATE TRIGGER trg_tickets_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_ticket_code();
