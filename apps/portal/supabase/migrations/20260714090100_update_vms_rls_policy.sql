-- Update RLS policy to allow authenticated users to update power_state
-- This enables customers to start/stop their VMs

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "users_can_update_own_vms" ON public.vms;

-- Create new policy that allows authenticated users to update their own VMs
CREATE POLICY "users_can_update_own_vms_power_state"
ON public.vms
FOR UPDATE
TO authenticated
USING (
  -- Users can only update VMs that belong to their customer
  customer_id IN (
    SELECT id FROM public.customers 
    WHERE id = auth.uid()
  )
  OR
  -- Staff can update any VM
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Only allow updating power_state field
  power_state IN ('Running', 'Stopped', 'Paused')
);

-- Ensure RLS is enabled
ALTER TABLE public.vms ENABLE ROW LEVEL SECURITY;
