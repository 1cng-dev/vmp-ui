import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Task } from "../types";

export interface TaskStoreValue {
  tasks: Task[];
  addTask: (t: any) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, to: number) => void;
  advanceProvision: (
    id: string,
    parsedSpec?: any,
    addVM?: (vm: any) => string,
    updateVM?: (id: string, patch: any) => void,
  ) => void;
  createVMManually: (
    taskId: string,
    vmDetails: {
      publicIps: string[];
      privateIps: string[];
      assigned_vmids: number[];
      username: string;
      password: string;
      node?: string  // ADD THIS
      pmx_type?: string  // ADD THIS
    },
    addVM: (vm: any) => Promise<string>,
  ) => Promise<void>;
  setTasks: (tasks: Task[]) => void;
  updateVMExpiryForRequest: (
    vmRequestId: string,
    durationMonths?: number,
    updateVM?: (id: string, patch: any) => Promise<void>,
  ) => Promise<void>;
  updateAddonExpiryForVM: (
    vmId: string,
    durationMonths: number,
  ) => Promise<void>;
}

const useTaskStore = (): TaskStoreValue => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const addTask = useCallback((t: any) => {
    const id = `TSK-${3300 + Math.floor(Math.random() * 600)}`;
    const newT = {
      id,
      status: "Pending",
      priority: "Normal",
      assignee: "—",
      team: "Provisioning",
      created: new Date().toISOString().slice(0, 10),
      notes: "",
      ...t,
    };
    setTasks((s) => [newT, ...s]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, patch: any) => {
    setTasks((s) => s.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const advanceProvision = useCallback(
    (
      id: string,
      _parsedSpec?: any,
      _addVM?: (vm: any) => string,
      _updateVM?: (id: string, patch: any) => void,
    ) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) return;
      const stage = (t.wfStage || 0) + 1;
      const notes: any = {
        1: {
          team: "Sales",
          msg: `Sales reviewing ${t.id} — KYC check in progress`,
          kind: "task",
          status: "In Progress",
        },
        2: {
          team: "Engineering",
          msg: `KYC approved — Engineering notified`,
          kind: "customer",
          status: "In Progress",
        },
        3: {
          team: "Engineer",
          msg: `Engineer creating VM in Proxmox`,
          kind: "vm",
          status: "In Progress",
        },
        4: {
          team: "Network",
          msg: `Network team configuring firewall rules`,
          kind: "vm",
          status: "In Progress",
        },
        5: {
          team: "Engineering",
          msg: `Testing VM & uploading credentials`,
          kind: "vm",
          status: "In Progress",
        },
        6: {
          team: "Customer",
          msg: `VM is ready — customer notified ✓`,
          kind: "customer",
          status: "Done",
        },
      }[stage];

      let patch: any = { wfStage: stage, status: notes?.status || t.status };

      if (stage === 6 && t.createdVmId) {
        // TODO: Update VM status to Active when updateVM is available
      }

      setTasks((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    },
    [tasks],
  );

  const createVMManually = useCallback(
    async (
      task: any,
      vmDetails: {
        publicIps: string[];
        privateIps: string[];
        assigned_vmids: number[];
        username: string;
        password: string;
        node?: string; // ADD THIS
        pmx_type?: string; // ADD THIS
      },
      addVM: (vm: any) => Promise<string>,
    ) => {
      const t = task;
      if (!t) {
        console.error("Task is null/undefined");
        return;
      }

      // Calculate expiry using VM's created_at (service provision date)
      // Formula: created_at + duration + 1 day
      let expiry: string | undefined;
      let durationValue: number | undefined;
      let start_date: string | undefined;
      let end_date: string | undefined;

      // Parse duration string to extract number and unit
      const parseDuration = (durationStr: string | number | null | undefined): { value: number; unit: 'days' | 'months' } | null => {
        if (!durationStr) return null;

        // If it's already a number, assume months (backward compatibility)
        if (typeof durationStr === 'number') {
          return { value: durationStr, unit: 'months' };
        }

        // Parse string format like "14 days", "1 month", "3 months"
        const match = String(durationStr).match(/^(\d+)\s+(day|days|month|months)$/);
        if (match) {
          const value = parseInt(match[1], 10);
          const unitStr = match[2].toLowerCase();
          const unit = unitStr.startsWith('day') ? 'days' : 'months';
          return { value, unit };
        }

        // Fallback: try to parse as integer (backward compatibility)
        const num = parseInt(String(durationStr), 10);
        if (!isNaN(num)) {
          return { value: num, unit: 'months' };
        }

        return null;
      };

      const parsedDuration = parseDuration(t.duration);

      // Handle trial requests - set expiry and duration
      if (t.request_type === "trial") {
        // Trial defaults to 14 days
        durationValue = 14; // Set duration for trial VMs
        if (t.created_at) {
          const startDate = new Date(t.created_at);
          start_date = startDate.toISOString();
          const expiryDate = new Date(startDate);
          expiryDate.setDate(expiryDate.getDate() + 14 + 1); // Add 14 days for trial + 1 day

          expiry = expiryDate.toISOString();
          end_date = expiry;

        }
      } else if (parsedDuration) {
        // Paid requests use duration from request
        durationValue = parsedDuration.value;

        if (t.created_at) {
          const startDate = new Date(t.created_at);
          start_date = startDate.toISOString();
          const expiryDate = new Date(startDate);

          if (parsedDuration.unit === 'days') {
            // Add days
            expiryDate.setDate(expiryDate.getDate() + parsedDuration.value);
          } else {
            // Add months
            expiryDate.setMonth(expiryDate.getMonth() + parsedDuration.value);
          }

          expiryDate.setDate(expiryDate.getDate() + 1); // Add 1 day to expiry

          expiry = expiryDate.toISOString();
          end_date = expiry;

        }
      } else {
      }

      const qty = t.qty || 1;
      const vmIds: string[] = [];

      // Find the next available hostname number by checking existing VMs
      const { data: existingVMs } = await supabase
        .from("vms")
        .select("hostname")
        .like("hostname", `${t.hostname}-%`);

      let maxNumber = 0;
      if (existingVMs) {
        existingVMs.forEach((vm: any) => {
          const match = vm.hostname.match(new RegExp(`^${t.hostname}-(\\d+)$`));
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });
      }

      for (let i = 0; i < qty; i++) {
        const assignedVmid = vmDetails.assigned_vmids[i] || null;

        // Check for duplicate assigned VM ID (Proxmox ID) in both vms and vm_ownership tables
        if (assignedVmid) {
          const { data: existingVM } = await supabase
            .from("vms")
            .select("id, hostname")
            .eq("assigned_vmid", assignedVmid)
            .maybeSingle();

const { data: existingOwnership } = await supabase
            .from("vm_ownership")
            .select("vmid")
            .eq("vmid", assignedVmid)
            .maybeSingle();

// Handle orphaned records: VM exists in vms but not in vm_ownership
          if (existingVM && !existingOwnership) {
            await supabase.from("vms").delete().eq("id", existingVM.id);
          } else if (existingVM || existingOwnership) {
            const source = existingVM ? 'vms table' : 'vm_ownership table';
            throw new Error(`Proxmox VM ID ${assignedVmid} is already in use in ${source}. Please use a different VM ID.`);
          }
        }

        const vmData = {
          hostname: `${t.hostname}-${maxNumber + i + 1}`,
          public_ip: vmDetails.publicIps[i] || vmDetails.publicIps[0],
          private_ip: vmDetails.privateIps[i] || vmDetails.privateIps[0],
          username: vmDetails.username,
          password: vmDetails.password,
          vcpu: t.vcpu,
          ram_gb: t.ram_gb ?? t.ram,
          storage_gb: t.storage_gb ?? t.storage,
          status: "Active",
          power_state: "Running",
          customer_id: t.customer_id,
          vm_request_id: t.id,
          task_type: t.task_type,
          expiry: expiry,
          duration: t.request_type === 'trial' ? '14 days' : (parsedDuration ? `${parsedDuration.value} month${parsedDuration.value > 1 ? 's' : ''}` : `${durationValue || 12} month${(durationValue || 12) > 1 ? 's' : ''}`),
          start_date: start_date,
          end_date: end_date,
          legacy_id: undefined, // Let database trigger generate VPS-TDC-{customer_id}-{vm_number}-{customer_name} format
          assigned_vmid: assignedVmid,
          node: vmDetails.node || "pve1", // ADD THIS
          pmx_type: vmDetails.pmx_type || "qemu", // ADD THIS
          backup_enabled: t.backup_enabled || false,
          backup_type: t.backup_type || "weekly",
          // Copy request_type from vm_request
          request_type: t.request_type,
          // Copy OS fields from vm_request
          os_name: t.os_name,
          os_version: t.os_version,
          custom_os_name: t.custom_os_name,
          custom_os_version: t.custom_os_version,
          // Copy network fields from vm_request
          zone: t.zone,
          nics: t.nics,
          public_ip_required: t.public_ip_required,
          firewall_ports: t.firewall_ports,
          firewall_outbound_allow_all: t.firewall_outbound_allow_all,
          firewall_outbound_custom_ports: t.firewall_outbound_custom_ports,
          // Copy other fields from vm_request
          purpose: t.purpose,
          sizing: t.sizing,
          storage_partitions: t.storage_partitions,
          qty: t.qty,
          // Set provision_status to 'completed' for provisioned VMs
          provision_status: "completed",
        };
        try {
          // addVM writes the vm_ownership binding itself (via proxmox-proxcy's
          // admin bindings endpoint, when vmData.assigned_vmid is set) — it
          // encrypts the password server-side, which a direct client-side
          // insert here can't do, so there is intentionally no second
          // vm_ownership write in this function.
          const vmId = await addVM(vmData);
          vmIds.push(vmId);
        } catch (error: any) {
          throw error;
        }
      }

    },
    [],
  );

  // Function to update VM expiry when quotation is created
  const updateVMExpiryForRequest = useCallback(
    async (
      vmRequestId: string,
      durationMonths: number = 3,
      updateVM?: (id: string, patch: any) => Promise<void>,
    ) => {

      // Get VMs for this request to get their created_at
      const { data: vms } = await supabase
        .from("vms")
        .select("id, created_at")
        .eq("vm_request_id", vmRequestId);

      if (vms && vms.length > 0) {
        // Update each VM with expiry calculated from its created_at
        for (const vm of vms) {
          if (vm.created_at) {
            // Calculate expiry: created_at + duration + 1 day
            const startDate = new Date(vm.created_at);
            const expiryDate = new Date(startDate);
            expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
            expiryDate.setDate(expiryDate.getDate() + 1); // Add 1 day to expiry
            const expiry = expiryDate.toISOString();

            if (updateVM) {
              await updateVM(vm.id, { expiry, end_date: expiry });
            } else {
              await supabase.from("vms").update({ expiry, end_date: expiry }).eq("id", vm.id);
            }
          }
        }
      } else {
      }
    },
    [],
  );

  // Function to update add-on service duration when renewal is complete
  const updateAddonExpiryForVM = useCallback(
    async (vmId: string, durationMonths: number) => {

      // Get ONLY pending add-on requests for this VM (renewal requests)
      const { data: pendingAddonRequests } = await supabase
        .from("addon_requests")
        .select("*")
        .eq("vm_id", vmId)
        .eq("status", "Pending");

      if (pendingAddonRequests && pendingAddonRequests.length > 0) {

        for (const addon of pendingAddonRequests) {
          let newDuration: string;

          // For pending renewal requests, parse the renewal duration from addon request
          let renewalMonths = durationMonths;
          let renewalDays = 0;

          if (addon.duration) {
            const monthsMatch = addon.duration.match(/(\d+)\s*months?/i);
            const daysMatch = addon.duration.match(/(\d+)\s*days?/i);
            if (monthsMatch) renewalMonths = parseInt(monthsMatch[1]);
            if (daysMatch) renewalDays = parseInt(daysMatch[1]);
          }

          // Check if addon service exists for this VM
          const { data: existingService } = await supabase
            .from("addon_services")
            .select("*")
            .eq("vm_id", vmId)
            .maybeSingle()

          if (existingService) {
            // Parse existing addon service duration and add renewal months/days
            let currentMonths = 0;
            let currentDays = 0;

            if (existingService.duration) {
              const monthsMatch = existingService.duration.match(/(\d+)\s*months?/i);
              const daysMatch = existingService.duration.match(/(\d+)\s*days?/i);
              if (monthsMatch) currentMonths = parseInt(monthsMatch[1]);
              if (daysMatch) currentDays = parseInt(daysMatch[1]);
            }

            // Add renewal to existing duration
            currentMonths += renewalMonths;
            currentDays += renewalDays;

            // Convert excess days to months if needed
            if (currentDays > 28) {
              const extraMonths = Math.floor(currentDays / 30);
              currentMonths += extraMonths;
              currentDays = currentDays % 30;
            }

            // Build new duration string
            if (currentDays > 0) {
              newDuration = `${currentMonths} months ${currentDays} days`;
            } else {
              newDuration = `${currentMonths} months`;
            }

            // Calculate new expiry from existing service expiry
            const currentExpiry = existingService.expiry ? new Date(existingService.expiry) : new Date();
            const newExpiry = new Date(currentExpiry);
            // Add months first
            if (renewalMonths > 0) {
              newExpiry.setMonth(newExpiry.getMonth() + renewalMonths);
            }
            // Then add days from renewal duration
            if (renewalDays > 0) {
              newExpiry.setDate(newExpiry.getDate() + renewalDays);
            }
// Add 1 day grace period
            newExpiry.setDate(newExpiry.getDate() + 1);

            // Update existing addon service with new duration and expiry
            await supabase
              .from("addon_services")
              .update({
                duration: newDuration,
                end_date: newExpiry.toISOString(),
                expiry: newExpiry.toISOString()
              })
              .eq("id", existingService.id)
          } else {
            // Create new addon service record with renewal duration
            // Build duration string from renewal request
            if (renewalDays > 0) {
              newDuration = `${renewalMonths} months ${renewalDays} days`;
            } else {
              newDuration = `${renewalMonths} months`;
            }

            // Calculate new expiry from addon request start date
            const startDate = addon.start_date ? new Date(addon.start_date) : new Date();
            const newExpiry = new Date(startDate);
            // Add months first
            if (renewalMonths > 0) {
              newExpiry.setMonth(newExpiry.getMonth() + renewalMonths);
            }
// Then add days from renewal duration
            if (renewalDays > 0) {
              newExpiry.setDate(newExpiry.getDate() + renewalDays);
            }
            // Add 1 day grace period
            newExpiry.setDate(newExpiry.getDate() + 1);
            
            await supabase
              .from("addon_services")
              .insert({
                vm_id: vmId,
                cpfs_enabled: addon.cpfs_enabled,
                cpfs_package: addon.cpfs_package,
                ccis_enabled: addon.ccis_enabled,
                ccis_package: addon.ccis_package,
                start_date: addon.start_date,
                end_date: newExpiry.toISOString(),
                expiry: newExpiry.toISOString(),
                duration: newDuration,
                status: 'Active',
                operational_status: 'Active'
              })
          }

          // Update add-on request status to Completed
          await supabase
            .from("addon_requests")
            .update({
              status: "Completed"
            })
            .eq("id", addon.id);
        }
      } else {
      }
    },
    [],
  );

  const removeTask = useCallback((id: string) => {
    setTasks((s) => s.filter((t) => t.id !== id));
  }, []);

  const moveTask = useCallback(
    (id: string, to: number) => {
      // Convert stage number to status string
      const stageToStatus: Record<number, string> = {
        0: "Pending",
        1: "In Progress",
        2: "In Progress",
        3: "In Progress",
        4: "In Progress",
        5: "In Progress",
        6: "Done",
      };
      const status = stageToStatus[to] || "Pending";
      const t = tasks.find((t) => t.id === id);
      if (!t || t.status === status) return;
      updateTask(id, { status });
    },
    [tasks, updateTask],
  );

  return {
    tasks,
    addTask,
    updateTask,
    removeTask,
    moveTask,
    advanceProvision,
    createVMManually,
    setTasks,
    updateVMExpiryForRequest,
    updateAddonExpiryForVM,
  };
};

export default useTaskStore;
