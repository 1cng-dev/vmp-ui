-- =============================================================
-- FIX CUSTOMER LEGACY ID SEQUENCE TO AVOID DUPLICATE KEY ERRORS
-- =============================================================
-- This migration sets the customer_code_seq to start after the highest
-- existing legacy_id to prevent duplicate key violations during signup

-- Get the maximum numeric part from existing legacy_ids
-- Format: 1CNG-VPS-00xx where xx is the numeric part
DO $$
DECLARE
    max_seq_val INTEGER;
BEGIN
    -- Extract the numeric part from legacy_ids and find the maximum
    SELECT COALESCE(MAX(CAST(SUBSTRING(legacy_id FROM '\d+$') AS INTEGER)), 49)
    INTO max_seq_val
    FROM public.customers
    WHERE legacy_id ~ '1CNG-VPS-\d+$';
    
    -- Set the sequence to start from max + 1
    IF max_seq_val >= 50 THEN
        PERFORM setval('public.customer_code_seq', max_seq_val + 1, false);
        RAISE NOTICE 'Sequence customer_code_seq set to start from %', max_seq_val + 1;
    ELSE
        -- If no customers with new format exist, keep sequence at 50
        PERFORM setval('public.customer_code_seq', 50, false);
        RAISE NOTICE 'Sequence customer_code_seq kept at 50 (no customers with new format found)';
    END IF;
END $$;
