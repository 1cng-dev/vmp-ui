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

// ── Calls ───────────────────────────────────────────────────────────────

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

export default proxmoxApi;
