-- Add outbound firewall fields to vms table
ALTER TABLE vms 
ADD COLUMN IF NOT EXISTS firewall_outbound_allow_all BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS firewall_outbound_custom_ports TEXT[] DEFAULT '{}';
