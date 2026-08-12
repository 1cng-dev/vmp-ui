import { useCallback, useEffect, useRef, useState } from "react";
import {
  getVMStatus,
  getVMStats,
  getVMStatusByRecord,
  getVMStatsByRecord,
  getVMCredentials,
  runVMPowerAction,
  getVMTaskStatus,
  type ProxmoxVMStatus,
  type ProxmoxRRDPoint,
  type RRDTimeframe,
  type VMCredentials,
  type PowerAction,
} from "../lib/proxmoxApi";
import { supabase } from "../lib/supabase";

// Maps HTTP status to generic, customer-safe copy for every hook in this
// file — status/stats polling, credentials reveal, and power actions all
// surface this directly in a UI banner, so none of them should ever show a
// raw axios message ("Request failed with status code 404") or a backend
// error string that might describe internal routing/ownership detail.
export function friendlyError(err: any): string {
  const status = err?.response?.status;
  if (status === 404) return "This VM could not be found.";
  if (status === 403) return "You don't have access to this VM.";
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  if (status && status >= 500) return "The VM host is temporarily unavailable. Please try again shortly.";
  if (!err?.response) return "Couldn't reach the VM service. Check your connection and try again.";
  return "Something went wrong loading this VM's data. Please try again.";
}

// Shared polling shape for both the vmid-keyed (admin) and record-keyed
// (customer) status/stats hooks below. No push infra exists in this portal
// today, so "real time" here means a short poll interval — good enough for
// a usage dashboard, cheap on proxmox-proxcy's rate limits. Exposes
// `refetch()` so a caller (e.g. a power action finishing) can force an
// immediate refresh instead of waiting for the next interval tick.
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
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!key) {
      setValue(initial);
      setLoading(false);
      setError(null);
      runRef.current = () => {};
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const result = await fetchRef.current(key);
        if (cancelled) return;
        setValue(result);
        setError(null);
      } catch (err: any) {
        if (cancelled) return;
        setError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    runRef.current = () => {
      run();
    };

    setLoading(true);
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);

  const refetch = useCallback(() => runRef.current(), []);

  return { value, loading, error, refetch };
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
  const { value, loading, error, refetch } = usePolled<ProxmoxVMStatus | null>(
    recordId,
    (k) => getVMStatusByRecord(k as string),
    intervalMs,
    null,
  );
  return { status: value, loading, error, refetch };
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
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  const hide = useCallback(() => setCredentials(null), []);

  return { credentials, loading, error, reveal, hide };
}

const TASK_POLL_INTERVAL_MS = 2000;
// Ceiling on how long the UI waits for the task to report done — the action
// itself isn't cancelled server-side if this is hit, only the UI stops
// polling and re-enables controls so the customer isn't stuck forever.
const TASK_POLL_TIMEOUT_MS = 90000;

// Maps power actions to database power_state values
function actionToPowerState(action: PowerAction): "Running" | "Stopped" | "Paused" {
  if (action === "start" || action === "reboot" || action === "reset" || action === "resume") {
    return "Running";
  }
  if (action === "suspend") {
    return "Paused";
  }
  return "Stopped"; // stop, shutdown
}

function actionToExpectedStatus(action: PowerAction): "running" | "stopped" | "paused" | null {
  if (action === "start" || action === "resume") {
    return "running";
  }
  if (action === "stop" || action === "shutdown") {
    return "stopped";
  }
  if (action === "suspend") {
    return "paused";
  }
  return null;
}

function hasReachedExpectedStatus(action: PowerAction, status: ProxmoxVMStatus | null | undefined): boolean {
  if (!status) {
    return false;
  }
  if (action === "suspend") {
    return status.status === "paused" || status.qmpstatus === "paused";
  }
  const expectedStatus = actionToExpectedStatus(action);
  if (!expectedStatus) {
    return true;
  }
  return status.status === expectedStatus;
}

// Runs a power action (start/stop/shutdown/reboot/reset/suspend/resume)
// against proxmox-proxcy's by-record route, polls the returned task to
// completion, then calls onSettled (typically the status hook's refetch) so
// the UI reflects the real end state instead of a guess.
// Also updates the database power_state column to keep the VMs list in sync.
export function useVMPowerAction(recordId?: string | null, onSettled?: () => void) {
  const [pending, setPending] = useState<PowerAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onSettledRef = useRef(onSettled);
  const pendingRef = useRef<PowerAction | null>(null);
  onSettledRef.current = onSettled;

  const run = useCallback(
    async (action: PowerAction) => {
      if (!recordId || pendingRef.current) return;
      pendingRef.current = action;
      setPending(action);
      setError(null);
      try {
        const { upid } = await runVMPowerAction(recordId, action);
        if (upid) {
          const start = Date.now();
          for (;;) {
            if (Date.now() - start > TASK_POLL_TIMEOUT_MS) break;
            await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL_MS));
            const task = await getVMTaskStatus(recordId, upid).catch(() => null);
            if (!task || task.status !== "running") break;
          }
        }

        const expectedStatus = actionToExpectedStatus(action);
        let reachedExpectedStatus = !expectedStatus;

        if (expectedStatus) {
          const start = Date.now();
          for (;;) {
            const status = await getVMStatusByRecord(recordId).catch(() => null);
            if (hasReachedExpectedStatus(action, status)) {
              reachedExpectedStatus = true;
              break;
            }
            if (Date.now() - start > TASK_POLL_TIMEOUT_MS) break;
            await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL_MS));
          }
        }

        // Update database power_state to keep VMs list in sync
        // Find VM by ownership_record_id and update its power_state
        const { data: vm } = await supabase
          .from("vms_customer_safe")
          .select("id")
          .eq("ownership_record_id", recordId)
          .single();

        if (vm && reachedExpectedStatus) {
          const newPowerState = actionToPowerState(action);
          await supabase
            .from("vms")
            .update({ power_state: newPowerState })
            .eq("id", vm.id);
        }
      } catch (err: any) {
        setError(friendlyError(err));
      } finally {
        pendingRef.current = null;
        setPending(null);
        onSettledRef.current?.();
      }
    },
    [recordId],
  );

  return { pending, error, run, clearError: () => setError(null) };
}
