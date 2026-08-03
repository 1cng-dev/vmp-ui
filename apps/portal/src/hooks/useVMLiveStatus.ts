import { useCallback, useEffect, useRef, useState } from "react";
import {
  getVMStatus,
  getVMStats,
  getVMStatusByRecord,
  getVMStatsByRecord,
  getVMCredentials,
  type ProxmoxVMStatus,
  type ProxmoxRRDPoint,
  type RRDTimeframe,
  type VMCredentials,
} from "../lib/proxmoxApi";

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.message || fallback;
}

// Shared polling shape for both the vmid-keyed (admin) and record-keyed
// (customer) status/stats hooks below. No push infra exists in this portal
// today, so "real time" here means a short poll interval — good enough for
// a usage dashboard, cheap on proxmox-proxcy's rate limits.
function usePolled<T>(
  key: string | number | null | undefined,
  fetchFn: (key: string | number) => Promise<T>,
  intervalMs: number,
  initial: T,
) {
  const [value, setValue] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    if (!key) {
      setValue(initial);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const result = await fetchRef.current(key);
        if (cancelled) return;
        setValue(result);
        setError(null);
      } catch (err: any) {
        if (cancelled) return;
        setError(errorMessage(err, "Failed to load VM data"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);

  return { value, loading, error };
}

// ── Admin (vmid-keyed) ──────────────────────────────────────────────────

export function useVMStatus(vmid?: number | null, intervalMs = 5000) {
  const { value, loading, error } = usePolled<ProxmoxVMStatus | null>(
    vmid,
    async (k) => (await getVMStatus(k as number)).status,
    intervalMs,
    null,
  );
  return { status: value, loading, error };
}

export function useVMStats(vmid?: number | null, timeframe: RRDTimeframe = "hour", intervalMs = 60000) {
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;
  const { value, loading, error } = usePolled<ProxmoxRRDPoint[]>(
    vmid,
    (k) => getVMStats(k as number, timeframeRef.current),
    intervalMs,
    [],
  );
  return { data: value, loading, error };
}

// ── Customer (opaque record-id-keyed) ───────────────────────────────────
// recordId is vms_customer_safe.ownership_record_id — never the real vmid.

export function useVMStatusByRecord(recordId?: string | null, intervalMs = 5000) {
  const { value, loading, error } = usePolled<ProxmoxVMStatus | null>(
    recordId,
    (k) => getVMStatusByRecord(k as string),
    intervalMs,
    null,
  );
  return { status: value, loading, error };
}

export function useVMStatsByRecord(
  recordId?: string | null,
  timeframe: RRDTimeframe = "hour",
  intervalMs = 60000,
) {
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;
  const { value, loading, error } = usePolled<ProxmoxRRDPoint[]>(
    recordId,
    (k) => getVMStatsByRecord(k as string, timeframeRef.current),
    intervalMs,
    [],
  );
  return { data: value, loading, error };
}

// Credentials are fetched on demand (button click), never polled — every
// call decrypts and audit-logs a reveal server-side.
export function useVMCredentials(recordId?: string | null) {
  const [credentials, setCredentials] = useState<VMCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reveal = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    setError(null);
    try {
      const creds = await getVMCredentials(recordId);
      setCredentials(creds);
    } catch (err: any) {
      setError(errorMessage(err, "Failed to load credentials"));
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  const hide = useCallback(() => setCredentials(null), []);

  return { credentials, loading, error, reveal, hide };
}
