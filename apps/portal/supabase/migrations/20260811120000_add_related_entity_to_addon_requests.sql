-- Add related_entity_id and related_entity_type to addon_requests table
-- This allows linking add-on requests to parent requests (e.g., VM renewals)

ALTER TABLE addon_requests
ADD COLUMN related_entity_id UUID,
ADD COLUMN related_entity_type TEXT;

-- Add comment to document the purpose
COMMENT ON COLUMN addon_requests.related_entity_id IS 'ID of the parent entity (e.g., vm_request) that this add-on request is associated with';
COMMENT ON COLUMN addon_requests.related_entity_type IS 'Type of the parent entity (e.g., vm_request)';
