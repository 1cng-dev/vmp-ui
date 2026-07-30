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
        console.log("VM created, would update status to Active");
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
      console.log(
        "createVMManually called with task:",
        task,
        "vmDetails:",
        vmDetails,
      );
      const t = task;
      if (!t) {
        console.error("Task is null/undefined");
        return;
      }
      console.log("Processing task:", t);

      // Calculate expiry using VM's created_at (service provision date)
      // Formula: created_at + duration + 1 day
      let expiry: string | undefined;
      let durationValue: number | undefined;
      let start_date: string | undefined;
      let end_date: string | undefined;

      // Handle trial requests - set expiry but no duration
      if (t.request_type === "trial") {
        // Trial defaults to 14 days
        if (t.created_at) {
          const startDate = new Date(t.created_at);
          start_date = startDate.toISOString();
          const expiryDate = new Date(startDate);
          expiryDate.setDate(expiryDate.getDate() + 14 + 1); // Add 14 days for trial + 1 day

          expiry = expiryDate.toISOString();
          end_date = expiry;

          console.log("Trial expiry calculated:", {
            created_at: t.created_at,
            startDate,
            trialDays: 14,
            expiry,
          });
        }
      } else if (t.duration) {
        // Paid requests use duration from request
        durationValue = parseInt(String(t.duration)) || 3;

        if (t.created_at) {
          const startDate = new Date(t.created_at);
          start_date = startDate.toISOString();
          const expiryDate = new Date(startDate);
          expiryDate.setMonth(expiryDate.getMonth() + durationValue);
          expiryDate.setDate(expiryDate.getDate() + 1); // Add 1 day to expiry

          expiry = expiryDate.toISOString();
          end_date = expiry;

          console.log("Paid expiry calculated:", {
            created_at: t.created_at,
            startDate,
            duration: t.duration,
            durationValue,
            expiry,
          });
        }
      } else {
        console.log("No duration found in task, expiry will be null");
        console.log("Task object keys:", Object.keys(t));
      }

      const qty = t.qty || 1;
      const vmIds: string[] = [];

      for (let i = 0; i < qty; i++) {
        const assignedVmid = vmDetails.assigned_vmids[i] || null;

        // Check for duplicate assigned VM ID (Proxmox ID)
        if (assignedVmid) {
          const { data: existingVM } = await supabase
            .from("vms")
            .select("id")
            .eq("assigned_vmid", assignedVmid)
            .maybeSingle();

          if (existingVM) {
            throw new Error(`Proxmox VM ID ${assignedVmid} is already in use. Please use a different VM ID.`);
          }

          const { data: existingOwnership } = await supabase
            .from("vm_ownership")
            .select("id")
            .eq("vmid", assignedVmid)
            .maybeSingle();

          if (existingOwnership) {
            throw new Error(`Proxmox VM ID ${assignedVmid} is already assigned in ownership records. Please use a different VM ID.`);
          }
        }

        const vmData = {
          hostname: `${t.hostname}-${i + 1}`,
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
          duration: durationValue,
          start_date: start_date,
          end_date: end_date,
          legacy_id: undefined, // Let database trigger generate qemu/3xxx format
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
          // Copy other fields from vm_request
          purpose: t.purpose,
          sizing: t.sizing,
          storage_partitions: t.storage_partitions,
          qty: t.qty,
          // Set provision_status to 'completed' for provisioned VMs
          provision_status: "completed",
        };
        console.log(`About to call addVM for VM ${i + 1}:`, vmData);
        try {
          const vmId = await addVM(vmData);
          vmIds.push(vmId);

          // Insert into vm_ownership with Proxmox details
          try {
            console.log('Inserting into vm_ownership:', {
              user_id: t.customer_id,
              customer_id: t.customer_id,
              vmid: vmDetails.assigned_vmids[i] || null,
              node: vmDetails.node || "pve1",
              pmx_type: vmDetails.pmx_type || "qemu",
            });
            await supabase.from("vm_ownership").insert({
              user_id: t.customer_id,
              customer_id: t.customer_id,
              vmid: vmDetails.assigned_vmids[i] || null,
              node: vmDetails.node || "pve1",
              pmx_type: vmDetails.pmx_type || "qemu",
            });
            console.log('vm_ownership insert successful');
          } catch (ownershipError: any) {
            console.error('vm_ownership insert failed:', ownershipError);
            // Rollback VM creation if ownership insert fails
            await supabase.from("vms").delete().eq("id", vmId);
            if (ownershipError.code === "23505") {
              throw new Error(`VM ID ${vmDetails.assigned_vmids[i]} is already in use. Please use a different VM ID.`);
            }
            throw new Error(`Failed to create VM ownership: ${ownershipError.message}`);
          }

        } catch (error: any) {
          throw error;
        }
      }

      console.log("All VMs created with IDs:", vmIds);
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
      console.log("updateVMExpiryForRequest called:", {
        vmRequestId,
        durationMonths,
      });

      // Get VMs for this request to get their created_at
      const { data: vms } = await supabase
        .from("vms")
        .select("id, created_at")
        .eq("vm_request_id", vmRequestId);

      if (vms && vms.length > 0) {
        console.log(`Found ${vms.length} VMs to update expiry for`);
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
            console.log(`Updated VM ${vm.id} with expiry ${expiry}`);
          }
        }
      } else {
        console.log("No VMs found for this request");
      }
    },
    [],
  );

  // Function to update add-on service duration when renewal is complete
  const updateAddonExpiryForVM = useCallback(
    async (vmId: string, durationMonths: number) => {
      console.log("updateAddonExpiryForVM called:", { vmId, durationMonths });

      // Get ALL add-on requests for this VM (both pending and completed)
      const { data: allAddonRequests } = await supabase
        .from("addon_requests")
        .select("*")
        .eq("vm_id", vmId)
        .in("status", ["Pending", "Completed"]);

      if (allAddonRequests && allAddonRequests.length > 0) {
        console.log(
          `Found ${allAddonRequests.length} add-on requests to update`,
        );

        for (const addon of allAddonRequests) {
          let newDuration: string;

          // Calculate new expiry from addon's current expiry, not VM's expiry
          const currentAddonExpiry = addon.expiry ? new Date(addon.expiry) : new Date();
          const newExpiry = new Date(currentAddonExpiry);
          newExpiry.setMonth(newExpiry.getMonth() + durationMonths);
          newExpiry.setDate(newExpiry.getDate() + 1); // Add 1 day to expiry

          if (addon.status === "Pending") {
            // New add-on from renewal: just use the renewal duration
            newDuration = `${durationMonths} months`;
          } else {
            // Existing add-on: parse current duration and add renewal months
            let currentMonths = 0;
            let currentDays = 0;

            if (addon.duration) {
              // Parse "5 months 29 days" format
              const monthsMatch = addon.duration.match(/(\d+)\s*months?/i);
              const daysMatch = addon.duration.match(/(\d+)\s*days?/i);

              if (monthsMatch) currentMonths = parseInt(monthsMatch[1]);
              if (daysMatch) currentDays = parseInt(daysMatch[1]);
            }

            // Add renewal months
            currentMonths += durationMonths;

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
          }

          // Check if addon service exists for this VM
          const { data: existingService } = await supabase
            .from("addon_services")
            .select("*")
            .eq("vm_id", vmId)
            .maybeSingle()

          if (existingService) {
            // Calculate new duration based on existing service duration + renewal months
            let currentMonths = 0;
            let currentDays = 0;

            if (existingService.duration) {
              // Parse "5 months 29 days" format from existing service
              const monthsMatch = existingService.duration.match(/(\d+)\s*months?/i);
              const daysMatch = existingService.duration.match(/(\d+)\s*days?/i);

              if (monthsMatch) currentMonths = parseInt(monthsMatch[1]);
              if (daysMatch) currentDays = parseInt(daysMatch[1]);
            }

            // Add renewal months to existing duration
            currentMonths += durationMonths;

            // Convert excess days to months if needed
            if (currentDays > 28) {
              const extraMonths = Math.floor(currentDays / 30);
              currentMonths += extraMonths;
              currentDays = currentDays % 30;
            }

            // Build new duration string
            let finalDuration: string;
            if (currentDays > 0) {
              finalDuration = `${currentMonths} months ${currentDays} days`;
            } else {
              finalDuration = `${currentMonths} months`;
            }

            // Update existing addon service with new duration and expiry
            await supabase
              .from("addon_services")
              .update({
                duration: finalDuration,
                end_date: newExpiry.toISOString(),
                expiry: newExpiry.toISOString()
              })
              .eq("id", existingService.id)
            console.log(`Updated addon_service ${existingService.id} for renewal with duration: ${finalDuration}`)
          } else {
            // Create new addon service record
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
            console.log(`Created addon_service for vm ${vmId}`)
          }

          // Update add-on request status to Completed
          await supabase
            .from("addon_requests")
            .update({
              status: "Completed"
            })
            .eq("id", addon.id);
          console.log(
            `Marked add-on request ${addon.id} as Completed`,
          );
        }
      } else {
        console.log("No add-on requests found for this VM");
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
