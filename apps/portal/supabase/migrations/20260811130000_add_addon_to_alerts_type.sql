-- Add 'addon' to the alerts type check constraint
ALTER TABLE alerts 
DROP CONSTRAINT alerts_type_check;

ALTER TABLE alerts 
ADD CONSTRAINT alerts_type_check 
CHECK (type IN ('expiry', 'kyc', 'finance', 'task', 'system', 'vm', 'addon'));
