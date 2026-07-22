import React, { useState } from 'react'
import useVMStore from '../store/vmStore'
import useCustomerStore from '../store/customerStore'
import useAddonRequestStore from '../store/addonRequestStore'
import useTeamStore from '../store/teamStore'
import useUIStore from '../store/uiStore'
import useActivityStore from '../store/activityStore'
import Icon from '../lib/icons'
import { Avatar } from '../components/ui/ui'
import { IaaSCard } from '../components/customer-portal/VMHelperComponents'
import { supabase } from '../lib/supabase'

const AdminDirectVMCreate: React.FC = () => {
  const { addVM } = useVMStore()
  const { createAddonRequest } = useAddonRequestStore()
  const { customers } = useCustomerStore()
  const { team } = useTeamStore()
  const { toast } = useUIStore()
  const { logActivity } = useActivityStore()
  const [showSummary, setShowSummary] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customDuration, setCustomDuration] = useState('')
  const [isCustomDuration, setIsCustomDuration] = useState(false)
  const [customVlan, setCustomVlan] = useState('')
  const [isCustomVlan, setIsCustomVlan] = useState(false)
  const [customPort, setCustomPort] = useState('')

  const getDurationLabel = (months: number) => {
    const labels: Record<number, string> = {
      1: 'Monthly',
      3: 'Quarterly',
      6: 'Half Yearly',
      12: 'Yearly'
    }
    return labels[months] || `${months} month${months > 1 ? 's' : ''}`
  }

  const [f, setF] = useState({
    customer: '',
    requestType: 'paid' as 'trial' | 'paid',
    purpose: '',
    hostname: '',
    os: 'ubuntu',
    osVersion: '22.04 LTS',
    customOsName: '',
    customOsVersion: '',
    sizing: 'Standard' as 'Standard' | 'High Performance',
    vcpu: 4,
    ram: 16,
    storage: 200,
    qty: 1,
    duration: 12,
    volumes: [{ size: 200 }],
    capacity: '',
    storagePartitions: '',
    publicIpRequired: true,
    bandwidth: '1 Gbps',
    backupEnabled: false,
    backupTime: '02:00',
    backupType: 'daily',
    zone: 'yangon-dc1',
    nics: [{ id: 1, label: 'NIC 1', type: 'Public', vlan: 'Auto-assign' }],
    firewallPorts: ['22', '80', '443'],
    start_date: new Date().toISOString().slice(0, 10),
    legacy_id: '',
    assigned_vmid: '',
    assigned_to: '',
    public_ip: '',
    private_ip: '',
    username: '',
    password: '',
    cpfs_enabled: false,
    cpfs_package: 'standard' as 'standard' | 'premium',
    ccis_enabled: false,
    ccis_package: 'basic' as 'basic' | 'standard' | 'professional' | 'enterprise',
    addon_start_date: new Date().toISOString().slice(0, 10),
    addon_duration: 12,
    addon_enabled: false,
  })

  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const osCatalog = [
    { id: 'ubuntu', name: 'Ubuntu', accent: 'oklch(0.6 0.17 30)', versions: ['24.04 LTS', '22.04 LTS', '20.04 LTS'], logo: 'U' },
    { id: 'debian', name: 'Debian', accent: 'oklch(0.55 0.18 0)', versions: ['12 (Bookworm)', '11 (Bullseye)'], logo: 'D' },
    { id: 'rocky', name: 'Rocky Linux', accent: 'oklch(0.58 0.16 155)', versions: ['9.3', '9.2', '8.9'], logo: 'R' },
    { id: 'alpine', name: 'Alpine', accent: 'oklch(0.55 0.15 230)', versions: ['3.19', '3.18'], logo: 'A' },
    { id: 'centos', name: 'CentOS Stream', accent: 'oklch(0.55 0.17 285)', versions: ['9', '8'], logo: 'C' },
    { id: 'windows', name: 'Windows Server', accent: 'oklch(0.5 0.14 245)', versions: ['2022', '2019'], logo: 'W' },
  ]

  const zones = [
    { id: 'yangon-dc1', name: 'Yangon Zone A', flag: '🇲🇲', flagImage: 'https://flagcdn.com/w40/mm.png', sub: 'Primary · low latency', latency: '2ms', disabled: false },
    { id: 'yangon-dc2', name: 'Yangon Zone B', flag: '🇲🇲', flagImage: 'https://flagcdn.com/w40/mm.png', sub: 'Secondary · DR pair', latency: '4ms', disabled: true },
  ]

  const commonPorts = [
    { port: '22', label: 'SSH', desc: 'Secure Shell' },
    { port: '80', label: 'HTTP', desc: 'Web traffic' },
    { port: '443', label: 'HTTPS', desc: 'Secure web' },
    { port: '3389', label: 'RDP', desc: 'Remote Desktop' },
    { port: '3306', label: 'MySQL', desc: 'MySQL database' },
    { port: '5432', label: 'PostgreSQL', desc: 'PostgreSQL database' },
    { port: '27017', label: 'MongoDB', desc: 'MongoDB' },
    { port: '6379', label: 'Redis', desc: 'Redis cache' },
    { port: '8080', label: 'HTTP-Alt', desc: 'Alternate HTTP' },
  ]

  const cust = customers.find((c: any) => c.id === f.customer)
  const selectedOS = f.os === 'custom' ? { name: f.customOsName || 'Other OS', accent: 'var(--accent)', versions: [f.customOsVersion || 'Custom version'] } : osCatalog.find(o => o.id === f.os) || osCatalog[0]
  const selectedZone = zones.find(z => z.id === f.zone) || zones[0]
  const hostValid = /^[a-z0-9][a-z0-9-]{1,30}$/i.test(f.hostname)

  // Filter out team members from customer list
  const teamMemberIds = team.map((t: any) => t.user_id)
  const actualCustomers = customers.filter((c: any) => !teamMemberIds.includes(c.id))

  const calculateEndDate = () => {
    const end = new Date(f.start_date)
    end.setMonth(end.getMonth() + f.duration)
    return end.toISOString().slice(0, 10)
  }

  const togglePort = (port: string) => {
    const ports = f.firewallPorts
    set('firewallPorts', ports.includes(port) ? ports.filter((p: string) => p !== port) : [...ports, port])
  }

  const addNic = () => {
    if (f.nics.length >= 3) return
    set('nics', [...f.nics, { id: Date.now(), label: `NIC ${f.nics.length + 1}`, type: 'Private', vlan: 'vlan-100' }])
  }

  const removeNic = (id: number) => {
    if (f.nics.length > 1) set('nics', f.nics.filter((n: any) => n.id !== id))
  }

  const updateNic = (id: number, key: string, val: any) => set('nics', f.nics.map((n: any) => n.id === id ? { ...n, [key]: val } : n))

  const addCustomPort = () => {
    const port = customPort.trim()
    if (port && !f.firewallPorts.includes(port)) {
      set('firewallPorts', [...f.firewallPorts, port])
      setCustomPort('')
    }
  }

  const removeCustomPort = (port: string) => {
    set('firewallPorts', f.firewallPorts.filter((p: string) => p !== port))
  }

  const submit = async () => {
    setShowSummary(true)
  }

  const confirmSubmit = async () => {
    try {
      setIsSubmitting(true)
      
      // Check for duplicate legacy_id
      if (f.legacy_id) {
        const { data: existingVM } = await supabase
          .from('vms')
          .select('id')
          .eq('legacy_id', f.legacy_id)
          .single()
        
        if (existingVM) {
          toast('Legacy ID already exists. Please use a different ID.', 'bad')
          setIsSubmitting(false)
          return
        }
      }
      
      // Calculate expiry date using same logic as customer VM request: start_date + 1 day + duration
      const startDate = new Date(f.start_date)
      startDate.setDate(startDate.getDate() + 1) // Add 1 day to match customer logic
      
      const expiryDate = new Date(startDate)
      expiryDate.setMonth(expiryDate.getMonth() + f.duration)
      
      const vmId = await addVM({
        hostname: f.hostname,
        customer_id: f.customer,
        request_type: f.requestType,
        task_type: 'new',
        legacy_id: f.legacy_id || undefined,
        assigned_vmid: parseInt(f.assigned_vmid) || undefined,
        public_ip: f.public_ip || undefined,
        private_ip: f.private_ip || undefined,
        username: f.username || undefined,
        password: f.password || undefined,
        vcpu: f.vcpu,
        ram_gb: f.ram,
        storage_gb: f.storage,
        zone: f.zone,
        os_name: f.os === 'custom' ? f.customOsName : selectedOS.name,
        os_version: f.os === 'custom' ? f.customOsVersion : f.osVersion,
        nics: f.nics,
        firewall_ports: f.firewallPorts,
        backup_enabled: f.backupEnabled,
        backup_type: f.backupType,
        public_ip_required: f.publicIpRequired,
        start_date: f.start_date + 'T00:00:00.000Z',
        duration: f.duration,
        expiry: expiryDate.toISOString(),
        end_date: expiryDate.toISOString(),
        sizing: f.sizing,
        purpose: f.purpose || undefined,
        storage_partitions: f.storagePartitions || undefined,
        qty: 1,
        provision_status: 'completed',
      })

      // Log activity for VM creation
      await logActivity(
        `Direct VM creation: ${f.hostname} (${f.requestType === 'trial' ? 'Trial' : 'Paid'})`,
        'vm',
        'Admin',
        { vmId, customerId: f.customer, requestType: f.requestType, hostname: f.hostname }
      )

      // Create single addon request for both CPFS and CCIS if enabled
      if (f.cpfs_enabled || f.ccis_enabled) {
        // Calculate addon expiry using addon-specific start_date and duration
        const startDate = new Date(f.addon_start_date)
        startDate.setDate(startDate.getDate() + 1) // Add 1 day to match customer logic
        
        const expiryDate = new Date(startDate)
        expiryDate.setMonth(expiryDate.getMonth() + f.addon_duration)
        
        await createAddonRequest({
          vm_id: vmId,
          customer_id: f.customer,
          status: 'Completed',
          cpfs_enabled: f.cpfs_enabled,
          cpfs_package: f.cpfs_enabled ? f.cpfs_package : undefined,
          ccis_enabled: f.ccis_enabled,
          ccis_package: f.ccis_enabled ? f.ccis_package : undefined,
          duration: String(f.addon_duration),
          start_date: f.addon_start_date + 'T00:00:00.000Z',
          end_date: expiryDate.toISOString(),
          expiry: expiryDate.toISOString(),
        })
      }

      window.location.href = '/vms'
    } catch (err: any) {
      toast(err.message || 'Failed to create VM', 'bad')
      setIsSubmitting(false)
    }
  }

  if (showSummary) {
    return (
      <div className="modal-overlay" onClick={() => setShowSummary(false)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
          <div className="modal-head">
            <h3 style={{ margin: 0 }}>Confirm VM Deployment</h3>
            <button className="icon-btn" onClick={() => setShowSummary(false)}><Icon name="x" size={14} /></button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: 16 }}>
              <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Hostname</div>
              <div className="fw-7" style={{ fontSize: 18, marginBottom: 8 }}>{f.hostname}.vpsmm.local</div>
              <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Purpose / Project Name</div>
              <div className="text-sm mb-2">{f.purpose || 'No purpose specified'}</div>
              <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Request Type</div>
              <div className="text-sm" style={{ color: f.requestType === 'trial' ? 'var(--accent-strong)' : 'var(--ok)' }}>
                {f.requestType === 'trial' ? '14-day Trial' : 'Paid'}
              </div>
            </div>

            <div className="grid-2" style={{ gap: 16 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                <div className="flex center gap-2 mb-3">
                  <Icon name="cpu" size={14} className="text-mute" />
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Specifications</div>
                </div>
                <div className="flex col gap-2">
                  <div className="flex center between">
                    <span className="text-sm text-mute">vCPU</span>
                    <span className="fw-6 text-sm">{f.vcpu} cores</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Memory</span>
                    <span className="fw-6 text-sm">{f.ram} GB</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Storage</span>
                    <span className="fw-6 text-sm">{f.storage} GB SSD</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Quantity</span>
                    <span className="fw-6 text-sm">{1}</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Billing Term</span>
                    <span className="fw-6 text-sm">{getDurationLabel(f.duration)}</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Specification Type</span>
                    <span className="fw-6 text-sm" style={{ color: f.sizing === 'Standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{f.sizing}</span>
                  </div>
                  {f.storagePartitions && (
                    <div className="flex center between">
                      <span className="text-sm text-mute">Storage partitions</span>
                      <span className="fw-6 text-sm">{f.storagePartitions}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                <div className="flex center gap-2 mb-3">
                  <Icon name="globe" size={14} className="text-mute" />
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Network</div>
                </div>
                <div className="flex col gap-2">
                  <div className="flex center between">
                    <span className="text-sm text-mute">Public IP</span>
                    <span className={`fw-6 text-sm ${f.publicIpRequired ? 'text-ok' : 'text-mute'}`}>{f.publicIpRequired ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Zone</span>
                    <span className="fw-6 text-sm">{selectedZone?.name}</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">NICs</span>
                    <div className="fw-6 text-sm" style={{ textAlign: 'right' }}>
                      {f.nics.map((n: any, i: number) => (
                        <div key={i}>{n.label} ({n.type}, VLAN: {n.vlan})</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                <div className="flex center gap-2 mb-3">
                  <Icon name="shield" size={14} className="text-mute" />
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Services</div>
                </div>
                <div className="flex col gap-2">
                  <div className="flex center between">
                    <span className="text-sm text-mute">Backup</span>
                    <span className="fw-6 text-sm">{f.backupEnabled ? `${f.backupType === 'daily' ? 'Daily' : 'Weekly'}` : 'No'}</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                <div className="flex center gap-2 mb-3">
                  <Icon name="box" size={14} className="text-mute" />
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>OS</div>
                </div>
                <div className="flex col gap-2">
                  <div className="flex center between">
                    <span className="text-sm text-mute">OS</span>
                    <span className="fw-6 text-sm">{selectedOS?.name}</span>
                  </div>
                  <div className="flex center between">
                    <span className="text-sm text-mute">Version</span>
                    <span className="fw-6 text-sm">{f.os === 'custom' ? f.customOsVersion : f.osVersion}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)', marginTop: 16 }}>
              <div className="flex center gap-2 mb-3">
                <Icon name="lock" size={14} className="text-mute" />
                <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Security</div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="text-xs text-mute mb-1">Firewall ports</div>
                  <div className="fw-6 text-sm">{f.firewallPorts.join(', ') || 'none'}</div>
                </div>
              </div>
            </div>

            {f.addon_enabled && (
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)', marginTop: 16 }}>
                <div className="flex center gap-2 mb-3">
                  <Icon name="plus" size={14} className="text-mute" />
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Add-on Services</div>
                </div>
                {f.cpfs_enabled && (
                  <div className="flex col gap-2 mb-3">
                    <div className="text-sm fw-6">CPFS - {f.cpfs_package}</div>
                    <div className="text-xs text-mute">Duration: {f.addon_duration} months</div>
                  </div>
                )}
                {f.ccis_enabled && (
                  <div className="flex col gap-2">
                    <div className="text-sm fw-6">CCIS - {f.ccis_package}</div>
                    <div className="text-xs text-mute">Duration: {f.addon_duration} months</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)', marginTop: 16 }}>
              <div className="flex center gap-2 mb-3">
                <Icon name="building" size={14} className="text-mute" />
                <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Customer</div>
              </div>
              <div className="fw-6 text-sm">{cust?.org_name || cust?.company || cust?.name}</div>
              <div className="text-xs text-mute">{cust?.email}</div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)', marginTop: 16 }}>
              <div className="flex center gap-2 mb-3">
                <Icon name="user" size={14} className="text-mute" />
                <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Engineer Data</div>
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                <div className="flex center between">
                  <span className="text-sm text-mute">Legacy ID</span>
                  <span className="fw-6 text-sm">{f.legacy_id || '—'}</span>
                </div>
                <div className="flex center between">
                  <span className="text-sm text-mute">Assigned VM ID</span>
                  <span className="fw-6 text-sm">{f.assigned_vmid || '—'}</span>
                </div>
                <div className="flex center between">
                  <span className="text-sm text-mute">Public IP</span>
                  <span className="fw-6 text-sm">{f.public_ip || '—'}</span>
                </div>
                <div className="flex center between">
                  <span className="text-sm text-mute">Private IP</span>
                  <span className="fw-6 text-sm">{f.private_ip || '—'}</span>
                </div>
                <div className="flex center between">
                  <span className="text-sm text-mute">Username</span>
                  <span className="fw-6 text-sm">{f.username || '—'}</span>
                </div>
                <div className="flex center between">
                  <span className="text-sm text-mute">Password</span>
                  <span className="fw-6 text-sm">{f.password ? '••••••••' : '—'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setShowSummary(false)} disabled={isSubmitting}>Back</button>
            <button className="btn accent" onClick={confirmSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Confirm & Create'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="content" style={{ width: '100%', margin: '0 auto', paddingBottom: 100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Direct VM Creation</h1>
          <p className="page-subtitle">Create VM directly for customer (bypasses request flow)</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Customer Selection - Admin specific */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Customer</h3></div>
          <div className="card-body">
            <div className="field">
              <label>Select Customer</label>
              <select value={f.customer} onChange={e => set('customer', e.target.value)}>
                <option value="">Select customer...</option>
                {actualCustomers.map((c: any) => (
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
              <label>Purpose / Project Name</label>
              <input value={f.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g., Web server, Database cluster" />
              <div className="hint">Brief description of what this VM will be used for</div>
            </div>
          </div>
        </div>

        {/* Hostname */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Hostname</h3></div>
          <div className="card-body">
            <div className="field">
              <label>Hostname <span style={{ color: 'var(--bad)' }}>*</span></label>
              <input value={f.hostname} onChange={e => set('hostname', e.target.value)} placeholder="e.g., web-prod-01" />
              <div className="hint">Will be appended with .vpsmm.local</div>
              {!hostValid && f.hostname && <div className="text-xs" style={{ color: 'var(--bad)', marginTop: 4 }}>Invalid hostname format</div>}
            </div>
          </div>
        </div>

        {/* Request Type */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Request Type</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <IaaSCard selected={f.requestType === 'trial'} onClick={() => set('requestType', 'trial')} padding={14 as any}>
                <div className="fw-7 text-sm">Trial</div>
                <div className="text-xs text-mute">Free 7-day trial</div>
              </IaaSCard>
              <IaaSCard selected={f.requestType === 'paid'} onClick={() => set('requestType', 'paid')} padding={14 as any}>
                <div className="fw-7 text-sm">Paid</div>
                <div className="text-xs text-mute">Monthly billing</div>
              </IaaSCard>
            </div>
          </div>
        </div>

        {/* OS Image */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Choose an OS image</h3>
            <span className="text-xs text-mute">{selectedOS?.name} {f.osVersion}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {osCatalog.map(os => (
                <IaaSCard key={os.id} selected={f.os === os.id} onClick={() => { set('os', os.id); set('osVersion', os.versions[0]) }} padding={14 as any}>
                  <div className="flex center gap-2 mb-2">
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: `${os.accent}1a`, color: os.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{os.logo}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="fw-7 text-sm">{os.name}</div>
                      <div className="text-xs text-mute">{os.versions.length} versions</div>
                    </div>
                    {f.os === os.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }} />}
                  </div>
                  <select
                    value={f.os === os.id ? f.osVersion : os.versions[0]}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { set('os', os.id); set('osVersion', e.target.value) }}
                    style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 5, background: 'var(--surface)', fontSize: 11.5 }}
                  >
                    {os.versions.map(v => <option key={v}>{v}</option>)}
                  </select>
                </IaaSCard>
              ))}
              <IaaSCard selected={f.os === 'custom'} onClick={() => set('os', 'custom')} padding={14 as any}>
                <div className="flex center gap-2 mb-2">
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--surface-3)', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    <Icon name="plus" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-7 text-sm">Other OS</div>
                    <div className="text-xs text-mute">Specify your own</div>
                  </div>
                  {f.os === 'custom' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }} />}
                </div>
              </IaaSCard>
            </div>

            {f.os === 'custom' && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Other OS details</div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="field">
                    <label>OS name</label>
                    <input
                      value={f.customOsName}
                      onChange={e => set('customOsName', e.target.value)}
                      placeholder="e.g. CentOS, Arch Linux"
                    />
                  </div>
                  <div className="field">
                    <label>Version</label>
                    <input
                      value={f.customOsVersion}
                      onChange={e => set('customOsVersion', e.target.value)}
                      placeholder="e.g. 9, 2023.10.01"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Specifications */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Specifications</h3></div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label>vCPU <span style={{ color: 'var(--bad)' }}>*</span></label>
                <input type="number" value={f.vcpu} onChange={e => set('vcpu', parseInt(e.target.value) || 1)} placeholder="e.g. 4" min="1" />
              </div>
              <div className="field">
                <label>RAM (GB) <span style={{ color: 'var(--bad)' }}>*</span></label>
                <input type="number" value={f.ram} onChange={e => set('ram', parseInt(e.target.value) || 1)} placeholder="e.g. 16" min="1" />
              </div>
              <div className="field">
                <label>Storage (GB) <span style={{ color: 'var(--bad)' }}>*</span></label>
                <input type="number" value={f.storage} onChange={e => set('storage', parseInt(e.target.value) || 50)} placeholder="e.g. 200" min="50" />
              </div>
              <div className="field">
                <label>Quantity</label>
                <input type="number" value={1} disabled style={{ background: 'var(--surface-2)', cursor: 'not-allowed' }} />
                <div className="text-xs text-mute">Fixed at 1 for admin direct VM creation</div>
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Storage partitions</label>
                <input value={f.storagePartitions} onChange={e => set('storagePartitions', e.target.value)} placeholder="e.g., /boot 1GB, / 50GB, /var 149GB" />
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 14, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
              <div className="flex center between">
                <div>
                  <div className="fw-6 text-sm">Public IP Address (IPv4) <span style={{ color: 'var(--bad)' }}>*</span></div>
                  <div className="text-xs text-mute mt-1">Assign a public IPv4 address to this VM</div>
                </div>
                <span className={`toggle ${f.publicIpRequired ? 'on' : ''}`} onClick={() => set('publicIpRequired', !f.publicIpRequired)} />
              </div>
            </div>
          </div>
        </div>

        {/* Time */}
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="card-head"><h3 className="card-title">Time</h3></div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label>Start Date <span style={{ color: 'var(--bad)' }}>*</span></label>
                <input type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} />
                <div className="hint">The actual start date of this existing VM (for billing purposes)</div>
              </div>
              <div className="field">
                <label>Billing Term <span style={{ color: 'var(--bad)' }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[1, 3, 6, 12].map(months => (
                    <button
                      key={months}
                      className={`filter-chip ${!isCustomDuration && f.duration === months ? 'active' : ''}`}
                      onClick={() => { set('duration', months); setIsCustomDuration(false) }}
                    >
                      {getDurationLabel(months)}
                    </button>
                  ))}
                  <button
                    className={`filter-chip ${isCustomDuration ? 'active' : ''}`}
                    onClick={() => setIsCustomDuration(true)}
                  >
                    <Icon name="plus" size={11} /> Custom
                  </button>
                </div>
                {isCustomDuration && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="number"
                      value={customDuration}
                      onChange={e => { setCustomDuration(e.target.value); set('duration', parseInt(e.target.value) || 1) }}
                      placeholder="Enter months"
                      min="1"
                      style={{ width: 120, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6 }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Zone */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Choose a zone</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {zones.map(z => (
                <div key={z.id} style={{ opacity: z.disabled ? 0.85 : 1, cursor: z.disabled ? 'not-allowed' : 'pointer' }}>
                  <IaaSCard selected={f.zone === z.id} onClick={() => !z.disabled && set('zone', z.id)} padding={14 as any}>
                    <div className="flex center between mb-2">
                      <img src={z.flagImage} alt={z.name} style={{ width: 32, height: 24, objectFit: 'contain', borderRadius: 2 }} />
                      {f.zone === z.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }} />}
                    </div>
                    <div className="fw-7 text-sm">{z.name}</div>
                    <div className="text-xs text-mute">{z.sub}</div>
                    <div className="text-xs mt-2 mono"><span className="text-mute">Latency:</span> <span className="fw-6">{z.latency}</span></div>
                  </IaaSCard>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Network interfaces (NICs) */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Network interfaces (NICs)</h3>
            {f.nics.length < 3 && (
              <button className="btn sm" onClick={addNic}><Icon name="plus" size={11} />Add NIC</button>
            )}
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              {f.nics.map((nic: any, idx: number) => (
                <div key={nic.id} style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                  <div className="flex center between mb-3">
                    <div className="flex center gap-2">
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: idx === 0 ? 'var(--accent-soft)' : 'var(--surface-3)', color: idx === 0 ? 'var(--accent-strong)' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                        <Icon name="network" size={13} />
                      </div>
                      <div>
                        <div className="fw-7 text-sm">{nic.label}</div>
                        {idx === 0 && <div className="text-xs text-mute">Primary interface</div>}
                      </div>
                    </div>
                    {idx > 0 && (
                      <button className="btn sm danger" onClick={() => removeNic(nic.id)}><Icon name="trash" size={11} />Remove</button>
                    )}
                  </div>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Interface type</div>
                      <div className="flex gap-2">
                        {['Public', 'Private'].map(t => (
                          <button key={t} className={`filter-chip ${nic.type === t ? 'active' : ''}`} onClick={() => updateNic(nic.id, 'type', t)}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>VLAN / subnet</div>
                      <select value={nic.vlan} onChange={e => { updateNic(nic.id, 'vlan', e.target.value); if (e.target.value === 'other') setIsCustomVlan(true); else setIsCustomVlan(false) }} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', fontSize: 12, width: '100%' }}>
                        <option value="Auto-assign">Auto-assign</option>
                        <option value="VLAN 100 (default)">VLAN 100 (default)</option>
                        <option value="VLAN 200 (management)">VLAN 200 (management)</option>
                        <option value="VLAN 300 (storage)">VLAN 300 (storage)</option>
                        <option value="VLAN 400 (backup)">VLAN 400 (backup)</option>
                        <option value="other">Other (custom)</option>
                      </select>
                      {isCustomVlan && nic.vlan === 'other' && (
                        <input
                          type="text"
                          value={customVlan}
                          onChange={e => { setCustomVlan(e.target.value); updateNic(nic.id, 'vlan', e.target.value) }}
                          placeholder="Enter VLAN or subnet"
                          style={{ marginTop: 8, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', fontSize: 12, width: '100%' }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-mute mt-2">Up to 3 NICs per VM. Additional NICs require VLAN setup by the network team.</div>
          </div>
        </div>

        {/* Firewall rules — inbound ports */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Firewall rules — inbound ports</h3>
            <span className="text-xs text-mute">{f.firewallPorts.length} port{f.firewallPorts.length !== 1 ? 's' : ''} open</span>
          </div>
          <div className="card-body">
            <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Common services — select all that apply</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {commonPorts.map(p => {
                const active = f.firewallPorts.includes(p.port)
                return (
                  <button key={p.port} onClick={() => togglePort(p.port)}
                    style={{
                      textAlign: 'left', padding: 12,
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      border: '1.5px solid', borderColor: active ? 'var(--accent)' : 'var(--line)',
                      borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="flex center between mb-1">
                      <span className="mono fw-7 text-sm" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{p.port}</span>
                      {active && <Icon name="check" size={12} style={{ color: 'var(--accent-strong)' }} />}
                    </div>
                    <div className="fw-6 text-xs">{p.label}</div>
                    <div className="text-xs text-mute">{p.desc}</div>
                  </button>
                )
              })}
            </div>

            <div className="text-xs text-mute fw-6 mt-4 mb-2" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Custom port</div>
            <div className="flex gap-2">
              <input value={customPort} onChange={e => setCustomPort(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && addCustomPort()}
                placeholder="e.g. 8443"
                style={{ width: 120, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--mono)' }}
              />
              <button className="btn" onClick={addCustomPort}><Icon name="plus" size={12} />Add port</button>
            </div>

            {f.firewallPorts.length > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Open ports</div>
                <div className="flex gap-1 wrap">
                  {f.firewallPorts.map(p => (
                    <span key={p} className="pill accent" style={{ paddingRight: 4 }}>
                      <span className="mono">{p}</span>
                      <span style={{ cursor: 'pointer', marginLeft: 4, opacity: 0.7 }} onClick={() => removeCustomPort(p)}>×</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Backup */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Backup</h3>
            <span className={`toggle ${f.backupEnabled ? 'on' : ''}`} onClick={() => set('backupEnabled', !f.backupEnabled)} />
          </div>
          {f.backupEnabled && (
            <div className="card-body">
              <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Backup Options <span style={{ color: 'var(--bad)' }}>*</span></div>
              <div className="flex col gap-3">
                <div>
                  <div className="text-xs text-mute">(Backup Time - within 12:00 AM - 6:00 AM)</div>
                </div>
                <div>
                  <div className="flex col gap-2">
                    <label className="flex center gap-2" style={{ cursor: 'pointer', padding: 12, background: f.backupType === 'daily' ? 'var(--accent-soft)' : 'var(--surface)', border: f.backupType === 'daily' ? '1.5px solid var(--accent)' : '1px solid var(--line)', borderRadius: 8 }}>
                      <input
                        type="radio"
                        name="backupType"
                        value="daily"
                        checked={f.backupType === 'daily'}
                        onChange={() => set('backupType', 'daily')}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div className="fw-6 text-sm">Daily Backup</div>
                        <div className="text-xs text-mute">Daily Backups with 7 days Retention</div>
                      </div>
                    </label>
                    <label className="flex center gap-2" style={{ cursor: 'pointer', padding: 12, background: f.backupType === 'weekly' ? 'var(--accent-soft)' : 'var(--surface)', border: f.backupType === 'weekly' ? '1.5px solid var(--accent)' : '1px solid var(--line)', borderRadius: 8 }}>
                      <input
                        type="radio"
                        name="backupType"
                        value="weekly"
                        checked={f.backupType === 'weekly'}
                        onChange={() => set('backupType', 'weekly')}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div className="fw-6 text-sm">Weekly Backup</div>
                        <div className="text-xs text-mute">Weekly Backup with 4 weeks Retention</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Addons */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Addons</h3></div>
          <div className="card-body">
            <div className="flex col gap-4">
              {/* Addon Toggle */}
              <div className="flex center between">
                <div>
                  <div className="fw-6 text-sm">Enable Add-on Services</div>
                  <div className="text-xs text-mute">Add CPFS and/or CCIS to this VM</div>
                </div>
                <span className={`toggle ${f.addon_enabled ? 'on' : ''}`} onClick={() => set('addon_enabled', !f.addon_enabled)} />
              </div>

              {f.addon_enabled && (
                <>
                  {/* Billing Term */}
                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                    <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Billing Term</div>
                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="field">
                        <label>Start Date</label>
                        <input type="date" value={f.addon_start_date} onChange={e => set('addon_start_date', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Duration (months)</label>
                        <input type="number" value={f.addon_duration} onChange={e => set('addon_duration', parseInt(e.target.value) || 1)} min="1" />
                      </div>
                    </div>
                  </div>

                  {/* CPFS */}
                  <div>
                    <div className="flex center between mb-3">
                      <div>
                        <div className="fw-6 text-sm">CPFS (Cloud Protection Firewall Service)</div>
                        <div className="text-xs text-mute">Advanced file-level protection and backup</div>
                      </div>
                      <span className={`toggle ${f.cpfs_enabled ? 'on' : ''}`} onClick={() => set('cpfs_enabled', !f.cpfs_enabled)} />
                    </div>
                    {f.cpfs_enabled && (
                      <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                        <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Package Selection</div>
                        <div className="grid-2" style={{ gap: 12 }}>
                          <IaaSCard selected={f.cpfs_package === 'standard'} onClick={() => set('cpfs_package', 'standard')} padding={16 as any}>
                            <div className="flex center between mb-2">
                              <h4 className="fw-6">CPFS - Standard Package</h4>
                              {f.cpfs_package === 'standard' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>
                              <li>1000 concurrent sessions per second</li>
                              <li>Weekly Report</li>
                            </ul>
                          </IaaSCard>
                          <IaaSCard selected={f.cpfs_package === 'premium'} onClick={() => set('cpfs_package', 'premium')} padding={16 as any}>
                            <div className="flex center between mb-2">
                              <h4 className="fw-6">CPFS - Premium Package</h4>
                              {f.cpfs_package === 'premium' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>
                              <li>1500 concurrent sessions per second</li>
                              <li>Weekly Report</li>
                            </ul>
                          </IaaSCard>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CCIS */}
                  <div>
                    <div className="flex center between mb-3">
                      <div>
                        <div className="fw-6 text-sm">CCIS (Cloud Container & Image Service)</div>
                        <div className="text-xs text-mute">Container orchestration and image management</div>
                      </div>
                      <span className={`toggle ${f.ccis_enabled ? 'on' : ''}`} onClick={() => set('ccis_enabled', !f.ccis_enabled)} />
                    </div>
                    {f.ccis_enabled && (
                      <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                        <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Package Selection</div>
                        <div className="grid-4" style={{ gap: 12 }}>
                          {[
                            { id: 'basic', name: 'Basic Plan', mb: '100 MB' },
                            { id: 'standard', name: 'Standard Plan', mb: '500 MB' },
                            { id: 'professional', name: 'Professional Plan', mb: '1 GB' },
                            { id: 'enterprise', name: 'Enterprise Plan', mb: '5 GB' },
                          ].map((plan) => (
                            <IaaSCard key={plan.id} selected={f.ccis_package === plan.id} onClick={() => set('ccis_package', plan.id as 'basic' | 'standard' | 'professional' | 'enterprise')} padding={16 as any}>
                              <div className="flex center between mb-2">
                                <div className="fw-6 text-sm">{plan.name}</div>
                                {f.ccis_package === plan.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                              </div>
                              <div className="text-mute text-xs">{plan.mb}</div>
                            </IaaSCard>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Engineer Data */}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Engineer Data</h3></div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label>Legacy ID</label>
                <input value={f.legacy_id} onChange={e => set('legacy_id', e.target.value)} placeholder="e.g. AD-1024" />
              </div>
              <div className="field">
                <label>Assigned VM ID</label>
                <input value={f.assigned_vmid} onChange={e => set('assigned_vmid', e.target.value)} placeholder="e.g. 1001" />
              </div>
              <div className="field">
                <label>Public IPv4</label>
                <input value={f.public_ip} onChange={e => set('public_ip', e.target.value)} placeholder="e.g. 203.81.64.10" />
              </div>
              <div className="field">
                <label>Private IPv4</label>
                <input value={f.private_ip} onChange={e => set('private_ip', e.target.value)} placeholder="e.g. 10.0.0.5" />
              </div>
              <div className="field">
                <label>Username</label>
                <input value={f.username} onChange={e => set('username', e.target.value)} placeholder="e.g. root" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" value={f.password} onChange={e => set('password', e.target.value)} placeholder="VM password" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={() => window.location.href = '/vms'}>Cancel</button>
          <button className="btn accent" onClick={submit}><Icon name="check" size={12} />Review & Create</button>
        </div>
      </div>
    </div>
  )
}

export default AdminDirectVMCreate
