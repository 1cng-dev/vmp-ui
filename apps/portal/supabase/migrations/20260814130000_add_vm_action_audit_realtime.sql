-- Add vm_action_audit table to realtime publication for real-time updates in the UI
ALTER PUBLICATION supabase_realtime ADD TABLE vm_action_audit;
