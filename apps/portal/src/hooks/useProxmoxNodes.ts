import { useEffect, useState } from "react";
import { listNodes, type ProxmoxNode } from "../lib/proxmoxApi";

// Cluster node topology is dynamic — nodes can be added or removed at any
// time (see proxmox-proxcy's README, "Multi-node & VM migration handling").
// Fetched once per mount rather than polled — this backs an admin/engineer
// form control (node autocomplete for VM binding), not a live status view,
// so a form staying open across an actual topology change is an edge case,
// not something worth polling for.
export default function useProxmoxNodes() {
  const [nodes, setNodes] = useState<ProxmoxNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNodes()
      .then((data) => {
        if (cancelled) return;
        setNodes(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load nodes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { nodes, loading, error };
}
