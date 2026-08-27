-- Enable realtime updates for the vm_disks table so disk changes appear live in the UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.vm_disks;
