import React, {
  useState,
  useCallback,
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import type { NewVMInput } from "../types";
import { createAlert } from "../services/notificationService";
import useActivityStore from "./activityStore";
import { createVMBindings } from "../lib/proxmoxApi";

// Use the VM interface that matches the vms table (line 215 in types/index.ts)
export interface VM {
  id: string;
  hostname: string;
  public_ip?: string;
  private_ip?: string;
  username?: string;
  password?: string;
  vcpu: number;
  ram_gb: number;
  storage_gb: number;
  status: "Active" | "Suspended" | "Terminated";
  power_state: "Running" | "Stopped" | "Paused";
  customer_id?: string;
  vm_request_id?: string;
  task_type?: "new" | "change-plan" | "renewal" | "addon";
  expiry?: string;
  duration?: string | number;
  legacy_id?: string;
  assigned_vmid?: number;
  node?: string; // ADD THIS
  pmx_type?: string; // ADD THIS
  created_at: string;
  updated_at: string;
  start_date?: string | null;
  end_date?: string | null;
  backup_enabled?: boolean;
  backup_type?: string;
  // Additional fields for direct VM creation
  os_name?: string;
  os_version?: string;
  custom_os_name?: string | null;
  custom_os_version?: string | null;
  zone?: string;
  nics?: any;
  firewall_ports?: string[];
  firewall_outbound_allow_all?: boolean;
  firewall_outbound_custom_ports?: string[];
  public_ip_required?: boolean;
  purpose?: string;
  sizing?: string;
  storage_partitions?: string;
  qty?: number;
  provision_status?: string;
  request_type?: "trial" | "paid";
  // Present only when loaded via vms_customer_safe (customer role) — the
  // opaque vm_ownership.id proxmox-proxcy's by-record routes use in place of
  // the real Proxmox vmid. Absent for staff, who load the full `vms` table.
  ownership_record_id?: string | null;
}

export interface VMRequest {
  id: string;
  customer_id: string;
  request_type: "trial" | "paid";
  hostname: string;
  purpose?: string;
  vcpu: number;
  ram_gb: number;
  storage: number;
  qty: number;
  duration?: number;
  sizing?: string;
  storage_partitions?: string;
  os_name?: string;
  os_version?: string;
  custom_os_name?: string;
  custom_os_version?: string;
  zone?: string;
  nics?: any[];
  public_ip_required?: boolean;
  firewall_ports?: string[];
  firewall_outbound_allow_all: boolean
  firewall_outbound_custom_ports: string[]
  backup_enabled?: boolean;
  backup_type?: string;
  notes?: string;
  status?: string;
  legacy_id?: string;
  assigned_vmid?: number;
  created_at: string;
  updated_at: string;
}

export interface AddonRequest {
  id: string;
  vm_id: string;
  cpfs_enabled?: boolean;
  cpfs_package?: string;
  ccis_enabled?: boolean;
  ccis_package?: string;
  duration?: number;
  status: string;
  operational_status?: "Active" | "Expired" | "Terminated";
  legacy_id?: string;
  created_at: string;
  updated_at: string;
}

export interface VMStoreValue {
  vms: VM[];
  vmsLoading: boolean;
  vmRequests: VMRequest[];
  addonRequests: AddonRequest[];
  loadVMs: () => Promise<void>;
  loadVMRequests: () => Promise<void>;
  loadAddonRequests: () => Promise<void>;
  getVMRequest: (vmRequestId: string) => VMRequest | undefined;
  getVMById: (vmId: string) => VM | undefined;
  getVMByHostname: (hostname: string) => VM | undefined;
  addVM: (vm: NewVMInput) => Promise<string>;
  updateVM: (id: string, patch: Partial<VM>) => Promise<void>;
  deleteVM: (id: string) => Promise<void>;
  // Real power control (start/stop/shutdown/reboot/reset/suspend/resume) is
  // proxmox-proxcy's by-record routes, called directly via
  // hooks/useVMLiveStatus.ts's useVMPowerAction — not this store. The old
  // startVM/stopVM/restartVM here only ever flipped vms.power_state in
  // Supabase; removed so nothing accidentally treats that column as ground
  // truth for a VM's actual power state again.
  snapshotVM: (id: string, name: string) => Promise<void>;
  updateVMTags: (id: string, tags: string[]) => Promise<void>;
  updateVMNotes: (id: string, notes: string) => Promise<void>;
  checkDuplicateLegacyId: (legacyId: string) => boolean
}

const VMContext = createContext<VMStoreValue | null>(null);

export const VMProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [vms, setVms] = useState<VM[]>([]);
  const [vmsLoading, setVmsLoading] = useState(false);
  const [vmRequests, setVmRequests] = useState<VMRequest[]>([]);
  const [addonRequests, setAddonRequests] = useState<AddonRequest[]>([]);
  const { logActivity } = useActivityStore();

  const loadVMs = useCallback(async () => {
    setVmsLoading(true);

    try {
      // vms holds assigned_vmid/node/password columns customers must never
      // see (RLS also revokes column-level access to those directly, this
      // just picks the right query up front). Staff (a row in team_members)
      // get the full table; everyone else gets the customer-safe view.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let isStaff = false;
      if (user) {
        const { data: staffRow } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        isStaff = !!staffRow;
      }

      const { data, error } = await supabase
        .from(isStaff ? "vms" : "vms_customer_safe")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVms((data as any) || []);
    } finally {
      setVmsLoading(false);
    }
  }, []);

  const loadVMRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("vm_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVmRequests((data as VMRequest[]) || []);
    } catch (err) {
      console.error("Error loading VM requests:", err);
    }
  }, []);

  const loadAddonRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("addon_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAddonRequests((data as AddonRequest[]) || []);
    } catch (err) {
      console.error("Error loading addon requests:", err);
    }
  }, []);

  const getVMRequest = useCallback(
    (vmRequestId: string): VMRequest | undefined => {
      return vmRequests.find((req) => req.id === vmRequestId);
    },
    [vmRequests],
  );

  const getVMById = useCallback(
    (vmId: string): VM | undefined => {
      return vms.find((vm) => vm.id === vmId);
    },
    [vms],
  );

  const getVMByHostname = useCallback(
    (hostname: string): VM | undefined => {
      return vms.find((vm) => vm.hostname === hostname);
    },
    [vms],
  );

  // Real-time subscription for VM changes
  useEffect(() => {
    const channel = supabase
      .channel(`vms-changes-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "vms",
        },
        () => {
          // Reload VMs when any change occurs
          loadVMs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadVMs]);

  // Real-time subscription for VM requests
  useEffect(() => {
    const channel = supabase
      .channel(`vm-requests-changes-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vm_requests",
        },
        () => {
          loadVMRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadVMRequests]);

  // Initial load
  useEffect(() => {
    loadVMs();
    loadVMRequests();
    loadAddonRequests();
  }, [loadVMs, loadVMRequests, loadAddonRequests]);

  const addVM = useCallback(
    async (vm: NewVMInput) => {
      // Non-sensitive fields only — assigned_vmid/node/pmx_type/username/
      // password are written separately below, through proxmox-proxcy,
      // never as a direct client-side insert. Encrypting the password
      // requires VM_CREDENTIAL_KEY, which lives only in that service's env.
      const newVM = {
        hostname: vm.hostname,
        vcpu: vm.vcpu || 2,
        ram_gb: vm.ram_gb || 8,
        storage_gb: vm.storage_gb || 100,
        status: (vm.status as any) || "Active",
        power_state: (vm.power_state as any) || "Running",
        customer_id: vm.customer_id,
        vm_request_id: vm.vm_request_id,
        task_type: vm.task_type as any,
        expiry: vm.expiry,
        duration: vm.duration,
        legacy_id: vm.legacy_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        start_date: vm.start_date || null,
        end_date: vm.end_date || null,
        request_type: vm.request_type,
        backup_enabled: (vm as any).backup_enabled || false,
        backup_type: (vm as any).backup_type || "weekly",
        os_name: vm.os_name,
        os_version: vm.os_version,
        custom_os_name: vm.custom_os_name,
        custom_os_version: vm.custom_os_version,
        zone: vm.zone,
        nics: vm.nics,
        public_ip_required: vm.public_ip_required,
        firewall_ports: vm.firewall_ports,
        firewall_outbound_allow_all: vm.firewall_outbound_allow_all,
        firewall_outbound_custom_ports: vm.firewall_outbound_custom_ports,
        purpose: vm.purpose,
        sizing: vm.sizing,
        storage_partitions: vm.storage_partitions,
        qty: vm.qty,
        provision_status: vm.provision_status || "completed",
      };

      const { data, error } = await supabase
        .from("vms")
        .insert(newVM)
        .select()
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Failed to create VM - no data returned");
      }

      const insertedVM = data as VM;

      if (vm.assigned_vmid) {
        try {
          await createVMBindings(insertedVM.id, {
            assigned_vmid: vm.assigned_vmid,
            node: vm.node || "pve1",
            pmx_type: vm.pmx_type || "qemu",
            public_ip: vm.public_ip,
            private_ip: vm.private_ip,
            username: vm.username,
            password: vm.password,
          });
        } catch (bindingError: any) {
          await supabase.from("vms").delete().eq("id", insertedVM.id);

          const message =
            bindingError?.response?.data?.error || bindingError?.message || "Failed to bind VM to Proxmox";

          if (String(message).toLowerCase().includes("already")) {
            throw new Error(`VM ID ${vm.assigned_vmid} is already in use. Please use a different VM ID.`);
          }

          throw new Error(`Failed to create VM ownership: ${message}`);
        }
      }

      setVms((s) => [insertedVM, ...s]);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      let actorName = "System";


      if (user) {
        const { data: staff } = await supabase
          .from("team_members")
          .select("name, staff_code")
          .eq("user_id", user.id)
          .maybeSingle();

        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`;
        } else {
          actorName = user.user_metadata?.name || user.email || "System";
        }
      }

      await logActivity(`Created VM: ${insertedVM.hostname}`, "vm", actorName, {
        vmId: insertedVM.legacy_id || insertedVM.id,
        hostname: insertedVM.hostname,
        customerId: insertedVM.customer_id,
      });

      return insertedVM.id;
    },
    [logActivity],
  );

  const updateVM = useCallback(
    async (id: string, patch: Partial<VM>) => {
      const previousVM = vms.find((v) => v.id === id);
      const { error } = await supabase.from("vms").update(patch).eq("id", id);
      if (error) throw error;
      await loadVMs();

      // Get current user (staff member) who made the change
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let actorName = "System";
      if (user) {
        const { data: staff } = await supabase
          .from("team_members")
          .select("name, staff_code")
          .eq("user_id", user.id)
          .single();
        if (staff) {
          actorName = `${staff.name} (${staff.staff_code})`;
        } else {
          // Fallback to user's name or email if not in team_members
          actorName = user.user_metadata?.name || user.email || "System";
        }
      }

      // Create notification and activity log for status change
      if (patch.status && previousVM && patch.status !== previousVM.status) {
        await logActivity(
          `Changed VM ${previousVM.hostname} status from ${previousVM.status} to ${patch.status}`,
          "vm",
          actorName,
          {
            vmId: previousVM.legacy_id || previousVM.id,
            hostname: previousVM.hostname,
            previousStatus: previousVM.status,
            newStatus: patch.status,
          },
        );

        let actorId = previousVM.customer_id;
        if (user) actorId = user.id;

        await createAlert({
          sev: "info",
          title: "VM Status Changed",
          body: `VM ${previousVM.hostname} (${previousVM.legacy_id || previousVM.id}) status changed from ${previousVM.status} to ${patch.status}`,
          type: "vm",
          related_entity_id: id,
          related_entity_type: "vm",
          actor_id: actorId,
          actor_name: actorName,
          customer_id: previousVM.customer_id,
          metadata: {
            vm_id: previousVM.legacy_id || previousVM.id,
            hostname: previousVM.hostname,
            previous_status: previousVM.status,
            new_status: patch.status,
            customer_id: previousVM.customer_id,
          },
        });
      }
    },
    [loadVMs, vms, logActivity],
  );

  const snapshotVM = useCallback(async (_id: string, _name: string) => {
    // In the future, this will call Proxmox API to create a snapshot
    // For now, it's a placeholder
  }, []);

  const updateVMTags = useCallback(
    async (id: string, tags: string[]) => {
      const { error } = await supabase
        .from("vms")
        .update({ tags })
        .eq("id", id);
      if (error) throw error;
      await loadVMs();
    },
    [loadVMs],
  );

  const updateVMNotes = useCallback(
    async (id: string, notes: string) => {
      const { error } = await supabase
        .from("vms")
        .update({ notes })
        .eq("id", id);
      if (error) throw error;
      await loadVMs();
    },
    [loadVMs],
  );

  const deleteVM = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("vms").delete().eq("id", id);
      if (error) throw error;
      await loadVMs();
    },
    [loadVMs],
  );

  const checkDuplicateLegacyId = useCallback((legacyId: string): boolean => {
    if (!legacyId) return false
    return vms.some(v => v.legacy_id === legacyId)
  }, [vms])

  const value: VMStoreValue = {
    vms,
    vmsLoading,
    vmRequests,
    addonRequests,
    loadVMs,
    loadVMRequests,
    loadAddonRequests,
    getVMRequest,
    getVMById,
    getVMByHostname,
    addVM,
    updateVM,
    deleteVM,
    snapshotVM,
    updateVMTags,
    updateVMNotes,
    checkDuplicateLegacyId,
  };
  return React.createElement(VMContext.Provider, { value }, children as any);
};

export const useVMStore = (): VMStoreValue => {
  const ctx = useContext(VMContext);
  if (!ctx) throw new Error("useVMStore must be used within VMProvider");
  return ctx;
};

export default useVMStore;
