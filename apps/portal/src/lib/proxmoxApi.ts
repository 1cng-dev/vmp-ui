import axios from "axios";
import { supabase } from "./supabase";

// Client for proxmox-proxcy — the only thing the portal ever calls for VM
// status/usage. The portal must never talk to the Proxmox API directly;
// proxmox-proxcy holds the Proxmox token and enforces per-VM ownership.
const proxmoxApi = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || "",
  timeout: 15000,
});

proxmoxApi.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ── Response shapes (subset of proxmox-proxcy's fields we actually use) ────

export interface ProxmoxVMSummary {
  vmid: number;
  node: string;
  name?: string;
  status: string; // 'running' | 'stopped' | 'unknown' | ...
  cpu?: number; // 0–1 fraction
  maxcpu?: number;
  mem?: number; // bytes
  maxmem?: number; // bytes
  disk?: number; // bytes (0 without a QEMU guest agent in the guest)
  maxdisk?: number; // bytes
  uptime?: number; // seconds
  netin?: number;
  netout?: number;
}

export interface ProxmoxVMStatus {
  status: string;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  netin?: number;
  netout?: number;
  name?: string;
  [key: string]: unknown;
}

export interface ProxmoxVMDetail {
  vmid: number;
  status: ProxmoxVMStatus;
  config: Record<string, unknown>;
}

export interface ProxmoxRRDPoint {
  time: number;
  cpu?: number | null;
  mem?: number | null;
  maxmem?: number | null;
  disk?: number | null;
  maxdisk?: number | null;
  netin?: number | null;
  netout?: number | null;
}

export type RRDTimeframe = "hour" | "day" | "week" | "month" | "year";

export type PowerAction = "start" | "stop" | "shutdown" | "reboot" | "reset" | "suspend" | "resume";

export interface VMCredentials {
  username: string | null;
  password: string | null;
}

// ── Calls, keyed by the real Proxmox vmid — admin/internal use only ───────
// (the admin portal already has assigned_vmid via the full `vms` table, and
// proxmox-proxcy's admin bypass on these routes lets staff view any VM.)

export async function listVMs(): Promise<{ scope: "all" | "owned"; data: ProxmoxVMSummary[] }> {
  const { data } = await proxmoxApi.get("/api/vms");
  return { scope: data.scope, data: data.data };
}

export async function getVMStatus(vmid: number): Promise<ProxmoxVMDetail> {
  const { data } = await proxmoxApi.get(`/api/vms/${vmid}`);
  return { vmid: data.vmid, status: data.status, config: data.config };
}

export async function getVMStats(
  vmid: number,
  timeframe: RRDTimeframe = "hour",
): Promise<ProxmoxRRDPoint[]> {
  const { data } = await proxmoxApi.get(`/api/vms/${vmid}/stats`, {
    params: { timeframe },
  });
  return data.data || [];
}

// ── Calls, keyed by vm_ownership.id — what the customer-facing portal uses ─
// The browser never holds or sends the real Proxmox vmid for these; the
// opaque record ID comes from vms_customer_safe.ownership_record_id.

export async function getVMStatusByRecord(recordId: string): Promise<ProxmoxVMStatus> {
  const { data } = await proxmoxApi.get(`/api/vms/by-record/${recordId}`);
  return data.status;
}

export async function getVMStatsByRecord(
  recordId: string,
  timeframe: RRDTimeframe = "hour",
): Promise<ProxmoxRRDPoint[]> {
  const { data } = await proxmoxApi.get(`/api/vms/by-record/${recordId}/stats`, {
    params: { timeframe },
  });
  return data.data || [];
}

export async function getVMCredentials(recordId: string): Promise<VMCredentials> {
  const { data } = await proxmoxApi.get(`/api/vms/by-record/${recordId}/credentials`);
  return { username: data.username ?? null, password: data.password ?? null };
}

export async function runVMPowerAction(
  recordId: string,
  action: PowerAction,
): Promise<{ upid?: string }> {
  const { data } = await proxmoxApi.post(`/api/vms/by-record/${recordId}/${action}`);
  // Proxmox task objects are just the UPID string itself (data.task), not an object.
  const upid = typeof data.task === "string" ? data.task : undefined;
  return { upid };
}

export interface ProxmoxTaskStatus {
  status: "running" | "stopped" | string;
  exitstatus?: string; // present once status === 'stopped'; 'OK' on success
}

export async function getVMTaskStatus(recordId: string, upid: string): Promise<ProxmoxTaskStatus> {
  const { data } = await proxmoxApi.get(`/api/vms/by-record/${recordId}/task/${encodeURIComponent(upid)}`);
  return data.task;
}

export interface VMConsoleSession {
  sessionToken: string;
  wsPath: string;
  ticket: string;
}

// ticket is required for the RFB handshake tunneled inside the websocket at
// wsPath — see the console route's comment in proxmox-proxcy for why. Fetch
// this only right before opening the console; never persist it.
export async function getVMConsoleSession(recordId: string): Promise<VMConsoleSession> {
  const { data } = await proxmoxApi.get(`/api/vms/by-record/${recordId}/console`);
  return { sessionToken: data.sessionToken, wsPath: data.wsPath, ticket: data.ticket };
}

// ── Admin-only ──────────────────────────────────────────────────────────

export interface VMBindingsInput {
  assigned_vmid: number;
  node: string;
  pmx_type?: string;
  public_ip?: string;
  private_ip?: string;
  username?: string;
  password?: string;
}

// Writes a VM record's real Proxmox vmid/node and login credentials.
// Encrypts the password server-side — this is the only path that ever
// writes it, since the encryption key lives only in proxmox-proxcy's env.
export async function createVMBindings(
  vmId: string,
  bindings: VMBindingsInput,
): Promise<{ vmid: number; node: string }> {
  const { data } = await proxmoxApi.post(`/api/admin/vms/${vmId}/bindings`, bindings);
  return { vmid: data.vmid, node: data.node };
}

export default proxmoxApi;
