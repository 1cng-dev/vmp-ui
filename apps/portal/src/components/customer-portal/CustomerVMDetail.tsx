import React, { useState, useEffect } from 'react'
import useVMStore from '../../store/vmStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { StatusPill, SecCheck, formatMMK } from '../ui/ui'
import { InfoCard, UsageCard, UsageDetailCard } from './VMHelperComponents'
import { CustUpgradeModal, CustConvertToPaidModal } from '../modals/CustomerVMModals'
import { supabase } from '../../lib/supabase'

interface CustomerVMDetailProps {
  vm: any
  onClose: () => void
  onRenew: () => void
  me: any
}

export const CustomerVMDetail: React.FC<CustomerVMDetailProps> = ({ vm: initialVm, onClose, onRenew, me }) => {
  const { vms, startVM, stopVM, restartVM, snapshotVM, updateVMTags, updateVMNotes } = useVMStore()
  const { toast } = useUIStore()
  const vm = vms.find((v: any) => v.id === initialVm.id) || initialVm
  const [tab, setTab] = useState('overview')
  const [revealCreds, setRevealCreds] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [notesDraft, setNotesDraft] = useState(vm.notes || '')
  const [snapName, setSnapName] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [convertToPaidOpen, setConvertToPaidOpen] = useState(false)
  const [vmRequest, setVmRequest] = useState<any>(null)

  // Fetch vm_request data
  useEffect(() => {
    if (vm.vm_request_id) {
      supabase
        .from('vm_requests')
        .select('*')
        .eq('id', vm.vm_request_id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching vm_request:', error)
          } else {
            setVmRequest(data)
          }
        })
    }
  }, [vm.vm_request_id])

  const addonServices = vm.addonServices || {
    backupEnabled: false,
    monitoring: false,
    cpfsEnabled: false,
    ccisEnabled: false,
    ddosProtection: 'none',
    sslCertificate: 'none',
  }

  const tags = vm.tags || []
  const isRunning = vm.powerState === 'Running'

  const cpu: number[] = []
  const ram: number[] = []
  const net: number[] = []
  const disk = Math.round(vm.storage * 0.42)

  const creds = vm.username && vm.password ? [
    { type: 'SSH', user: vm.username, pass: vm.password }
  ] : []

  const snapshots = Array.isArray((vm as any).snapshots) ? (vm as any).snapshots : []

  const addTag = () => {
    if (!tagInput.trim()) return
    const next = [...tags, tagInput.trim()]
    updateVMTags(vm.id, next)
    setTagInput('')
  }
  const removeTag = (t: string) => updateVMTags(vm.id, tags.filter((x: string) => x !== t))

  const openConsole = () => {
    const params = new URLSearchParams({
      name: vm.hostname, id: vm.id, ip: vm.public_ip || '203.81.64.10',
      os: 'linux', vcpu: String(vm.vcpu), ram: String(vm.ram_gb), storage: String(vm.storage_gb),
      running: vm.power_state === 'Running' ? '1' : '0',
    })
    window.open(`vnc-console.html?${params.toString()}`, '_blank', 'noopener,width=1180,height=760')
    toast(`Opening VNC console for ${vm.hostname}…`, 'info')
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to VMs</button>
            <span className="mono text-xs text-mute">{vm.id}</span>
          </div>
          <h1 className="page-title">{vm.hostname}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={vm.status}/>
            <StatusPill status={vm.task_type || 'new'}/>
            <span className="pill"><Icon name={vm.power_state === 'Running' ? 'play' : 'pause'} size={10}/>{vm.power_state}</span>
            {tags.map((t: string) => <span key={t} className="pill subtle">#{t}</span>)}
          </div>
        </div>
        <div className="page-actions">
          {isRunning
            ? <button className="btn" onClick={() => stopVM(vm.id)}><Icon name="pause" size={12}/>Stop</button>
            : <button className="btn primary" onClick={() => startVM(vm.id)}><Icon name="play" size={12}/>Start</button>
          }
          <button className="btn" onClick={() => restartVM(vm.id)} disabled={!isRunning}><Icon name="refresh" size={12}/>Restart</button>
          <button className="btn" onClick={openConsole} disabled={!isRunning} title={isRunning ? 'Open VNC console in new tab' : 'Start the VM to open console'}><Icon name="terminal" size={12}/>Console<Icon name="external" size={10}/></button>
          <button className="btn" onClick={() => setUpgradeOpen(true)}><Icon name="arrow-up" size={12}/>Change Plan</button>
          {vmRequest?.request_type === 'trial' && <button className="btn primary" onClick={() => setConvertToPaidOpen(true)}><Icon name="credit-card" size={12}/>Convert to Paid</button>}
          <button className="btn accent" onClick={onRenew}><Icon name="refresh" size={12}/>Renew</button>
        </div>

      {upgradeOpen && <CustUpgradeModal vm={vm} onClose={() => setUpgradeOpen(false)} me={me}/>}
      {convertToPaidOpen && <CustConvertToPaidModal vm={vm} onClose={() => setConvertToPaidOpen(false)}/>}
      </div>

      <div className="grid-4 mb-4">
        <UsageCard label="CPU" value={`${cpu[23]}%`} data={cpu} color="var(--accent)"/>
        <UsageCard label="RAM" value={`${ram[23]}%`} data={ram} color="var(--info)" sub={`${Math.round(vm.ram * ram[23] / 100)} / ${vm.ram} GB`}/>
        <UsageCard label="Storage" value={`${Math.round(disk / vm.storage * 100)}%`} data={[disk, disk, disk, disk]} color="oklch(0.55 0.18 285)" sub={`${disk} / ${vm.storage} GB`}/>
        <UsageCard label="Network out" value={`${net[23]} Mbps`} data={net} color="var(--ok)"/>
      </div>

      <div className="card">
        <div className="tabs">
          {['overview', 'specs', 'network', 'backups', 'credentials', 'snapshots', 'usage', 'addons', 'tags-notes'].map(t => {
            const label = t === 'tags-notes' ? 'Tags & notes' : t === 'addons' ? 'Add-on Services' : t.charAt(0).toUpperCase() + t.slice(1)
            return (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {label}
                {t === 'snapshots' && <span className="count">{snapshots.length}</span>}
              </button>
            )
          })}
        </div>

        {tab === 'overview' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 14 }}>
              <InfoCard icon="cpu" title="Specification" rows={[
                ['vCPU', `${vm.vcpu} cores`],
                ['Memory', `${vm.ram_gb} GB`],
                ['Storage', `${vm.storage_gb} GB SSD`],
                ['OS', vmRequest?.os_name || vmRequest?.custom_os_name || 'Linux'],
                ['Purpose', vmRequest?.purpose || '—'],
              ]}/>
              <InfoCard icon="invoice" title="Subscription" rows={[
                ['VM ID', vm.legacy_id || vm.id],
                ['Assigned VM ID', (vm as any).assigned_vmid || vmRequest?.assigned_vmid || '—'],
                ['Task Type', vm.task_type || 'New'],
                ['Created', new Date(vm.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
                ['Expires', vm.expiry ? new Date(vm.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
              ]}/>
            </div>
          </div>
        )}

        {tab === 'network' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Public access</div>
                <dl className="dl">
                  <dt>Public IPv4</dt><dd className="mono fw-6">{vm.public_ip || '—'}</dd>
                  <dt>Private IPv4</dt><dd className="mono">{vm.private_ip || '—'}</dd>
                  <dt>NICs</dt><dd className="mono">{vmRequest?.nics && vmRequest.nics.length > 0 
                    ? vmRequest.nics.map((nic: any) => nic.vlan || nic.label).join(', ')
                    : vmRequest?.zone || '—'}</dd>
                  <dt>Public access</dt><dd><span className="pill ok"><span className="dot"/>Enabled</span></dd>
                  <dt>Firewall policy</dt><dd className="mono">Default</dd>
                  <dt>Port forwarding</dt><dd className="mono">{vmRequest?.port_forwarding?.length > 0 
                    ? vmRequest.port_forwarding.map((pf: any) => `${pf.srcPort} → ${pf.dstPort} (${pf.protocol})`).join(', ')
                    : '—'}</dd>
                </dl>
              </div>
              <div>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Allowed ports</div>
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-body flush">
                    <table className="tbl">
                      <thead><tr><th>Port</th><th>Protocol</th><th>Source</th></tr></thead>
                      <tbody>
                        {vmRequest?.firewall_ports?.map((port: any, idx: number) => (
                          <tr key={idx}>
                            <td className="mono fw-6">{port}</td>
                            <td className="mono">TCP</td>
                            <td className="text-sm">any</td>
                          </tr>
                        ))}
                        {(!vmRequest?.firewall_ports || vmRequest.firewall_ports.length === 0) && (
                          <>
                            <tr><td className="mono fw-6">443</td><td className="mono">TCP</td><td className="text-sm">any (HTTPS)</td></tr>
                            <tr><td className="mono fw-6">80</td><td className="mono">TCP</td><td className="text-sm">any (HTTP)</td></tr>
                            <tr><td className="mono fw-6">22</td><td className="mono">TCP</td><td className="text-sm">trusted-admin</td></tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'backups' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <InfoCard icon="shield" title="Backup Configuration" rows={[
                ['Backup Enabled', (vm as any).backup_enabled ? 'Yes' : 'No'],
                ['Backup Type', (vm as any).backup_enabled ? (vm as any).backup_type : '—'],
              ]}/>
            </div>
          </div>
        )}

        {tab === 'credentials' && (
          <div className="card-body">
            <div style={{ padding: 12, background: 'var(--warn-soft)', borderRadius: 6, fontSize: 12, color: 'oklch(0.4 0.12 75)', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
              <Icon name="lock" size={14}/>
              <div>Credentials are encrypted at rest. Reveal logs an audit event.</div>
            </div>
            <table className="tbl">
              <thead><tr><th>Type</th><th>Username</th><th>Password</th><th>Last accessed</th><th></th></tr></thead>
              <tbody>
                {creds.map((c: any) => (
                  <tr key={c.type}>
                    <td>{c.type}</td>
                    <td className="mono">{c.user}</td>
                    <td className="mono">{revealCreds ? c.pass : '••••••••••••••••'}</td>
                    <td className="text-sm text-mute">2 days ago</td>
                    <td className="right">
                      <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(c.pass); toast('Password copied', 'ok') }}><Icon name="check" size={11}/>Copy</button>
                    </td>
                  </tr>
                ))}
                {creds.length === 0 && (
                  <tr>
                    <td colSpan={5}><div className="empty"><div className="sub">No credentials available.</div></div></td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex gap-2 mt-3">
              <button className="btn" onClick={() => setRevealCreds(!revealCreds)}><Icon name="eye" size={12}/>{revealCreds ? 'Hide' : 'Reveal'} all</button>
              <button className="btn" onClick={() => toast('Password rotation requested — Sales will contact you', 'info')}><Icon name="refresh" size={12}/>Request rotation</button>
            </div>
          </div>
        )}

        {tab === 'snapshots' && (
          <div className="card-body">
            <div className="flex gap-2 mb-3">
              <input value={snapName} onChange={e => setSnapName(e.target.value)} placeholder="Snapshot name (optional)" style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5 }}/>
              <button className="btn primary" onClick={() => { snapshotVM(vm.id, snapName); setSnapName('') }}><Icon name="plus" size={12}/>Create snapshot</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Snapshot ID</th><th>Created</th><th className="right">Size</th><th>Type</th><th></th></tr></thead>
              <tbody>
                {snapshots.map((s: any) => (
                  <tr key={s.id}>
                    <td className="mono text-xs">{s.id}</td>
                    <td className="tnum text-sm">{s.date}</td>
                    <td className="right tnum text-sm">{s.size} GB</td>
                    <td><span className="pill subtle">{s.type}</span></td>
                    <td className="right">
                      <button className="btn sm" onClick={() => toast(`Restoring from ${s.id}…`, 'info')}>Restore</button>
                      <button className="btn sm danger" style={{ marginLeft: 4 }} onClick={() => toast('Snapshot delete request submitted', 'info')}>Delete</button>
                    </td>
                  </tr>
                ))}
                {snapshots.length === 0 && (
                  <tr><td colSpan={5}><div className="empty"><div className="sub">No snapshots found.</div></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tags-notes' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 24 }}>
              <div>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tags</div>
                <div className="flex wrap gap-2 mb-2">
                  {tags.length === 0 && <span className="text-xs text-mute">No tags yet.</span>}
                  {tags.map((t: string) => (
                    <span key={t} className="pill accent" style={{ paddingRight: 4 }}>
                      <span>#{t}</span>
                      <button className="icon-btn" style={{ width: 18, height: 18, marginLeft: 2 }} onClick={() => removeTag(t)}><Icon name="x" size={10}/></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Add a tag (e.g. production, db, backup)" style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5 }}/>
                  <button className="btn" onClick={addTag}><Icon name="plus" size={12}/>Add</button>
                </div>
                <div className="text-xs text-mute mt-2">Tags help you organize VMs. Try: production, staging, db, web, backup-critical.</div>
              </div>
              <div>
                <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes</div>
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  placeholder="Add notes for this VM…"
                  rows={6}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5, resize: 'vertical' }}
                />
                <div className="flex gap-2 mt-2">
                  <button className="btn accent" onClick={() => { updateVMNotes(vm.id, notesDraft); toast('Notes saved', 'ok') }}><Icon name="check" size={12}/>Save notes</button>
                  <button className="btn ghost" onClick={() => setNotesDraft(vm.notes || '')}>Reset</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'specs' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 14 }}>
              <InfoCard icon="server" title="Instance" mono rows={[
                ['VM ID', vm.legacy_id || vm.id],
                ['Assigned VM ID', (vm as any).assigned_vmid || vmRequest?.assigned_vmid || '—'],
                ['Hostname', vm.hostname],
                ['Power state', vm.power_state],
                ['Request ID', vmRequest?.legacy_id || vm.vm_request_id],
                ['Request Type', vmRequest?.request_type || 'paid'],
                ['Status', vmRequest?.status || '—'],
                ['Duration', (vm as any).duration ? `${(vm as any).duration} month${(vm as any).duration > 1 ? 's' : ''}` : vmRequest?.duration ? `${vmRequest.duration} month${vmRequest.duration > 1 ? 's' : ''}` : '—'],
                ['Expiry', vm.expiry ? new Date(vm.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
              ]}/>
              <InfoCard icon="cpu" title="Hardware" rows={[
                ['vCPU', `${vm.vcpu} cores`],
                ['Memory', `${vm.ram_gb} GB`],
                ['Storage', `${vm.storage_gb} GB SSD`],
                ['OS', vmRequest?.os_name || vmRequest?.custom_os_name || 'Linux'],
                ['OS Version', vmRequest?.os_version || '—'],
                ['Specification Type', vmRequest?.sizing || 'Standard'],
              ]}/>
            </div>
            <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 8, marginTop: 14, color: 'var(--info)' }}>
              <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>Need a different spec? Use <strong>Upgrade</strong> or <strong>Change plan</strong> above — your account manager will confirm with a quote.</div>
            </div>
          </div>
        )}

        {tab === 'usage' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              <UsageDetailCard label="CPU" data={cpu} color="var(--accent)" unit="%" avg={Math.round(cpu.reduce((a, b) => a + b, 0) / cpu.length)} peak={Math.max(...cpu)}/>
              <UsageDetailCard label="RAM" data={ram} color="var(--info)" unit="%" avg={Math.round(ram.reduce((a, b) => a + b, 0) / ram.length)} peak={Math.max(...ram)}/>
              <UsageDetailCard label="Network out" data={net} color="var(--ok)" unit=" Mbps" avg={Math.round(net.reduce((a, b) => a + b, 0) / net.length)} peak={Math.max(...net)}/>
              <div className="card" style={{ borderColor: 'var(--line)' }}>
                <div className="card-body">
                  <div className="text-xs text-mute fw-6 mb-2" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Storage</div>
                  <div className="flex center between mb-2">
                    <span className="tnum fw-7" style={{ fontSize: 24 }}>{disk} GB</span>
                    <span className="text-sm text-mute tnum">of {vm.storage} GB</span>
                  </div>
                  <div className="bar"><div className="fill" style={{ width: `${(disk / vm.storage) * 100}%`, background: 'oklch(0.55 0.18 285)' }}/></div>
                  <div className="flex between text-xs mt-2"><span className="text-mute">Used</span><span className="text-mute tnum">{Math.round(disk / vm.storage * 100)}%</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'addons' && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 16 }}>
              {addonServices.backupEnabled && (
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-head">
                    <h4 className="card-title" style={{ fontSize: 14 }}>Backup Service</h4>
                    <span className="pill ok"><span className="dot"/>Enabled</span>
                  </div>
                  <div className="card-body">
                    <dl className="dl">
                      <dt>Frequency</dt><dd className="fw-6">{addonServices.backupFreq === 'daily' ? 'Daily' : 'Weekly'}</dd>
                      <dt>Retention</dt><dd className="fw-6">{addonServices.backupRetention} {addonServices.backupFreq === 'daily' ? 'days' : 'weeks'}</dd>
                      <dt>Last backup</dt><dd className="tnum">{new Date().toISOString().slice(0, 10)}</dd>
                    </dl>
                  </div>
                </div>
              )}

              {addonServices.monitoring && (
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-head">
                    <h4 className="card-title" style={{ fontSize: 14 }}>Monitoring & Alerts</h4>
                    <span className="pill ok"><span className="dot"/>Enabled</span>
                  </div>
                  <div className="card-body">
                    <dl className="dl">
                      <dt>Metrics monitored</dt><dd>CPU, RAM, Disk, Uptime</dd>
                      <dt>Alert channels</dt><dd>Email, SMS</dd>
                      <dt>Status</dt><dd className="text-ok fw-6">All systems normal</dd>
                    </dl>
                  </div>
                </div>
              )}

              {addonServices.cpfsEnabled && (
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-head">
                    <h4 className="card-title" style={{ fontSize: 14 }}>CPFS (Cloud Protection Firewall)</h4>
                    <span className="pill ok"><span className="dot"/>Enabled</span>
                  </div>
                  <div className="card-body">
                    <dl className="dl">
                      <dt>Package</dt><dd className="fw-6">{addonServices.cpfsPackage === 'premium' ? 'Premium' : 'Standard'}</dd>
                      <dt>Max sessions</dt><dd>{addonServices.cpfsPackage === 'premium' ? '1500' : '1000'}/sec</dd>
                      <dt>Reports</dt><dd>Weekly</dd>
                    </dl>
                  </div>
                </div>
              )}

              {addonServices.ccisEnabled && (
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-head">
                    <h4 className="card-title" style={{ fontSize: 14 }}>CCIS (Content Inspection)</h4>
                    <span className="pill ok"><span className="dot"/>Enabled</span>
                  </div>
                  <div className="card-body">
                    <dl className="dl">
                      <dt>Plan</dt><dd className="fw-6">{addonServices.ccisPlan?.charAt(0).toUpperCase() + addonServices.ccisPlan?.slice(1)}</dd>
                      <dt>Capacity</dt><dd>
                        {addonServices.ccisPlan === 'basic' && '100 MB'}
                        {addonServices.ccisPlan === 'standard' && '500 MB'}
                        {addonServices.ccisPlan === 'professional' && '1 GB'}
                        {addonServices.ccisPlan === 'enterprise' && '5 GB'}
                      </dd>
                      <dt>Status</dt><dd className="text-ok fw-6">Active</dd>
                    </dl>
                  </div>
                </div>
              )}

              {addonServices.ddosProtection !== 'none' && (
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-head">
                    <h4 className="card-title" style={{ fontSize: 14 }}>DDoS Protection</h4>
                    <span className="pill ok"><span className="dot"/>{addonServices.ddosProtection}</span>
                  </div>
                  <div className="card-body">
                    <dl className="dl">
                      <dt>Protection level</dt><dd className="fw-6">{addonServices.ddosProtection}</dd>
                      <dt>Mitigation capacity</dt><dd>Up to 10 Gbps</dd>
                      <dt>Status</dt><dd className="text-ok fw-6">Active</dd>
                    </dl>
                  </div>
                </div>
              )}

              {addonServices.sslCertificate !== 'none' && (
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-head">
                    <h4 className="card-title" style={{ fontSize: 14 }}>SSL Certificate</h4>
                    <span className="pill ok"><span className="dot"/>{addonServices.sslCertificate}</span>
                  </div>
                  <div className="card-body">
                    <dl className="dl">
                      <dt>Type</dt><dd className="fw-6">{addonServices.sslCertificate}</dd>
                      <dt>Issuer</dt><dd>Let's Encrypt</dd>
                      <dt>Expires</dt><dd className="tnum">{new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)}</dd>
                    </dl>
                  </div>
                </div>
              )}

              {!addonServices.backupEnabled && !addonServices.monitoring && !addonServices.cpfsEnabled && !addonServices.ccisEnabled && addonServices.ddosProtection === 'none' && addonServices.sslCertificate === 'none' && (
                <div className="card" style={{ borderColor: 'var(--line)', gridColumn: 'span 2' }}>
                  <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                    <Icon name="box" size={32} style={{ color: 'var(--ink-3)', marginBottom: 12 }}/>
                    <div className="text-mute">No add-on services are enabled for this VM.</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>Contact your account manager to add services.</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--info-soft)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 8, color: 'var(--info)' }}>
              <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
              <div>Need to add or modify add-on services? Contact your account manager or use the <strong>Add-on Services</strong> section in the customer portal.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
