-- Backfill customer_id for existing alerts based on metadata
-- This updates alerts that were created before the customer_id field was added

-- Update VM status change alerts
UPDATE alerts 
SET customer_id = (metadata->>'customer_id')::uuid
WHERE type = 'vm' 
  AND customer_id IS NULL 
  AND metadata->>'customer_id' IS NOT NULL;

-- Update VM request alerts
UPDATE alerts 
SET customer_id = (metadata->>'customer_id')::uuid
WHERE type = 'vm' 
  AND related_entity_type = 'vm_request'
  AND customer_id IS NULL 
  AND metadata->>'customer_id' IS NOT NULL;

-- Update finance/invoice alerts
UPDATE alerts 
SET customer_id = (metadata->>'customer_id')::uuid
WHERE type = 'finance' 
  AND customer_id IS NULL 
  AND metadata->>'customer_id' IS NOT NULL;

-- Update expiry alerts
UPDATE alerts 
SET customer_id = (metadata->>'customer_id')::uuid
WHERE type = 'expiry' 
  AND customer_id IS NULL 
  AND metadata->>'customer_id' IS NOT NULL;
