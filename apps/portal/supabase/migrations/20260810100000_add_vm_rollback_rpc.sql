-- RPC function to rollback VM creation during provisioning
-- This function can only be called by staff members (Admins, Engineers, etc.)
-- It bypasses RLS for deletion but is protected by the SECURITY DEFINER and staff check

CREATE OR REPLACE FUNCTION rollback_vm_creation(vm_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vm_record record;
BEGIN
  -- Verify the caller is a staff member
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only staff members can rollback VM creation';
  END IF;

  -- Delete each VM and its associated ownership records
  FOR vm_record IN SELECT id FROM unnest(vm_ids) AS id
  LOOP
    -- Get assigned_vmid before deleting (for logging/ownership cleanup)
    DECLARE
      v_assigned_vmid integer;
    BEGIN
      SELECT assigned_vmid INTO v_assigned_vmid
      FROM vms
      WHERE id = vm_record.id;

      -- Delete vm_ownership record if it exists
      IF v_assigned_vmid IS NOT NULL THEN
        DELETE FROM vm_ownership WHERE vmid = v_assigned_vmid;
      END IF;

      -- Delete the VM record
      DELETE FROM vms WHERE id = vm_record.id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other VMs
      RAISE WARNING 'Failed to rollback VM %: %', vm_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Grant execute to authenticated users (the function itself checks for staff membership)
GRANT EXECUTE ON FUNCTION rollback_vm_creation(uuid[]) TO authenticated;
