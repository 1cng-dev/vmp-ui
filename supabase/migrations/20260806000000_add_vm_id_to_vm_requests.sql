-- Add vm_id column to vm_requests table for referencing existing VMs in renewal/change plan requests
ALTER TABLE vm_requests ADD COLUMN vm_id UUID REFERENCES vms(id);

-- Add index for performance on vm_id
CREATE INDEX idx_vm_requests_vm_id ON vm_requests(vm_id);
