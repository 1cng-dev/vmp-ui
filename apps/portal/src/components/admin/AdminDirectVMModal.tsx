import React, { useState } from 'react'
import useVMStore from '../../store/vmStore'
import useCustomerStore from '../../store/customerStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { Avatar } from '../ui/ui'

interface AdminDirectVMModalProps {
  onClose: () => void
}

const AdminDirectVMModal: React.FC<AdminDirectVMModalProps> = ({ onClose }) => {
  const { addVM } = useVMStore()
  const { createAddonRequest } = useAddonRequestStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  
  const [f, setF] = useState({
    // Step 1: Customer & Basic Info
    customer: '',
    hostname: '',
    purpose: '',
    qty: 1,
    duration: 12,
    start_date: new Date().toISOString().slice(0, 10),
    // Step 2: OS
    os_name: 'Ubuntu',
    os_version: '22.04 LTS',
    custom_os_name: '',
    custom_os_version: '',
    // Step 3: Specs
    vcpu: 2,
    ram_gb: 8,
    storage_gb: 100,
    sizing: 'Standard' as 'Standard' | 'High Performance',
    storage_partitions: '',
    // Step 4: Network
    zone: 'yangon-dc1',
    nics: [{ id: 1, label: 'NIC 1', type: 'Public', vlan: 'Auto-assign' }],
    public_ip_required: true,
    firewall_ports: ['22', '80', '443'],
    // Step 5: Backup
    backup_enabled: false,
    backup_type: 'daily',
    // Step 6: Engineer Data (NEW)
    assigned_vmid: '',
    public_ip: '',
    private_ip: '',
    username: 'root',
    password: '',
    provision_status: 'completed' as 'pending' | 'in_progress' | 'completed' | 'failed',
    // Step 7: Addons (NEW)
    cpfs_enabled: false,
    cpfs_package: 'standard' as 'standard' | 'premium',
    ccis_enabled: false,
    ccis_package: 'basic' as 'basic' | 'standard' | 'professional' | 'enterprise',
    addon_duration: 12,
  })

  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const osCatalog = [
    { id: 'ubuntu', name: 'Ubuntu', versions: ['24.04 LTS', '22.04 LTS', '20.04 LTS'] },
    { id: 'debian', name: 'Debian', versions: ['12 (Bookworm)', '11 (Bullseye)'] },
    { id: 'rocky', name: 'Rocky Linux', versions: ['9.3', '8.9'] },
    { id: 'alma', name: 'AlmaLinux', versions: ['9.3', '8.9'] },
    { id: 'centos', name: 'CentOS Stream', versions: ['9', '8'] },
    { id: 'windows', name: 'Windows Server', versions: ['2022', '2019'] },
  ]

  const zones = [
    { id: 'yangon-dc1', name: 'Yangon DC1' },
    { id: 'yangon-dc2', name: 'Yangon DC2' },
    { id: 'mandalay-dc1', name: 'Mandalay DC1' },
  ]

  const commonPorts = [
    { port: '22', label: 'SSH' },
    { port: '80', label: 'HTTP' },
    { port: '443', label: 'HTTPS' },
    { port: '3389', label: 'RDP' },
    { port: '3306', label: 'MySQL' },
    { port: '5432', label: 'PostgreSQL' },
  ]

  const cust = customers.find((c: any) => c.id === f.customer)

  const calculateEndDate = () => {
    if (!f.start_date || !f.duration) return ''
    const start = new Date(f.start_date)
    const end = new Date(start)
    end.setMonth(end.getMonth() + f.duration)
    return end.toISOString().slice(0, 10)
  }

  const togglePort = (port: string) => {
    const ports = f.firewall_ports
    set('firewall_ports', ports.includes(port) ? ports.filter((p: string) => p !== port) : [...ports, port])
  }

  const submit = async () => {
    try {
      // Step 1: Create VM first and get the vm_id
      const vmId = await addVM({
        hostname: f.hostname,
        customer_id: f.customer,
        assigned_vmid: parseInt(f.assigned_vmid) || undefined,
        vcpu: f.vcpu,
        ram_gb: f.ram_gb,
        storage_gb: f.storage_gb,
        qty: f.qty,
        duration: f.duration,
        start_date: f.start_date,
        end_date: calculateEndDate(),
        // OS
        os_name: f.os_name,
        os_version: f.os_version,
        custom_os_name: f.custom_os_name || undefined,
        custom_os_version: f.custom_os_version || undefined,
        // Network & credentials
        public_ip: f.public_ip || undefined,
        private_ip: f.private_ip || undefined,
        username: f.username,
        password: f.password,
        zone: f.zone,
        public_ip_required: f.public_ip_required,
        firewall_ports: f.firewall_ports,
        // Other
        purpose: f.purpose,
        sizing: f.sizing,
        storage_partitions: f.storage_partitions || undefined,
        nics: f.nics,
        backup_enabled: f.backup_enabled,
        backup_type: f.backup_type,
        provision_status: f.provision_status,
        status: 'Active',
        power_state: 'Running',
        task_type: 'new',
      })

      // Step 2: Create addon requests using the vm_id
      if (f.cpfs_enabled || f.ccis_enabled) {
        await createAddonRequest({
          customer_id: f.customer,
          vm_id: vmId,
          cpfs_enabled: f.cpfs_enabled,
          cpfs_package: f.cpfs_package,
          ccis_enabled: f.ccis_enabled,
          ccis_package: f.ccis_package,
          duration: f.addon_duration.toString(),
          status: 'Completed', // Direct admin creation = completed status
          notes: 'Direct admin addon creation',
        })
      }

      toast(`VM ${f.hostname} created successfully${f.cpfs_enabled || f.ccis_enabled ? ' with addons' : ''}`, 'ok')
      onClose()
    } catch (error) {
      toast('Failed to create VM', 'error')
      console.error(error)
    }
  }

  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Direct VM Creation</h3>
            <div className="text-xs text-mute mt-1">Create VM directly for customer (bypasses request flow)</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Customer Selection */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Customer</h3></div>
            <div className="card-body">
              <div className="field">
                <label>Select Customer</label>
                <select value={f.customer} onChange={e => set('customer', e.target.value)}>
                  <option value="">Select customer...</option>
                  {customers.filter((c: any) => !c.staff_code).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.org_name || c.company || c.name}</option>
                  ))}
                </select>
              </div>
              {cust && (
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={cust.name} size={32} />
                  <div style={{ flex: 1 }}>
                    <div className="fw-6 text-sm">{cust.org_name || cust.company}</div>
                    <div className="text-xs text-mute">{cust.email} · {cust.phone || '—'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Purpose */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Purpose</h3></div>
            <div className="card-body">
              <div className="field">
                <label>Purpose / project name</label>
                <input value={f.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. Production web app, ERP database" />
                <div className="hint">Helps with resource allocation and tracking</div>
              </div>
            </div>
          </div>

          {/* Hostname */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Hostname</h3></div>
            <div className="card-body">
              <div className="field">
                <label>VM hostname</label>
                <input value={f.hostname} onChange={e => set('hostname', e.target.value.replace(/\s/g, '-').toLowerCase())} placeholder="vm-customer-prod-01" style={{ fontFamily: 'var(--mono)' }} />
              </div>
            </div>
          </div>

          {/* OS Selection */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Operating System</h3></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {osCatalog.map((o: any) => {
                  const sel = f.os_name === o.name
                  return (
                    <button key={o.id} type="button"
                      onClick={() => { set('os_name', o.name); set('os_version', o.versions[0]); }}
                      style={{
                        textAlign: 'left', padding: 11, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                        background: sel ? 'var(--accent-soft)' : 'var(--surface)', border: '1.5px solid', borderColor: sel ? 'var(--accent)' : 'var(--line)',
                        boxShadow: sel ? '0 0 0 3px var(--accent-soft)' : 'none', transition: 'all 0.15s',
                      }}
                    >
                      <div className="flex center between mb-1">
                        <div className="fw-7" style={{ fontSize: 12 }}>{o.name}</div>
                        {sel && <Icon name="check" size={13} style={{ color: 'var(--accent-strong)' }} />}
                      </div>
                      <div className="text-xs text-mute">{o.versions.length} versions</div>
                    </button>
                  )
                })}
              </div>
              <div className="field mt-2">
                <label>OS Version</label>
                <select value={f.os_version} onChange={e => set('os_version', e.target.value)}>
                  {osCatalog.find((o: any) => o.name === f.os_name)?.versions.map((v: string) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Custom OS name (if other)</label>
                  <input value={f.custom_os_name} onChange={e => set('custom_os_name', e.target.value)} placeholder="e.g., Custom Linux" />
                </div>
                <div className="field">
                  <label>Custom OS version</label>
                  <input value={f.custom_os_version} onChange={e => set('custom_os_version', e.target.value)} placeholder="e.g., Custom 1.0" />
                </div>
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Specifications</h3></div>
            <div className="card-body">
              <div className="grid-3" style={{ gap: 12 }}>
                <div className="field">
                  <label>vCPU cores</label>
                  <input type="number" value={f.vcpu} onChange={e => set('vcpu', parseInt(e.target.value) || 1)} min="1" />
                </div>
                <div className="field">
                  <label>RAM (GB)</label>
                  <input type="number" value={f.ram_gb} onChange={e => set('ram_gb', parseInt(e.target.value) || 1)} min="1" />
                </div>
                <div className="field">
                  <label>Storage (GB)</label>
                  <input type="number" value={f.storage_gb} onChange={e => set('storage_gb', parseInt(e.target.value) || 1)} min="1" />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Sizing</label>
                  <select value={f.sizing} onChange={e => set('sizing', e.target.value as 'Standard' | 'High Performance')}>
                    <option value="Standard">Standard</option>
                    <option value="High Performance">High Performance</option>
                  </select>
                </div>
                <div className="field">
                  <label>Storage partitions</label>
                  <input value={f.storage_partitions} onChange={e => set('storage_partitions', e.target.value)} placeholder="e.g., /boot 1GB, / 50GB, /var 149GB" />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Quantity</label>
                  <input type="number" value={f.qty} onChange={e => set('qty', parseInt(e.target.value) || 1)} min="1" />
                </div>
                <div className="field">
                  <label>Duration (months)</label>
                  <input type="number" value={f.duration} onChange={e => set('duration', parseInt(e.target.value) || 1)} min="1" />
                </div>
              </div>
            </div>
          </div>

          {/* Network */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Network</h3></div>
            <div className="card-body">
              <div className="field">
                <label>Zone</label>
                <select value={f.zone} onChange={e => set('zone', e.target.value)}>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div className="flex center between" style={{ padding: '4px 2px' }}>
                <div><div className="fw-6 text-sm">Public IP required</div><div className="text-xs text-mute">Assign a public IP address</div></div>
                <input type="checkbox" checked={f.public_ip_required} onChange={e => set('public_ip_required', e.target.checked)} />
              </div>
              <div className="text-xs text-mute fw-6 mt-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Firewall Ports</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {commonPorts.map(p => {
                  const active = f.firewall_ports.includes(p.port)
                  return (
                    <button key={p.port} onClick={() => togglePort(p.port)}
                      style={{
                        textAlign: 'left', padding: 10,
                        background: active ? 'var(--accent-soft)' : 'var(--surface)',
                        border: '1.5px solid', borderColor: active ? 'var(--accent)' : 'var(--line)',
                        borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div className="fw-7 text-sm mono">{p.port}</div>
                      <div className="text-xs text-mute">{p.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Backup */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Backup</h3></div>
            <div className="card-body">
              <div className="flex center between" style={{ padding: '4px 2px' }}>
                <div><div className="fw-6 text-sm">Backup enabled</div><div className="text-xs text-mute">Enable backup for this VM</div></div>
                <input type="checkbox" checked={f.backup_enabled} onChange={e => set('backup_enabled', e.target.checked)} />
              </div>
              {f.backup_enabled && (
                <div className="field mt-2">
                  <label>Backup type</label>
                  <select value={f.backup_type} onChange={e => set('backup_type', e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Engineer Data */}
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <div className="card-head"><h3 className="card-title">Engineer Provisioning Data</h3></div>
            <div className="card-body">
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Assigned VM ID (Proxmox)</label>
                  <input type="number" value={f.assigned_vmid} onChange={e => set('assigned_vmid', e.target.value)} placeholder="e.g., 1001" style={{ fontFamily: 'var(--mono)' }} />
                </div>
                <div className="field">
                  <label>Start date</label>
                  <input type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Public IP</label>
                  <input value={f.public_ip} onChange={e => set('public_ip', e.target.value)} placeholder="e.g., 203.81.64.100" style={{ fontFamily: 'var(--mono)' }} />
                </div>
                <div className="field">
                  <label>Private IP</label>
                  <input value={f.private_ip} onChange={e => set('private_ip', e.target.value)} placeholder="e.g., 10.0.0.100" style={{ fontFamily: 'var(--mono)' }} />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Username</label>
                  <input value={f.username} onChange={e => set('username', e.target.value)} placeholder="root" />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input type="password" value={f.password} onChange={e => set('password', e.target.value)} placeholder="Enter password" />
                </div>
              </div>
            </div>
          </div>

          {/* Addons */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">Addon Services</h3></div>
            <div className="card-body">
              <div className="flex center between" style={{ padding: '4px 2px' }}>
                <div>
                  <div className="fw-6 text-sm">CPFS (Cloud File System)</div>
                  <div className="text-xs text-mute">Enable cloud file system addon</div>
                </div>
                <input type="checkbox" checked={f.cpfs_enabled} onChange={e => set('cpfs_enabled', e.target.checked)} />
              </div>
              {f.cpfs_enabled && (
                <div className="field mt-2">
                  <label>CPFS Package</label>
                  <select value={f.cpfs_package} onChange={e => set('cpfs_package', e.target.value as 'standard' | 'premium')}>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              )}
              <div className="flex center between" style={{ padding: '4px 2px' }}>
                <div>
                  <div className="fw-6 text-sm">CCIS (Cloud Infrastructure Security)</div>
                  <div className="text-xs text-mute">Enable cloud infrastructure security addon</div>
                </div>
                <input type="checkbox" checked={f.ccis_enabled} onChange={e => set('ccis_enabled', e.target.checked)} />
              </div>
              {f.ccis_enabled && (
                <div className="field mt-2">
                  <label>CCIS Package</label>
                  <select value={f.ccis_package} onChange={e => set('ccis_package', e.target.value as 'basic' | 'standard' | 'professional' | 'enterprise')}>
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              )}
              {(f.cpfs_enabled || f.ccis_enabled) && (
                <div className="field mt-2">
                  <label>Addon Duration (months)</label>
                  <input type="number" value={f.addon_duration} onChange={e => set('addon_duration', parseInt(e.target.value) || 1)} min="1" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button className="btn accent" onClick={submit}><Icon name="check" size={12} />Create VM</button>
        </div>
      </div>
    </div>
  )
}

export default AdminDirectVMModal
