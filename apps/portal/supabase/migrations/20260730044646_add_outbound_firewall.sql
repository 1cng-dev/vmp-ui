-- Add outbound firewall fields to vm_requests table
ALTER TABLE vm_requests 
ADD COLUMN IF NOT EXISTS firewall_outbound_allow_all BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS firewall_outbound_custom_ports TEXT[] DEFAULT '{}';