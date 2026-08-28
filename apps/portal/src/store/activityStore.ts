import React, {
  useState,
  useCallback,
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import type { Activity } from "../types";

export interface ActivityStoreValue {
  activity: Activity[];
  activityLoading: boolean;
  loadActivity: () => Promise<void>;
  logActivity: (
    text: string,
    kind?: string,
    actor?: string,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
  subscribeToActivity: () => () => void;
}

// ── Global Activity Context Store ─────────────────────────────────────────────
const ActivityContext = createContext<ActivityStoreValue | null>(null);

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);

    const MIN_LOADING_TIME = 400; // 400ms minimum loading time
    const startTime = Date.now();

    try {
      // Fetch from activity_log table
      const { data: activityLogData, error: activityLogError } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (activityLogError) throw activityLogError;

      // Fetch from vm_action_audit table
      const { data: vmAuditData, error: vmAuditError } = await supabase
        .from("vm_action_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (vmAuditError) throw vmAuditError;

      const transformedActivityLog = (activityLogData || []).map((a: any) => ({
        ts: new Date(a.created_at).toLocaleString(),
        actor: a.actor || "System",
        kind: a.kind || "system",
        text: a.text,
        source: "activity_log",
        createdAt: a.created_at,
      }));

      // Get unique actor ids from activity_log and user_ids from vm_action_audit
      const isUuid = (s: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
      const actorIds = [...new Set((activityLogData || []).map((a: any) => a.actor).filter((x: any) => x && isUuid(x)))];
      const userIds = [...new Set((vmAuditData || []).map((a: any) => a.user_id).filter(Boolean))];
      const allCustomerIds = [...new Set([...actorIds, ...userIds])];
      
      // Fetch customer names and legacy_ids for these ids
      let customerLegacyMap: Record<string, string> = {};
      let customerNameMap: Record<string, string> = {};
      if (allCustomerIds.length > 0) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, legacy_id')
          .in('id', allCustomerIds);
        
        if (customers) {
          customers.forEach((c: any) => {
            customerLegacyMap[c.id] = c.legacy_id || c.id;
            customerNameMap[c.id] = c.name || c.legacy_id || c.id;
          });
        }
      }

      // Resolve activity_log actor UUIDs to customer name (legacy id)
      transformedActivityLog.forEach((a: any) => {
        const name = customerNameMap[a.actor];
        const legacy = customerLegacyMap[a.actor];
        a.actor = name && legacy ? `${name} (${legacy})` : (legacy || a.actor || "System");
      });

      // Transform vm_action_audit data
      const transformedVmAudit = (vmAuditData || []).map((a: any) => ({
        ts: new Date(a.created_at).toLocaleString(),
        actor: a.user_id ? (customerLegacyMap[a.user_id] || a.user_id) : "System",
        kind: "vm",
        text: `VM ${a.vmid} on ${a.node}: ${a.action} - ${a.result}`,
        source: "vm_action_audit",
        createdAt: a.created_at,
        vmid: a.vmid,
        node: a.node,
        action: a.action,
        result: a.result,
        ip_address: a.ip_address,
      }));

      // Merge and sort by created_at
      const combinedActivity = [
        ...transformedActivityLog,
        ...transformedVmAudit,
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 100);

      setActivity(combinedActivity);
    } catch (error) {
      console.error("Error loading activity:", error);
    } finally {
      // Ensure minimum loading time
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      setActivityLoading(false);
    }
  }, []);

  const logActivity = useCallback(
    async (
      text: string,
      kind = "vm",
      actor = "You",
      meta?: Record<string, unknown>,
    ) => {
      try {
        const { error } = await supabase.from("activity_log").insert({
          actor,
          actor_role: "staff",
          kind,
          text,
          meta: meta || {},
        });

        if (error) throw error;

        // Refresh to get the latest activity
        await loadActivity();
      } catch (error) {
        console.error("Error logging activity:", error);
      }
    },
    [loadActivity],
  );

  const subscribeToActivity = useCallback(() => {
    const channelName = "activity-log-changes";
    const channel = supabase.channel(channelName);

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        () => {
          loadActivity();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vm_action_audit" },
        () => {
          loadActivity();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadActivity]);

  // Set up real-time subscription on mount
  useEffect(() => {
    loadActivity();
    const unsubscribe = subscribeToActivity();
    return () => unsubscribe();
  }, [subscribeToActivity]);

  const value: ActivityStoreValue = {
    activity,
    activityLoading,
    loadActivity,
    logActivity,
    subscribeToActivity,
  };

  return React.createElement(
    ActivityContext.Provider,
    { value },
    children as any,
  );
};

export const useActivityStore = (): ActivityStoreValue => {
  const ctx = useContext(ActivityContext);
  if (!ctx)
    throw new Error("useActivityStore must be used within ActivityProvider");
  return ctx;
};

export default useActivityStore;
