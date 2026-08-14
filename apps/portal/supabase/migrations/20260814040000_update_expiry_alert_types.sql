-- Update VM and addon expiry alerts to use 'expiry' type for consistent filtering
-- This ensures Finance role can see expiry notifications and they appear in the Expiry filter

-- Update VM expiry alerts
UPDATE alerts
SET type = 'expiry'
WHERE type = 'vm'
AND (
  title ILIKE '%Expiring%' 
  OR title ILIKE '%Expired%'
  OR title ILIKE '%expiry%'
);

-- Update addon expiry alerts
UPDATE alerts
SET type = 'expiry'
WHERE type = 'addon'
AND (
  title ILIKE '%Expiring%' 
  OR title ILIKE '%Expired%'
  OR title ILIKE '%expiry%'
);
