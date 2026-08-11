import { useState, useEffect } from "react";
import Icon from "../../lib/icons";
import type { Task } from "../../types";
import { supabase } from "../../lib/supabase";
import useUIStore from "../../store/uiStore";
import ProxmoxNodeInput from "../vm/PromoxNodeInput";

interface EngineerVMCreateFormProps {
  task: Task;
  onSubmit: (details: {
    publicIps: string[];
    privateIps: string[];
    assigned_vmids: number[];
    username: string;
    password: string;
    nodes: string[];
    pmx_type: string;
  }) => Promise<void>;
}

const EngineerVMCreateForm = ({
  task,
  onSubmit,
}: EngineerVMCreateFormProps) => {
  const { toast } = useUIStore();
  const qty = (task as any).qty || 1;
  const [publicIps, setPublicIps] = useState<string[]>(() =>
    Array(qty).fill(""),
  );
  const [privateIps, setPrivateIps] = useState<string[]>(() =>
    Array(qty).fill(""),
  );
  const [assigned_vmids, setAssigned_vmids] = useState<number[]>(() =>
    Array(qty).fill(0),
  );
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [nodes, setNodes] = useState<string[]>(() => Array(qty).fill(""));
  const [pmx_type, setPmxType] = useState<string>("qemu");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [nextHostnameNumber, setNextHostnameNumber] = useState<number>(1);

  // Calculate next available hostname number
  useEffect(() => {
    const calculateNextHostnameNumber = async () => {
      const { data: existingVMs } = await supabase
        .from("vms")
        .select("hostname")
        .like("hostname", `${(task as any).hostname}-%`);

      let maxNumber = 0;
      if (existingVMs) {
        existingVMs.forEach((vm: any) => {
          const match = vm.hostname.match(
            new RegExp(`^${(task as any).hostname}-(\\d+)$`),
          );
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });
      }
      setNextHostnameNumber(maxNumber + 1);
    };

    calculateNextHostnameNumber();
  }, [(task as any).hostname]);

  useEffect(() => {
    setPublicIps(Array(qty).fill(""));
    setPrivateIps(Array(qty).fill(""));
    setAssigned_vmids(Array(qty).fill(0));
    setNodes(Array(qty).fill(""));
  }, [qty]);

  const handlePublicIpChange = (index: number, value: string) => {
    const newIps = [...publicIps];
    newIps[index] = value;
    setPublicIps(newIps);
  };

  const handlePrivateIpChange = (index: number, value: string) => {
    const newIps = [...privateIps];
    newIps[index] = value;
    setPrivateIps(newIps);
  };

  const handleAssignedVmidChange = (index: number, value: string) => {
    const newIds = [...assigned_vmids];
    newIds[index] = value ? parseInt(value) : 0;
    setAssigned_vmids(newIds);
  };

  const handleNodeChange = (index: number, value: string) => {
    const newNodes = [...nodes];
    newNodes[index] = value;
    setNodes(newNodes);
  };

  const handleSubmit = async () => {
    if (!username || !password) {
      toast("Please fill in username and password", "error");
      return;
    }
    if (publicIps.some((ip) => !ip) || privateIps.some((ip) => !ip)) {
      toast("Please fill in all IP fields", "error");
      return;
    }
    if (assigned_vmids.some((id) => id === 0)) {
      toast("Please fill in all Assigned VM ID fields", "error");
      return;
    }
    if (nodes.some((n) => !n)) {
      toast("Please fill in Proxmox Node for all VMs", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        publicIps,
        privateIps,
        assigned_vmids,
        username,
        password,
        nodes,
        pmx_type,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex col gap-4">
      <div className="text-sm text-mute">
        <div>
          <strong>Request:</strong> {(task as any).hostname}
        </div>
        <div>
          <strong>Configuration:</strong> {(task as any).task_type || "new"} ·{" "}
          {qty} VM{qty > 1 ? "s" : ""} · {(task as any).vcpu} vCPU ·{" "}
          {(task as any).ram}GB RAM · {(task as any).storage}GB Storage
        </div>
      </div>

      {Array.from({ length: qty }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: 12,
            background: "var(--surface-2)",
            borderRadius: 4,
          }}
        >
          <div className="fw-6 mb-3" style={{ fontSize: 14 }}>
            VM #{i + 1}: {(task as any).hostname}-{nextHostnameNumber + i}
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            <div className="field">
              <label>
                Public IP <span style={{ color: "var(--bad)" }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                value={publicIps[i] ?? ""}
                onChange={(e) => handlePublicIpChange(i, e.target.value)}
                placeholder="e.g., 203.0.113.1"
              />
            </div>
            <div className="field">
              <label>
                Private IP <span style={{ color: "var(--bad)" }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                value={privateIps[i] ?? ""}
                onChange={(e) => handlePrivateIpChange(i, e.target.value)}
                placeholder="e.g., 10.0.0.1"
              />
            </div>
            <div className="field">
              <label>
                Assigned VM ID <span style={{ color: "var(--bad)" }}>*</span>
              </label>
              <input
                type="number"
                className="input"
                value={assigned_vmids[i] || ""}
                onChange={(e) => handleAssignedVmidChange(i, e.target.value)}
                placeholder="e.g., 100"
              />
            </div>

            <div className="field">
              <label>
                Proxmox Node <span style={{ color: "var(--bad)" }}>*</span>
              </label>
              <ProxmoxNodeInput
                className="input"
                asSelect
                value={nodes[i] || ""}
                onChange={(v) => handleNodeChange(i, v)}
              />
            </div>
            <div className="field">
              <label>
                VM Type <span style={{ color: "var(--bad)" }}>*</span>
              </label>
              <select
                className="input"
                value={pmx_type}
                onChange={(e) => setPmxType(e.target.value)}
              >
                <option value="qemu">QEMU (KVM)</option>
                <option value="lxc">LXC Container</option>
              </select>
            </div>
          </div>
        </div>
      ))}

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label>
            Username (shared for all VMs){" "}
            <span style={{ color: "var(--bad)" }}>*</span>
          </label>
          <input
            type="text"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., root"
          />
        </div>
        <div className="field">
          <label>
            Password (shared for all VMs){" "}
            <span style={{ color: "var(--bad)" }}>*</span>
          </label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Initial password"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="btn primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Icon name="loader" size={12} className="spin" /> Creating...
            </>
          ) : (
            <>
              <Icon name="check" size={12} /> Create VM Records
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EngineerVMCreateForm;
