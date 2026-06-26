import React, { useState } from 'react'
import useTaskStore from '../../store/taskStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { IaaSCard } from './VMHelperComponents'

interface CustomerRequestVMViewProps {
  me: any
  setView: (view: string) => void
}

export const CustomerRequestVMView: React.FC<CustomerRequestVMViewProps> = ({ me, setView }) => {
  const { addTask } = useTaskStore()
  const { toast } = useUIStore()
  const [showSummary, setShowSummary] = useState(false)
  const [f, setF] = useState({
    purpose: '',
    hostname: '',
    os: 'ubuntu',
    osVersion: '22.04 LTS',
    customOsName: '',
    customOsVersion: '',
    sizing: 'standard',
    vcpu: 4,
    ram: 16,
    storage: 200,
    volumes: [{ size: 200 }],
    capacity: '',
    storagePartitions: '',
    publicIpRequired: true,
    bandwidth: '1 Gbps',
    backupEnabled: false,
    backupTime: '02:00',
    backupType: 'daily',
    monitoring: false,
    zone: 'yangon-dc1',
    nics: [{ id: 1, label: 'NIC 1', type: 'Public', vlan: 'auto' }],
    firewallPorts: ['22', '80', '443'],
    portForwarding: [] as any[],
    additionalNotes: '',
  })
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const presets = [
    { id: 'starter', label: 'Starter', vcpu: 2, ram: 4, storage: 50, desc: 'Small services, dev work' },
    { id: 'standard', label: 'Standard', vcpu: 4, ram: 8, storage: 100, desc: 'Web apps, staging' },
    { id: 'business', label: 'Business', vcpu: 4, ram: 16, storage: 200, desc: 'Production workloads', popular: true },
    { id: 'performance', label: 'Performance', vcpu: 8, ram: 32, storage: 500, desc: 'Heavy traffic, databases' },
    { id: 'enterprise', label: 'Enterprise', vcpu: 16, ram: 64, storage: 1000, desc: 'Mission-critical' },
  ]

  const osCatalog = [
    { id: 'ubuntu', name: 'Ubuntu', accent: 'oklch(0.6 0.17 30)', versions: ['24.04 LTS', '22.04 LTS', '20.04 LTS'], logo: 'U' },
    { id: 'debian', name: 'Debian', accent: 'oklch(0.55 0.18 0)', versions: ['12 (Bookworm)', '11 (Bullseye)'], logo: 'D' },
    { id: 'rocky', name: 'Rocky Linux', accent: 'oklch(0.58 0.16 155)', versions: ['9.3', '9.2', '8.9'], logo: 'R' },
    { id: 'alpine', name: 'Alpine', accent: 'oklch(0.55 0.15 230)', versions: ['3.19', '3.18'], logo: 'A' },
    { id: 'centos', name: 'CentOS Stream', accent: 'oklch(0.55 0.17 285)', versions: ['9', '8'], logo: 'C' },
    { id: 'windows', name: 'Windows Server', accent: 'oklch(0.5 0.14 245)', versions: ['2022', '2019'], logo: 'W' },
  ]

  const zones = [
    { id: 'yangon-dc1', name: 'Yangon Zone A', flag: '🇲🇲', sub: 'Primary · low latency', latency: '2ms' },
    { id: 'yangon-dc2', name: 'Yangon Zone B', flag: '🇲🇲', sub: 'Secondary · DR pair', latency: '4ms' },
    { id: 'mandalay-dc1', name: 'Mandalay Zone A', flag: '🇲🇲', sub: 'North coverage', latency: '12ms' },
  ]

  const bandwidthOpts = ['100 Mbps', '500 Mbps', '1 Gbps', '10 Gbps']

  const commonPorts = [
    { port: '22', label: 'SSH', desc: 'Secure Shell' },
    { port: '80', label: 'HTTP', desc: 'Web traffic' },
    { port: '443', label: 'HTTPS', desc: 'Secure web' },
    { port: '3389', label: 'RDP', desc: 'Remote Desktop' },
    { port: '21', label: 'FTP', desc: 'File Transfer' },
    { port: '25', label: 'SMTP', desc: 'Email' },
    { port: '587', label: 'SMTP-TLS', desc: 'Email (TLS)' },
    { port: '3306', label: 'MySQL', desc: 'MySQL database' },
    { port: '5432', label: 'PostgreSQL', desc: 'PostgreSQL' },
    { port: '27017', label: 'MongoDB', desc: 'MongoDB' },
    { port: '6379', label: 'Redis', desc: 'Redis cache' },
    { port: '8080', label: 'HTTP-Alt', desc: 'Alternate HTTP' },
  ]

  const spec = { vcpu: f.vcpu, ram: f.ram, storage: f.storage }

  const storageSteps = [25, 50, 100, 200, 500, 1000, 2000]

  const selectedOS = f.os === 'custom' ? { name: f.customOsName || 'Other OS', accent: 'var(--accent)', versions: [f.customOsVersion || 'Custom version'] } : osCatalog.find(o => o.id === f.os) || osCatalog[0]
  const selectedZone = zones.find(z => z.id === f.zone) || zones[0]
  const hostValid = /^[a-z0-9][a-z0-9-]{1,30}$/i.test(f.hostname)

  const canSubmit = () => !!f.purpose && hostValid

  const setVolumeCount = (count: number) => {
    const cur = f.volumes
    const next = count > cur.length
      ? [...cur, ...Array.from({ length: count - cur.length }, () => ({ size: 100 }))]
      : cur.slice(0, count)
    set('volumes', next)
  }
  const setVolumeSize = (idx: number, size: number) => {
    const next = [...f.volumes]
    next[idx] = { ...next[idx], size }
    set('volumes', next)
  }

  const togglePort = (port: string) => {
    const ports = f.firewallPorts
    set('firewallPorts', ports.includes(port) ? ports.filter((p: string) => p !== port) : [...ports, port])
  }
  const [customPort, setCustomPort] = useState('')
  const addCustomPort = () => {
    const p = customPort.trim()
    if (!p || f.firewallPorts.includes(p)) return
    set('firewallPorts', [...f.firewallPorts, p])
    setCustomPort('')
  }

  const [pfDraft, setPfDraft] = useState({ srcPort: '', dstPort: '', protocol: 'TCP' })
  const addPfRule = () => {
    if (!pfDraft.srcPort || !pfDraft.dstPort) return
    set('portForwarding', [...f.portForwarding, { ...pfDraft, id: Date.now() }])
    setPfDraft({ srcPort: '', dstPort: '', protocol: 'TCP' })
  }
  const removePfRule = (id: number) => set('portForwarding', f.portForwarding.filter((r: any) => r.id !== id))

  const addNic = () => {
    if (f.nics.length >= 3) return
    set('nics', [...f.nics, { id: Date.now(), label: `NIC ${f.nics.length + 1}`, type: 'Private', vlan: 'vlan-100' }])
  }
  const removeNic = (id: number) => { if (f.nics.length > 1) set('nics', f.nics.filter((n: any) => n.id !== id)) }
  const updateNic = (id: number, key: string, val: any) => set('nics', f.nics.map((n: any) => n.id === id ? { ...n, [key]: val } : n))

  const submit = () => {
    setShowSummary(true)
  }

  const confirmSubmit = () => {
    const volumeDesc = f.volumes.map((v: any, i: number) => `Disk ${i+1}: ${v.size} GB SSD`).join(', ')
    addTask({
      title: `VM request — ${f.hostname} (${spec.vcpu}c / ${spec.ram}GB / ${f.volumes.map((v: any) => v.size).join('+')}GB)`,
      customer: me.id, vm: '', type: 'New', priority: 'Normal', status: 'Pending', team: 'Sales',
      subscription: '—',
      assignee: (me as any).salesperson || '—',
      notes: `Customer-initiated VM request via portal.
Hostname: ${f.hostname}
Purpose: ${f.purpose || '—'}
Spec: ${spec.vcpu} vCPU · ${spec.ram} GB RAM · ${f.storage} GB SSD${f.sizing === 'standard' ? ' (standard)' : ' (premium)'}
Bandwidth: ${f.bandwidth}
Backup: ${f.backupEnabled ? `${f.backupType === 'daily' ? 'Daily' : 'Weekly'} at ${f.backupTime}` : 'No'}
Monitoring: ${f.monitoring ? 'Enabled' : 'No'}
OS: ${selectedOS?.name} ${f.os === 'custom' ? f.customOsVersion : f.osVersion}
Zone: ${selectedZone?.name}
NICs: ${f.nics.map((n: any) => `${n.label} (${n.type}, VLAN: ${n.vlan})`).join('; ')}
Firewall ports: ${f.firewallPorts.join(', ') || 'none'}
Port forwarding: ${f.portForwarding.length ? f.portForwarding.map((r: any) => `${r.srcPort}→${r.dstPort}/${r.protocol}`).join(', ') : 'none'}
Customer notes: ${f.additionalNotes || '—'}`,
    })
    toast(`Deployment request sent — ${(me as any).salesperson || 'Sales'} will confirm shortly`, 'ok')
    setShowSummary(false)
    setView('requests')
  }


  return (
    <div className="content" style={{ width: '100%', margin: '0 auto', paddingBottom: 100 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Deploy a new VM</h1>
          <p className="page-subtitle">Configure your instance — choose the specs you need</p>
        </div>
      </div>


      {/* Form body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Purpose */}
          <div className="card">
            <div className="card-head"><h3 className="card-title">What's this VM for?</h3></div>
            <div className="card-body">
              <div className="field">
                <label>Purpose / project name</label>
                <input value={f.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. Production web app, ERP database, dev environment"/>
                <div className="hint">Helps your account manager allocate the right resources.</div>
              </div>
            </div>
          </div>

          {/* Hostname & OS */}
              <div className="card">
                <div className="card-head"><h3 className="card-title">Hostname</h3></div>
                <div className="card-body">
                  <div className="field">
                    <label>VM hostname</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        value={f.hostname}
                        onChange={e => set('hostname', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="my-production-app"
                        style={{ fontFamily: 'var(--mono)', paddingRight: 110, width: '100%' }}
                      />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>.vpsmm.local</span>
                    </div>
                    <div className="hint" style={{ color: f.hostname && !hostValid ? 'var(--bad)' : undefined }}>
                      {f.hostname && !hostValid
                        ? 'Hostname must be 2–31 chars, lowercase letters, digits, or hyphen.'
                        : 'Lowercase letters, digits, hyphens. 2–31 characters. Must start with a letter or digit.'}
                    </div>
                  </div>
                </div>
              </div>
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
                          {f.os === os.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
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
                          <Icon name="plus" size={16}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="fw-7 text-sm">Other OS</div>
                          <div className="text-xs text-mute">Specify your own</div>
                        </div>
                        {f.os === 'custom' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
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

          {/* Specification */}
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Specifications</h3>
                  <div className="flex gap-1" style={{ background: 'var(--surface-3)', borderRadius: 8, padding: 3 }}>
                    {[['standard', 'Standard'], ['premium', 'Premium']].map(([id, label]) => (
                      <button key={id} onClick={() => set('sizing', id)}
                        style={{
                          padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                          background: f.sizing === id ? (id === 'premium' ? 'linear-gradient(135deg, #8b5cf6, #a855f7)' : 'var(--surface)') : 'transparent',
                          color: f.sizing === id ? (id === 'premium' ? '#fff' : 'var(--ink)') : 'var(--ink-3)',
                          boxShadow: f.sizing === id ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.15s',
                        }}>
                        {label}
                        {id === 'premium' && <Icon name="star" size={10} style={{ marginLeft: 4 }}/>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-body">
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="field">
                      <label>vCPU cores <span style={{ color: 'var(--bad)' }}>*</span></label>
                      <input
                        type="number"
                        value={f.vcpu}
                        onChange={e => set('vcpu', parseInt(e.target.value) || 0)}
                        placeholder="e.g. 4"
                        min="1"
                      />
                    </div>
                    <div className="field">
                      <label>Memory (GB) <span style={{ color: 'var(--bad)' }}>*</span></label>
                      <input
                        type="number"
                        value={f.ram}
                        onChange={e => set('ram', parseInt(e.target.value) || 0)}
                        placeholder="e.g. 16"
                        min="1"
                      />
                    </div>
                    <div className="field">
                      <label>Storage (GB) <span style={{ color: 'var(--bad)' }}>*</span></label>
                      <input
                        type="number"
                        value={f.storage}
                        onChange={e => set('storage', parseInt(e.target.value) || 0)}
                        placeholder="e.g. 200"
                        min="1"
                      />
                    </div>
                    <div className="field">
                      <label>Capacity</label>
                      <input
                        value={f.capacity}
                        onChange={e => set('capacity', e.target.value)}
                        placeholder="e.g. High performance"
                      />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 2' }}>
                      <label>Storage partitions</label>
                      <input
                        value={f.storagePartitions}
                        onChange={e => set('storagePartitions', e.target.value)}
                        placeholder="e.g. /boot 1GB, / 50GB, /var 149GB"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 16, padding: 14, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div className="flex center between">
                      <div>
                        <div className="fw-6 text-sm">Public IP Address (IPv4) <span style={{ color: 'var(--bad)' }}>*</span></div>
                        <div className="text-xs text-mute mt-1">Assign a public IPv4 address to this VM</div>
                      </div>
                      <span className={`toggle ${f.publicIpRequired ? 'on' : ''}`} onClick={() => set('publicIpRequired', !f.publicIpRequired)}/>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Storage volumes</h3>
                  <div className="flex center gap-2">
                    <span className="text-xs text-mute">Number of disks:</span>
                    {[1, 2, 3].map(n => (
                      <button key={n} onClick={() => setVolumeCount(n)}
                        className={`filter-chip ${f.volumes.length === n ? 'active' : ''}`}
                        style={{ minWidth: 36 }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="card-body">
                  <div className="flex col gap-4">
                    {f.volumes.map((vol: any, idx: number) => (
                      <div key={idx}>
                        <div className="flex center between mb-2">
                          <span className="fw-6 text-sm flex center gap-2">
                            <Icon name="box" size={13}/>
                            {idx === 0 ? 'System disk (OS)' : `Data disk ${idx}`}
                          </span>
                          <span className="tnum fw-7" style={{ fontSize: 15, color: 'var(--accent-strong)' }}>{vol.size} GB SSD</span>
                        </div>
                        <div className="flex gap-1 wrap">
                          {storageSteps.map(s => (
                            <button key={s} onClick={() => setVolumeSize(idx, s)}
                              className={`filter-chip ${vol.size === s ? 'active' : ''}`}
                              style={{ minWidth: 52, justifyContent: 'center' }}>
                              {s} GB
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h3 className="card-title">Network bandwidth</h3></div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {bandwidthOpts.map(bw => (
                      <IaaSCard key={bw} selected={f.bandwidth === bw} onClick={() => set('bandwidth', bw)} padding={12 as any}>
                        <div className="flex center between mb-1">
                          <span className="fw-7 text-sm">{bw}</span>
                          {f.bandwidth === bw && <Icon name="check" size={13} style={{ color: 'var(--accent-strong)' }}/>}
                        </div>
                        <div className="text-xs text-mute">{bw === '10 Gbps' ? 'Dedicated line' : bw === '1 Gbps' ? 'Recommended' : bw === '100 Mbps' ? 'Basic' : 'Standard'}</div>
                      </IaaSCard>
                    ))}
                  </div>
                </div>
              </div>

              {/* Backup service */}
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Backup service</h3>
                  <span className={`toggle ${f.backupEnabled ? 'on' : ''}`} onClick={() => set('backupEnabled', !f.backupEnabled)}/>
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

              {/* Managed monitoring */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">Managed monitoring & alerts</div>
                    <div className="text-xs text-mute mt-1">CPU, RAM, disk, and uptime alerts via email/SMS</div>
                  </div>
                  <span className={`toggle ${f.monitoring ? 'on' : ''}`} onClick={() => set('monitoring', !f.monitoring)}/>
                </div>
              </div>

          {/* Zone & Network */}
              <div className="card">
                <div className="card-head"><h3 className="card-title">Choose a zone</h3></div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {zones.map(z => (
                      <IaaSCard key={z.id} selected={f.zone === z.id} onClick={() => set('zone', z.id)} padding={14 as any}>
                        <div className="flex center between mb-2">
                          <div style={{ fontSize: 24, lineHeight: 1 }}>{z.flag}</div>
                          {f.zone === z.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                        </div>
                        <div className="fw-7 text-sm">{z.name}</div>
                        <div className="text-xs text-mute">{z.sub}</div>
                        <div className="text-xs mt-2 mono"><span className="text-mute">Latency:</span> <span className="fw-6">{z.latency}</span></div>
                      </IaaSCard>
                    ))}
                  </div>
                </div>
              </div>

              {/* Network Interface Controllers */}
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Network interfaces (NICs)</h3>
                  {f.nics.length < 3 && (
                    <button className="btn sm" onClick={addNic}><Icon name="plus" size={11}/>Add NIC</button>
                  )}
                </div>
                <div className="card-body">
                  <div className="flex col gap-3">
                    {f.nics.map((nic: any, idx: number) => (
                      <div key={nic.id} style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                        <div className="flex center between mb-3">
                          <div className="flex center gap-2">
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: idx === 0 ? 'var(--accent-soft)' : 'var(--surface-3)', color: idx === 0 ? 'var(--accent-strong)' : 'var(--ink-3)', display: 'grid', placeItems: 'center' }}>
                              <Icon name="network" size={13}/>
                            </div>
                            <div>
                              <div className="fw-7 text-sm">{nic.label}</div>
                              {idx === 0 && <div className="text-xs text-mute">Primary interface</div>}
                            </div>
                          </div>
                          {idx > 0 && (
                            <button className="btn sm danger" onClick={() => removeNic(nic.id)}><Icon name="trash" size={11}/>Remove</button>
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
                            <select value={nic.vlan} onChange={e => updateNic(nic.id, 'vlan', e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', fontSize: 12, width: '100%' }}>
                              <option value="auto">Auto-assign</option>
                              <option value="vlan-100">VLAN 100 (default)</option>
                              <option value="vlan-200">VLAN 200 (management)</option>
                              <option value="vlan-300">VLAN 300 (storage)</option>
                              <option value="vlan-400">VLAN 400 (backup)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-mute mt-2">Up to 3 NICs per VM. Additional NICs require VLAN setup by the network team.</div>
                </div>
              </div>

          {/* Firewall */}
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
                          }}>
                          <div className="flex center between mb-1">
                            <span className="mono fw-7 text-sm" style={{ color: active ? 'var(--accent-strong)' : 'var(--ink)' }}>{p.port}</span>
                            {active && <Icon name="check" size={12} style={{ color: 'var(--accent-strong)' }}/>}
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
                    <button className="btn" onClick={addCustomPort}><Icon name="plus" size={12}/>Add port</button>
                  </div>

                  {f.firewallPorts.length > 0 && (
                    <div style={{ marginTop: 16, padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
                      <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Open ports</div>
                      <div className="flex gap-1 wrap">
                        {f.firewallPorts.map(p => (
                          <span key={p} className="pill accent" style={{ paddingRight: 4 }}>
                            <span className="mono">{p}</span>
                            <button className="icon-btn" style={{ width: 16, height: 16, marginLeft: 2 }} onClick={() => togglePort(p)}><Icon name="x" size={9}/></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Port forwarding */}
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Port forwarding</h3>
                  <span className="text-xs text-mute">{f.portForwarding.length} rule{f.portForwarding.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-body">
                  <div className="text-xs text-mute mb-3">Map incoming public ports to internal destination ports on this VM.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px auto', gap: 8, marginBottom: 12, alignItems: 'end' }}>
                    <div>
                      <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Source port</div>
                      <input value={pfDraft.srcPort} onChange={e => setPfDraft({ ...pfDraft, srcPort: e.target.value.replace(/[^0-9]/g, '') })} placeholder="e.g. 8080" style={{ fontFamily: 'var(--mono)', width: '100%' }}/>
                    </div>
                    <div>
                      <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Destination port</div>
                      <input value={pfDraft.dstPort} onChange={e => setPfDraft({ ...pfDraft, dstPort: e.target.value.replace(/[^0-9]/g, '') })} placeholder="e.g. 80" style={{ fontFamily: 'var(--mono)', width: '100%' }}/>
                    </div>
                    <div>
                      <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Protocol</div>
                      <select value={pfDraft.protocol} onChange={e => setPfDraft({ ...pfDraft, protocol: e.target.value })} style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5 }}>
                        <option>TCP</option>
                        <option>UDP</option>
                      </select>
                    </div>
                    <button className="btn primary" onClick={addPfRule} disabled={!pfDraft.srcPort || !pfDraft.dstPort}><Icon name="plus" size={12}/>Add</button>
                  </div>

                  {f.portForwarding.length > 0 && (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {f.portForwarding.map((pf: any, i: number) => (
                        <div key={i} style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="mono fw-6" style={{ minWidth: 60 }}>{pf.srcPort}</span>
                          <Icon name="arrow-right" size={10} className="text-mute"/>
                          <span className="mono fw-6" style={{ minWidth: 60 }}>{pf.dstPort}</span>
                          <span className="text-xs text-mute" style={{ minWidth: 40 }}>{pf.protocol}</span>
                          <div style={{ flex: 1 }}/>
                          <button className="icon-btn" onClick={() => removePfRule(pf.id)}><Icon name="x" size={12}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="field">
                    <label>Anything else for our team? (optional)</label>
                    <textarea rows={3} value={f.additionalNotes} onChange={e => set('additionalNotes', e.target.value)} placeholder="Migration timeline, integrations, preferred contact…"/>
                  </div>
                </div>
              </div>


          {/* Submit button */}
          <div className="flex center" style={{ gap: 10, paddingTop: 8 }}>
            <div style={{ flex: 1 }}/>
            <button className="btn accent" onClick={submit} disabled={!canSubmit()} style={{ padding: '10px 18px', fontSize: 13 }}><Icon name="check" size={13}/>Submit deployment request</button>
          </div>
      </div>

      {/* Summary Modal */}
      {showSummary && (
        <div className="modal-overlay" onClick={() => setShowSummary(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0 }}>Confirm VM Deployment</h3>
              <button className="icon-btn" onClick={() => setShowSummary(false)}><Icon name="x" size={14}/></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Hostname</div>
                <div className="fw-7" style={{ fontSize: 18, marginBottom: 8 }}>{f.hostname}</div>
                <div className="text-xs text-mute fw-6 mb-1" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Purpose / Project Name</div>
                <div className="text-sm">{f.purpose || 'No purpose specified'}</div>
              </div>

              <div className="grid-2" style={{ gap: 16 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                  <div className="flex center gap-2 mb-3">
                    <Icon name="cpu" size={14} className="text-mute"/>
                    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Specifications</div>
                  </div>
                  <div className="flex col gap-2">
                    <div className="flex center between">
                      <span className="text-sm text-mute">vCPU</span>
                      <span className="fw-6 text-sm">{spec.vcpu} cores</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">Memory</span>
                      <span className="fw-6 text-sm">{spec.ram} GB</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">Storage</span>
                      <span className="fw-6 text-sm">{f.storage} GB SSD</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">Tier</span>
                      <span className="fw-6 text-sm" style={{ color: f.sizing === 'standard' ? 'var(--ok)' : 'var(--accent-strong)' }}>{f.sizing === 'standard' ? 'Standard' : 'Premium'}</span>
                    </div>
                    {f.capacity && (
                      <div className="flex center between">
                        <span className="text-sm text-mute">Capacity</span>
                        <span className="fw-6 text-sm">{f.capacity}</span>
                      </div>
                    )}
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
                    <Icon name="globe" size={14} className="text-mute"/>
                    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Network</div>
                  </div>
                  <div className="flex col gap-2">
                    <div className="flex center between">
                      <span className="text-sm text-mute">Public IP</span>
                      <span className={`fw-6 text-sm ${f.publicIpRequired ? 'text-ok' : 'text-mute'}`}>{f.publicIpRequired ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">Bandwidth</span>
                      <span className="fw-6 text-sm">{f.bandwidth}</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">Zone</span>
                      <span className="fw-6 text-sm">{selectedZone?.name}</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">NICs</span>
                      <span className="fw-6 text-sm">{f.nics.map((n: any) => `${n.label} (${n.type})`).join(', ')}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                  <div className="flex center gap-2 mb-3">
                    <Icon name="shield" size={14} className="text-mute"/>
                    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Services</div>
                  </div>
                  <div className="flex col gap-2">
                    <div className="flex center between">
                      <span className="text-sm text-mute">Backup</span>
                      <span className="fw-6 text-sm">{f.backupEnabled ? `${f.backupType === 'daily' ? 'Daily' : 'Weekly'}` : 'No'}</span>
                    </div>
                    <div className="flex center between">
                      <span className="text-sm text-mute">Monitoring</span>
                      <span className={`fw-6 text-sm ${f.monitoring ? 'text-ok' : 'text-mute'}`}>{f.monitoring ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)' }}>
                  <div className="flex center gap-2 mb-3">
                    <Icon name="box" size={14} className="text-mute"/>
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
                  <Icon name="lock" size={14} className="text-mute"/>
                  <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Security</div>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div>
                    <div className="text-xs text-mute mb-1">Firewall ports</div>
                    <div className="fw-6 text-sm">{f.firewallPorts.join(', ') || 'none'}</div>
                  </div>
                  {f.portForwarding.length > 0 && (
                    <div>
                      <div className="text-xs text-mute mb-1">Port forwarding</div>
                      <div className="fw-6 text-sm">{f.portForwarding.map((r: any) => `${r.srcPort}→${r.dstPort}/${r.protocol}`).join(', ')}</div>
                    </div>
                  )}
                </div>
              </div>

              {f.additionalNotes && (
                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 14, border: '1px solid var(--line)', marginTop: 16 }}>
                  <div className="flex center gap-2 mb-2">
                    <Icon name="message" size={14} className="text-mute"/>
                    <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Additional Notes</div>
                  </div>
                  <div className="text-sm" style={{ lineHeight: 1.5 }}>{f.additionalNotes}</div>
                </div>
              )}

              <div className="flex gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setShowSummary(false)} style={{ padding: '10px 20px', fontSize: 13 }}>Cancel</button>
                <button className="btn accent" onClick={confirmSubmit} style={{ padding: '10px 20px', fontSize: 13 }}><Icon name="check" size={12}/>Confirm & Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
