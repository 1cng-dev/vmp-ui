import { useEffect, useRef, useState } from "react";
import {
  getVMStatus,
  getVMStats,
  type ProxmoxVMStatus,
  type ProxmoxRRDPoint,
  type RRDTimeframe,
} from "../lib/proxmoxApi";

// Polls proxmox-proxcy for live VM status. No push infra exists in this
// portal today, so "real time" here means a short poll interval — good
// enough for a usage dashboard, cheap on proxmox-proxcy's 100req/min limit.
export function useVMStatus(vmid?: number | null, intervalMs = 5000) {
  const [status, setStatus] = useState<ProxmoxVMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vmid) {
      setStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchStatus = async () => {
      try {
        const detail = await getVMStatus(vmid);
        if (cancelled) return;
        setStatus(detail.status);
        setError(null);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || "Failed to load VM status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [vmid, intervalMs]);

  return { status, loading, error };
}

export function useVMStats(
  vmid?: number | null,
  timeframe: RRDTimeframe = "hour",
  intervalMs = 60000,
) {
  const [data, setData] = useState<ProxmoxRRDPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  useEffect(() => {
    if (!vmid) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchStats = async () => {
      try {
        const points = await getVMStats(vmid, timeframeRef.current);
        if (cancelled) return;
        setData(points);
        setError(null);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || "Failed to load VM usage history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    const id = setInterval(fetchStats, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [vmid, timeframe, intervalMs]);

  return { data, loading, error };
}
