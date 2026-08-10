import { useId } from "react";
import useProxmoxNodes from "../../hooks/useProxmoxNodes";

interface ProxmoxNodeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

// Free-text input for a VM's Proxmox node, with live autocomplete from
// GET /api/nodes. A cluster's node set is dynamic (nodes get added or
// removed), so this can never be a fixed dropdown — it stays a plain text
// input rather than a <select> so admin/engineer entry isn't blocked if
// proxmox-proxcy is briefly unreachable when the form opens; the datalist
// is a live suggestion, not a hard constraint on what can be typed.
export default function ProxmoxNodeInput({
  value,
  onChange,
  placeholder,
  id,
  className,
}: ProxmoxNodeInputProps) {
  const listId = useId();
  const { nodes, loading } = useProxmoxNodes();

  return (
    <>
      <input
        id={id}
        className={className}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={loading ? "Loading nodes…" : placeholder || "e.g. pve1"}
        autoComplete="off"
      />
      <datalist id={listId}>
        {nodes.map((n) => (
          <option key={n.node} value={n.node} />
        ))}
      </datalist>
    </>
  );
}
