-- Add operational_status column to addon_requests table
-- This will store the actual status (Active, Expired, Terminated) separate from provision status (Pending, In Progress, Completed)

ALTER TABLE addon_requests 
ADD COLUMN operational_status TEXT DEFAULT 'Active' CHECK (operational_status IN ('Active', 'Expired', 'Terminated'));

-- Set initial operational status based on expiry date
UPDATE addon_requests 
SET operational_status = CASE 
  WHEN expiry < NOW() THEN 'Expired'
  ELSE 'Active'
END
WHERE operational_status = 'Active';

-- Create index for operational_status
CREATE INDEX idx_addon_requests_operational_status ON addon_requests(operational_status);
