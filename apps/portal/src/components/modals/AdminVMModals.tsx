// Admin VM action modals — New VM, Renew, Change Spec (matching original UI)

import React, { useState } from 'react'
import useVMStore from '../../store/vmStore'
import useCustomerStore from '../../store/customerStore'
import useTaskStore from '../../store/taskStore'
import useInvoiceStore from '../../store/invoiceStore'
import useTeamStore from '../../store/teamStore'
import useVMRequestStore from '../../store/vmRequestStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import useUIStore from '../../store/uiStore'
import { useSystemSettingsStore } from '../../store/systemSettingsStore'
import Icon from '../../lib/icons'
import { formatMMK, StatusPill, Avatar } from '../ui/ui'

interface VM {
  id: string
  name: string
  customer: string
  priceMonth: number
  expiry: string
  vcpu: number
  ram: number
  storage: number
  bandwidth: string
  os: string
  datacenter: string
  node: string
  type: string
  status: string
}

// ── New VM Modal ────────────────────────────────────────────────────────
interface NewVMModalProps {
  onClose: () => void
}

const NewVMModal: React.FC<NewVMModalProps> = ({ onClose }) => {
  const { addVM } = useVMStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const [step, setStep] = useState(1)
  const [f, setF] = useState({
    customer: customers.find((c: any) => c.kyc === 'Approved')?.id || '',
    name: '',
    environment: 'Production',
    label: '',
    purpose: '',
    adminContact: '',
    type: 'Paid',
    subscription: '1 year',
    priceMonth: 180000,
    vcpu: 4, ram: 16, storage: 200, bandwidth: '1 Gbps',
    osFamily: 'ubuntu', os: 'Ubuntu 22.04 LTS',
    sshKey: '',
    publicAccess: true,
    portForward: '443→443, 22→2222',
    vlan: '',
    publicIp: '',
    datacenter: 'Yangon DC1',
    node: 'pve-node-02',
    firewallPolicy: '',
    backup: 'Daily 02:00, 7d retention',
    security: true,
    notes: '',
    powerState: 'Running',
    proxmoxFlag: 'P',
    interconnect: [],
    start: new Date().toISOString().slice(0, 10),
    expiry: '',
  })
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const approvedCustomers = customers.filter((c: any) => c.kyc === 'Approved')
  const cust = approvedCustomers.find((c: any) => c.id === f.customer)
  const osCatalog = [
    { id: 'ubuntu', name: 'Ubuntu', logo: 'U', accent: 'oklch(0.6 0.17 30)', kind: 'Linux', versions: ['24.04 LTS', '22.04 LTS', '20.04 LTS'] },
    { id: 'debian', name: 'Debian', logo: 'D', accent: 'oklch(0.55 0.18 0)', kind: 'Linux', versions: ['12 (Bookworm)', '11 (Bullseye)'] },
    { id: 'rocky', name: 'Rocky Linux', logo: 'R', accent: 'oklch(0.58 0.16 155)', kind: 'Linux', versions: ['9.3', '8.9'] },
    { id: 'alma', name: 'AlmaLinux', logo: 'A', accent: 'oklch(0.6 0.15 25)', kind: 'Linux', versions: ['9.3', '8.9'] },
    { id: 'centos', name: 'CentOS Stream', logo: 'C', accent: 'oklch(0.55 0.17 285)', kind: 'Linux', versions: ['9', '8'] },
    { id: 'fedora', name: 'Fedora Server', logo: 'F', accent: 'oklch(0.5 0.16 250)', kind: 'Linux', versions: ['40', '39'] },
    { id: 'alpine', name: 'Alpine', logo: 'Al', accent: 'oklch(0.55 0.15 230)', kind: 'Linux', versions: ['3.19', '3.18'] },
    { id: 'windows', name: 'Windows Server', logo: 'W', accent: 'oklch(0.5 0.14 245)', kind: 'Windows', versions: ['2022', '2019'] },
    { id: 'freebsd', name: 'FreeBSD', logo: 'B', accent: 'oklch(0.55 0.18 15)', kind: 'BSD', versions: ['14.0', '13.3'] },
    { id: 'docker', name: 'Docker (Ubuntu)', logo: '◧', accent: 'oklch(0.55 0.13 230)', kind: 'App template', versions: ['Ubuntu 22.04 + Docker 26'] },
    { id: 'wordpress', name: 'WordPress', logo: 'Wp', accent: 'oklch(0.5 0.12 250)', kind: 'App template', versions: ['LAMP + WP 6.5'] },
    { id: 'cpanel', name: 'cPanel / WHM', logo: 'cP', accent: 'oklch(0.58 0.15 40)', kind: 'App template', versions: ['AlmaLinux 9 + cPanel'] },
  ]
  const selOS = osCatalog.find((o: any) => o.id === f.osFamily) || osCatalog[0]

  const cpuSteps = [1, 2, 4, 6, 8, 12, 16, 24, 32]
  const ramSteps = [1, 2, 4, 8, 16, 24, 32, 48, 64, 128]
  const storageSteps = [25, 50, 100, 200, 400, 500, 1000, 2000]

  const computedPrice = f.vcpu * 20000 + f.ram * 6000 + f.storage * 200 + (f.bandwidth === '1 Gbps' ? 30000 : f.bandwidth === '500 Mbps' ? 10000 : 0)

  const submit = () => {
    const expiry = new Date()
    const months: Record<string, number> = { '14-day trial': 0.5, '6 months': 6, '1 year': 12, '2 years': 24 }
    expiry.setMonth(expiry.getMonth() + (months[f.subscription] || 12))
    addVM({
      ...f,
      hostname: f.name || `vm-${Date.now()}`,
      status: 'Active',
      expiry: expiry.toISOString().slice(0, 10),
                  public_ip: f.publicAccess ? (f.publicIp || `203.81.64.${100 + Math.floor(Math.random() * 100)}`) : '—',
                })
    toast(`VM ${f.name} created and queued for provisioning`, 'ok')
    onClose()
  }

  const stepLabels = ['Customer & details', 'OS template', 'Specification', 'Network', 'Review']
  const totalSteps = stepLabels.length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Provision new VM</h3>
            <div className="text-xs text-mute mt-1">Step {step} of {totalSteps} — {stepLabels[step - 1]}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div className="modal-body">
          {/* Stepper */}
          <div className="flex gap-1 mb-4" style={{ alignItems: 'center' }}>
            {stepLabels.map((l, i) => (
              <React.Fragment key={l}>
                <div className="flex center gap-2" style={{ opacity: i + 1 <= step ? 1 : 0.5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: i + 1 < step ? 'var(--ok)' : i + 1 === step ? 'var(--accent)' : 'var(--surface-3)', color: i + 1 <= step ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700 }}>
                    {i + 1 < step ? <Icon name="check" size={11} /> : i + 1}
                  </div>
                  <span className="text-xs fw-6" style={{ whiteSpace: 'nowrap', color: i + 1 === step ? 'var(--ink)' : 'var(--ink-3)' }}>{l}</span>
                </div>
                {i < stepLabels.length - 1 && <div style={{ flex: 1, height: 2, background: i + 1 < step ? 'var(--ok)' : 'var(--surface-3)' }} />}
              </React.Fragment>
            ))}
          </div>
          {/* Step 1: Customer & details */}
          {step === 1 && (
            <div className="flex col gap-3">
              <div className="field">
                <label>Customer</label>
                <select value={f.customer} onChange={e => set('customer', e.target.value)}>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.company} — {c.name}</option>
                  ))}
                </select>
                <div className="hint">Only KYC-approved customers can have new VMs provisioned.</div>
              </div>
              {cust && (
                <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={cust.name} size={32} />
                  <div style={{ flex: 1 }}>
                    <div className="fw-6 text-sm">{cust.company}</div>
                    <div className="text-xs text-mute">{cust.id} · {cust.email} · {cust.phone}</div>
                  </div>
                  <StatusPill status={(cust as any).kyc} />
                </div>
              )}
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>VM name (hostname)</label>
                  <input value={f.name} onChange={e => set('name', e.target.value.replace(/\s/g, '-').toLowerCase())} placeholder="mlc-app-prod-02" style={{ fontFamily: 'var(--mono)' }} />
                </div>
                <div className="field">
                  <label>Label / tag</label>
                  <input value={f.label} onChange={e => set('label', e.target.value)} placeholder="e.g. erp, web, db" />
                </div>
              </div>
              <div className="field">
                <label>Environment</label>
                <div className="flex gap-2">
                  {['Production', 'Staging', 'Development'].map(en => (
                    <button key={en} type="button" className={`filter-chip ${f.environment === en ? 'active' : ''}`} onClick={() => set('environment', en)}>{en}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Purpose / workload</label>
                <input value={f.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. ERP production database, internal web app" />
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Type</label>
                  <select value={f.type} onChange={e => set('type', e.target.value)}>
                    <option>Paid</option><option>Trial</option>
                  </select>
                </div>
                <div className="field">
                  <label>Subscription period</label>
                  <select value={f.subscription} onChange={e => set('subscription', e.target.value)}>
                    {f.type === 'Trial'
                      ? <option>14-day trial</option>
                      : <><option>6 months</option><option>1 year</option><option>2 years</option></>}
                  </select>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Start date</label>
                  <input type="date" value={f.start} onChange={e => set('start', e.target.value)} />
                </div>
                <div className="field">
                  <label>Technical contact (email)</label>
                  <input value={f.adminContact} onChange={e => set('adminContact', e.target.value)} placeholder={cust?.email || 'admin@customer.com'} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: OS template */}
          {step === 2 && (
            <div className="flex col gap-3">
              <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Choose an OS template</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {osCatalog.map((o: any) => {
                  const sel = f.osFamily === o.id
                  return (
                    <button key={o.id} type="button"
                      onClick={() => { set('osFamily', o.id); set('os', `${o.name} ${o.versions[0]}`); }}
                      style={{
                        textAlign: 'left', padding: 11, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)',
                        background: sel ? 'var(--accent-soft)' : 'var(--surface)', border: '1.5px solid', borderColor: sel ? 'var(--accent)' : 'var(--line)',
                        boxShadow: sel ? '0 0 0 3px var(--accent-soft)' : 'none', transition: 'all 0.15s',
                      }}
                    >
                      <div className="flex center gap-2 mb-1">
                        <span style={{ width: 30, height: 30, borderRadius: 7, background: `${o.accent}1a`, color: o.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{o.logo}</span>
                        {sel && <Icon name="check" size={13} style={{ color: 'var(--accent-strong)', marginLeft: 'auto' }} />}
                      </div>
                      <div className="fw-7" style={{ fontSize: 12 }}>{o.name}</div>
                      <div className="text-xs text-mute">{o.kind} · {o.versions.length} ver.</div>
                    </button>
                  )
                })}
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Version</label>
                  <select value={f.os.replace(`${selOS.name} `, '')} onChange={e => set('os', `${selOS.name} ${e.target.value}`)}>
                    {selOS.versions.map((v: string) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Architecture</label>
                  <select defaultValue="x86_64"><option>x86_64</option><option>aarch64</option></select>
                </div>
              </div>
              <div className="field">
                <label>SSH public key (optional)</label>
                <textarea rows={2} value={f.sshKey} onChange={e => set('sshKey', e.target.value)} placeholder="ssh-ed25519 AAAA… (leave blank to auto-generate root password)" style={{ fontFamily: 'var(--mono)', fontSize: 11 }} />
              </div>
              <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 8, fontSize: 12, display: 'flex', gap: 8, color: 'var(--info)' }}>
                <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Selected image: <strong>{f.os}</strong>. The same OS catalog is offered to customers in the self-service Request VM flow.</div>
              </div>
            </div>
          )}

          {/* Step 3: Specification */}
          {step === 3 && (
            <div className="flex col gap-4">
              <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Custom configuration — size every resource</div>
              {[
                { label: 'vCPU cores', icon: 'cpu', steps: cpuSteps, val: f.vcpu, k: 'vcpu', unit: '' },
                { label: 'Memory', icon: 'database', steps: ramSteps, val: f.ram, k: 'ram', unit: ' GB' },
                { label: 'Storage (SSD)', icon: 'box', steps: storageSteps, val: f.storage, k: 'storage', unit: ' GB' },
              ].map((row: any) => (
                <div key={row.k}>
                  <div className="flex center between mb-2">
                    <span className="fw-6 text-sm flex center gap-2"><Icon name={row.icon} size={13} />{row.label}</span>
                    <span className="tnum fw-7" style={{ fontSize: 15, color: 'var(--accent-strong)' }}>{row.val}{row.unit}</span>
                  </div>
                  <div className="flex gap-1 wrap">
                    {row.steps.map((s: number) => (
                      <button key={s} type="button" className={`filter-chip ${row.val === s ? 'active' : ''}`} onClick={() => set(row.k, s)} style={{ minWidth: 48, justifyContent: 'center' }}>{s}{row.unit}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field"><label>Bandwidth</label><select value={f.bandwidth} onChange={e => set('bandwidth', e.target.value)}><option>100 Mbps</option><option>500 Mbps</option><option>1 Gbps</option></select></div>
                <div className="field"><label>Backup policy</label><select value={f.backup} onChange={e => set('backup', e.target.value)}><option>None</option><option>Daily 02:00, 7d retention</option><option>Daily 02:00, 14d retention</option><option>Hourly snapshots, 48h retention</option><option>Weekly Sun 02:00, 4w retention</option></select></div>
              </div>
              <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
                <div className="flex center between">
                  <div className="text-sm">Custom instance <span className="fw-7 mono">{f.vcpu}c · {f.ram}GB · {f.storage}GB</span></div>
                  <div className="right">
                    <div className="text-xs text-mute">Suggested price</div>
                    <div className="tnum fw-7" style={{ fontSize: 15 }}>MMK {formatMMK(computedPrice)}/mo</div>
                  </div>
                </div>
                <div className="field mt-3"><label>Monthly price (MMK) — override</label><input type="number" value={f.priceMonth} onChange={e => set('priceMonth', +e.target.value)} placeholder={String(computedPrice)} /></div>
              </div>
            </div>
          )}

          {/* Step 4: Network */}
          {step === 4 && (
            <div className="flex col gap-3">
              <div className="flex center between">
                <div>
                  <div className="fw-6 text-sm">Public access</div>
                  <div className="text-xs text-mute">Assign a public IPv4 and enable inbound routing</div>
                </div>
                <span className={`toggle ${f.publicAccess ? 'on' : ''}`} onClick={() => set('publicAccess', !f.publicAccess)} />
              </div>
              {f.publicAccess && (
                <>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="field"><label>Public IPv4</label><input value={f.publicIp} onChange={e => set('publicIp', e.target.value)} placeholder="auto-assign" style={{ fontFamily: 'var(--mono)' }} /></div>
                    <div className="field"><label>VLAN</label><input value={f.vlan} onChange={e => set('vlan', e.target.value)} placeholder="auto-assign" style={{ fontFamily: 'var(--mono)' }} /></div>
                  </div>
                  <div className="field"><label>Port forwarding</label><input value={f.portForward} onChange={e => set('portForward', e.target.value)} placeholder="443→443, 22→2222" style={{ fontFamily: 'var(--mono)' }} /></div>
                </>
              )}
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field"><label>Datacenter</label><select value={f.datacenter} onChange={e => set('datacenter', e.target.value)}><option>Yangon DC1</option><option>Yangon DC2</option><option>Mandalay DC1</option></select></div>
                <div className="field"><label>Proxmox node</label><select value={f.node} onChange={e => set('node', e.target.value)}><option>pve-node-01</option><option>pve-node-02</option><option>pve-node-03</option><option>pve-node-04</option><option>pve-node-05</option></select></div>
              </div>
              <div className="field"><label>Firewall policy name</label><input value={f.firewallPolicy} onChange={e => set('firewallPolicy', e.target.value)} placeholder={`fw-${f.name || 'vm'}`} style={{ fontFamily: 'var(--mono)' }} /></div>
              <div className="flex center between" style={{ padding: '4px 2px' }}>
                <div><div className="fw-6 text-sm">Hardened security baseline</div><div className="text-xs text-mute">Fail2ban, disabled root SSH, auto-patching</div></div>
                <span className={`toggle ${f.security ? 'on' : ''}`} onClick={() => set('security', !f.security)} />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="flex col gap-3">
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="card"><div className="card-head" style={{ padding: '10px 14px' }}><h3 className="card-title" style={{ fontSize: 12 }}><Icon name="building" size={12} /> Customer & account</h3></div>
                  <div className="card-body" style={{ padding: '10px 14px' }}>
                    <dl className="dl" style={{ gridTemplateColumns: '92px 1fr', gap: '7px 12px' }}>
                      <dt>Customer</dt><dd>{cust?.company}</dd>
                      <dt>Contact</dt><dd>{cust?.name}</dd>
                      <dt>Tech contact</dt><dd className="text-sm">{f.adminContact || cust?.email}</dd>
                      <dt>Environment</dt><dd><span className="pill subtle">{f.environment}</span></dd>
                    </dl>
                  </div>
                </div>
                <div className="card"><div className="card-head" style={{ padding: '10px 14px' }}><h3 className="card-title" style={{ fontSize: 12 }}><Icon name="server" size={12} /> Instance</h3></div>
                  <div className="card-body" style={{ padding: '10px 14px' }}>
                    <dl className="dl" style={{ gridTemplateColumns: '78px 1fr', gap: '7px 12px' }}>
                      <dt>Hostname</dt><dd className="mono">{f.name || '—'}</dd>
                      <dt>Label</dt><dd>{f.label || '—'}</dd>
                      <dt>OS</dt><dd>{f.os}</dd>
                      <dt>Type</dt><dd>{f.type} · {f.subscription}</dd>
                      <dt>Start</dt><dd className="tnum">{f.start}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="card"><div className="card-head" style={{ padding: '10px 14px' }}><h3 className="card-title" style={{ fontSize: 12 }}><Icon name="cpu" size={12} /> Specification</h3></div>
                  <div className="card-body" style={{ padding: '10px 14px' }}>
                    <dl className="dl" style={{ gridTemplateColumns: '78px 1fr', gap: '7px 12px' }}>
                      <dt>vCPU</dt><dd className="tnum">{f.vcpu} cores</dd>
                      <dt>RAM</dt><dd className="tnum">{f.ram} GB</dd>
                      <dt>Storage</dt><dd className="tnum">{f.storage} GB SSD</dd>
                      <dt>Bandwidth</dt><dd>{f.bandwidth}</dd>
                      <dt>Backup</dt><dd className="text-sm">{f.backup}</dd>
                    </dl>
                  </div>
                </div>
                <div className="card"><div className="card-head" style={{ padding: '10px 14px' }}><h3 className="card-title" style={{ fontSize: 12 }}><Icon name="network" size={12} /> Network</h3></div>
                  <div className="card-body" style={{ padding: '10px 14px' }}>
                    <dl className="dl" style={{ gridTemplateColumns: '78px 1fr', gap: '7px 12px' }}>
                      <dt>Access</dt><dd>{f.publicAccess ? 'Public IPv4' : 'Private only'}</dd>
                      <dt>Ports</dt><dd className="mono text-sm">{f.publicAccess ? f.portForward : '—'}</dd>
                      <dt>Datacenter</dt><dd>{f.datacenter}</dd>
                      <dt>Node</dt><dd className="mono">{f.node}</dd>
                      <dt>Firewall</dt><dd className="mono text-sm">{f.firewallPolicy || `fw-${f.name || 'vm'}`}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card-body" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="text-xs text-mute">Monthly charge</div>
                    <div className="tnum fw-7" style={{ fontSize: 20 }}>MMK {formatMMK(f.priceMonth || computedPrice)}</div>
                  </div>
                  <div className="text-xs text-mute" style={{ textAlign: 'right', maxWidth: 280 }}>A provisioning task is created and assigned to Engineering. The customer is notified when the VM is ready.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}><Icon name="chevron-left" size={11} />Back</button>}
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          {step < totalSteps
            ? <button className="btn primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !f.name}>Continue<Icon name="chevron-right" size={11} /></button>
            : <button className="btn accent" onClick={submit}><Icon name="check" size={12} />Provision VM</button>}
        </div>
      </div>
    </div>
  )
}

// ── Renew Modal ─────────────────────────────────────────────────────────
interface RenewModalProps {
  vm: VM
  onClose: () => void
}

const RenewModal: React.FC<RenewModalProps> = ({ vm, onClose }) => {
  const { customers } = useCustomerStore()
  const { addInvoice } = useInvoiceStore()
  const { toast } = useUIStore()
  const [months, setMonths] = useState(12)
  const monthOpts = [3, 6, 12, 24]
  const price = (vm as any).priceMonth * months
  const c = customers.find((cust: any) => cust.id === vm.customer)

  const submit = () => {
    // TODO: Implement renew functionality
    const invoiceDate = new Date().toISOString().slice(0, 10)
    // Issued date = VM start date
    const issuedDate = (vm as any).start
    // Due date = VM expiry date
    const dueDate = vm.expiry
    addInvoice({ customer_id: vm.customer, vm_request_ids: [vm.id], amount: price, vat: 0, gross_amount: price, invoice_date: invoiceDate, due: dueDate, issued: issuedDate })
    toast(`Renewed ${vm.name} for ${months} months`, 'ok')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Renew {vm.name}</h3>
            <div className="text-xs text-mute mt-1">Customer: {c?.company}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="field"><label>Renewal period</label>
              <div className="flex gap-2">
                {monthOpts.map(m => (
                  <button key={m} className={`filter-chip ${months === m ? 'active' : ''}`} onClick={() => setMonths(m)}>
                    {m < 12 ? `${m} months` : m === 12 ? '1 year' : `${m / 12} years`}
                  </button>
                ))}
              </div>
            </div>
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body">
                <dl className="dl">
                  <dt>Current expiry</dt><dd className="tnum">{vm.expiry}</dd>
                  <dt>New expiry</dt><dd className="tnum fw-6" style={{ color: 'var(--ok)' }}>
                    {(() => { const d = new Date(vm.expiry === '—' ? Date.now() : vm.expiry); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); })()}
                  </dd>
                  <dt>Monthly rate</dt><dd className="tnum">MMK {formatMMK(vm.priceMonth)}</dd>
                  <dt>Renewal total</dt><dd className="tnum fw-7" style={{ fontSize: 14 }}>MMK {formatMMK(price)}</dd>
                </dl>
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 6, fontSize: 12, display: 'flex', gap: 8 }}>
              <Icon name="invoice" size={14} />
              <div>An invoice will be created automatically and emailed to the customer.</div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" onClick={submit}><Icon name="check" size={12} />Renew & invoice</button>
        </div>
      </div>
    </div>
  )
}

// ── Change Spec Modal ────────────────────────────────────────────────────
interface SpecModalProps {
  vm: VM
  onClose: () => void
}

const SpecModal: React.FC<SpecModalProps> = ({ vm, onClose }) => {
  const { updateVM } = useVMStore()
  const { addTask } = useTaskStore()
  const { toast } = useUIStore()
  const [f, setF] = useState({ vcpu: vm.vcpu, ram: vm.ram, storage: vm.storage })
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))
  const oldPrice = vm.priceMonth
  const newPrice = Math.round(oldPrice * (f.vcpu / vm.vcpu * 0.4 + f.ram / vm.ram * 0.4 + f.storage / vm.storage * 0.2))
  const diff = newPrice - oldPrice

  const submit = () => {
    updateVM(vm.id, { ...f, priceMonth: newPrice } as any)
    addTask({ title: `Spec change: ${vm.name} (${vm.vcpu}/${vm.ram}/${vm.storage} → ${f.vcpu}/${f.ram}/${f.storage})`, customer: vm.customer, vm: vm.id, type: 'Upgrade', status: 'Pending' })
    toast('Spec change scheduled', 'ok')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Spec change — {vm.name}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="field"><label>vCPU</label><input type="number" value={f.vcpu} onChange={e => set('vcpu', +e.target.value)} /></div>
              <div className="field"><label>RAM (GB)</label><input type="number" value={f.ram} onChange={e => set('ram', +e.target.value)} /></div>
              <div className="field"><label>Storage (GB)</label><input type="number" value={f.storage} onChange={e => set('storage', +e.target.value)} /></div>
            </div>
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body">
                <div className="flex center between">
                  <div><div className="text-xs text-mute">Old monthly</div><div className="tnum fw-6">MMK {formatMMK(oldPrice)}</div></div>
                  <Icon name="chevron-right" size={14} />
                  <div><div className="text-xs text-mute">New monthly</div><div className="tnum fw-6">MMK {formatMMK(newPrice)}</div></div>
                  <div className="text-sm fw-7 tnum" style={{ color: diff >= 0 ? 'var(--bad)' : 'var(--ok)' }}>
                    {diff >= 0 ? '+' : ''}MMK {formatMMK(Math.abs(diff))}/mo
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" onClick={submit}>Apply & schedule</button>
        </div>
      </div>
    </div>
  )
}

// ── New Task Modal ─────────────────────────────────────────────────────────
interface NewTaskModalProps {
  onClose: () => void
  presetStatus?: string
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ onClose, presetStatus }) => {
  const { addTask } = useTaskStore()
  const { customers } = useCustomerStore()
  const { team } = useTeamStore()
  const { vms } = useVMStore()
  const [f, setF] = useState({
    title: '',
    customer: customers[0]?.id || '',
    vm: '',
    type: 'New',
    priority: 'Normal',
    assignee: team.find((t: any) => t.role === 'Engineer')?.name || '—',
    team: 'Provisioning',
    subscription: '1 year',
    status: presetStatus || 'Pending',
    notes: '',
  })
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))
  const custVMs = vms.filter((v: any) => v.customer === f.customer)

  const submit = () => {
    addTask(f)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Create provisioning task</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="field"><label>Title</label><input value={f.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" /></div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label>Customer</label>
                <select value={f.customer} onChange={e => set('customer', e.target.value)}>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </div>
              <div className="field"><label>Related VM (optional)</label>
                <select value={f.vm} onChange={e => set('vm', e.target.value)}>
                  <option value="">— None —</option>
                  {custVMs.map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.id})</option>)}
                </select>
              </div>
            </div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="field"><label>Type</label><select value={f.type} onChange={e => set('type', e.target.value)}><option>New</option><option>Renewal</option><option>Upgrade</option><option>Terminate</option></select></div>
              <div className="field"><label>Priority</label><select value={f.priority} onChange={e => set('priority', e.target.value)}><option>Normal</option><option>Urgent</option></select></div>
              <div className="field"><label>Status</label><select value={f.status} onChange={e => set('status', e.target.value)}><option>Pending</option><option>In Progress</option><option>Blocked</option><option>Done</option></select></div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label>Assignee</label>
                <select value={f.assignee} onChange={e => set('assignee', e.target.value)}>
                  <option value="—">Unassigned</option>
                  {team.map((t: any) => <option key={t.id} value={t.name}>{t.name} · {t.role}</option>)}
                </select>
              </div>
              <div className="field"><label>Team</label><select value={f.team} onChange={e => set('team', e.target.value)}><option>Sales</option><option>Provisioning</option><option>Network</option><option>Finance</option></select></div>
            </div>
            <div className="field"><label>Notes</label><textarea rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Context, links, customer comments…" /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" disabled={!f.title || !f.customer} onClick={submit}><Icon name="plus" size={12} />Create task</button>
        </div>
      </div>
    </div>
  )
}

// ── Terminate Modal ───────────────────────────────────────────────────────
interface TerminateModalProps {
  vm: VM
  onClose: () => void
}

const TerminateModal: React.FC<TerminateModalProps> = ({ vm, onClose }) => {
  const { updateVM } = useVMStore()
  const { updateAddonRequest, addonRequests } = useAddonRequestStore()
  const { toast } = useUIStore()
  const [inputValue, setInputValue] = useState('')

  const vmName = (vm as any).hostname || vm.name
  const isConfirmed = inputValue === vmName

  const submit = async () => {
    if (!isConfirmed) return
    
    // Find all add-on requests for this VM
    const vmAddonRequests = addonRequests.filter(a => a.vm_id === vm.id && a.status === 'Completed')
    
    // Terminate all associated add-on services
    for (const addon of vmAddonRequests) {
      await updateAddonRequest(addon.id, { operational_status: 'Terminated' })
    }
    
    // Terminate the VM
    updateVM(vm.id, { status: 'Terminated' as any, power_state: 'Stopped' as any })
    
    const addonCount = vmAddonRequests.length
    const message = addonCount > 0 
      ? `VM ${vmName} terminated along with ${addonCount} associated add-on service(s)`
      : `VM ${vmName} terminated`
    
    toast(message, 'warn')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--bad)' }}>Terminate {vmName}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div style={{ padding: 14, background: 'var(--warn-soft)', borderRadius: 8, marginBottom: 16 }}>
            <div className="flex gap-2">
              <Icon name="alert" size={18} style={{ color: 'var(--bad)' }} />
              <div>
                <div className="fw-7 text-sm" style={{ color: 'var(--bad)' }}>VM will be terminated</div>
                <div className="text-xs text-mute mt-1">VM status will be changed to Terminated. Data will be retained.</div>
              </div>
            </div>
          </div>
          <div className="field">
            <label>Type the VM name to confirm</label>
            <input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={vmName} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!isConfirmed} onClick={submit}>
            <Icon name="trash" size={12} />Terminate VM
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Modal ───────────────────────────────────────────────────────
interface DeleteModalProps {
  vm: VM
  onClose: () => void
}

const DeleteModal: React.FC<DeleteModalProps> = ({ vm, onClose }) => {
  const { deleteVM } = useVMStore()
  const { toast } = useUIStore()
  const [inputValue, setInputValue] = useState('')

  const vmName = (vm as any).hostname || vm.name
  const isConfirmed = inputValue === vmName

  const submit = () => {
    if (!isConfirmed) return
    deleteVM(vm.id)
    toast(`VM ${vmName} permanently deleted`, 'bad')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--bad)' }}>Delete {vmName}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div style={{ padding: 14, background: 'var(--bad-soft)', borderRadius: 8, marginBottom: 16 }}>
            <div className="flex gap-2">
              <Icon name="alert" size={18} style={{ color: 'var(--bad)' }} />
              <div>
                <div className="fw-7 text-sm" style={{ color: 'var(--bad)' }}>This action cannot be undone</div>
                <div className="text-xs text-mute mt-1">All data will be permanently deleted. This VM will be removed from your account.</div>
              </div>
            </div>
          </div>
          <div className="field">
            <label>Type the VM name to confirm</label>
            <input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={vmName} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={!isConfirmed} onClick={submit}>
            <Icon name="x" size={12} />Delete VM
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Customer Modal ───────────────────────────────────────────────────────
interface NewCustomerModalProps {
  onClose: () => void
  onPasswordGenerated?: (email: string, tempPassword: string, name: string) => void
}

const NewCustomerModal: React.FC<NewCustomerModalProps> = ({ onClose, onPasswordGenerated }) => {
  const { addCustomerWithAuth } = useCustomerStore()
  const { toast } = useUIStore()
  const [f, setF] = useState({
    legacyId: '',
    name: '',
    company: '',
    email: '',
    phone: '',
    altPhone: '',
    accountType: 'Organization' as 'Individual' | 'Organization',
    address: '',
    city: 'Yangon',
    state: 'Yangon Region',
    postalCode: '11181',
    country: 'Myanmar',
    orgRegNo: '',
    orgType: 'Private Limited',
    orgIndustry: 'Technology',
    orgRepTitle: '',
    orgEmployees: '1-10',
    orgWebsite: '',
    paymentMethod: 'KBZ Pay',
    payerName: '',
    payerPhone: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const submit = async () => {
    setLoading(true)
    try {
      const tempPassword = generateTempPassword()
      await addCustomerWithAuth({
        legacy_id: f.legacyId || undefined,
        name: f.name,
        org_name: f.company,
        email: f.email,
        phone: f.phone,
        alt_phone: f.altPhone,
        account_type: f.accountType,
        address: f.address,
        city: f.city,
        state: f.state,
        postal_code: f.postalCode,
        country: f.country,
        org_reg_no: f.orgRegNo,
        org_type: f.orgType,
        org_industry: f.orgIndustry,
        org_rep_title: f.orgRepTitle,
        org_employees: f.orgEmployees,
        org_website: f.orgWebsite,
        payment_method: f.paymentMethod as any,
        payer_name: f.payerName,
        payer_phone: f.payerPhone,
        kyc_status: 'Approved',
        status: 'Active',
      }, tempPassword)
      if (onPasswordGenerated) {
        onPasswordGenerated(f.email, tempPassword, f.name)
      } else {
        toast(`Customer created. Temporary password: ${tempPassword}`, 'ok')
      }
      onClose()
    } catch (error: any) {
      toast(error.message || 'Failed to create customer', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Add new customer</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            {/* Account Type */}
            <div className="field">
              <label>Account type</label>
              <select value={f.accountType} onChange={e => set('accountType', e.target.value)}>
                <option value="Individual">Individual</option>
                <option value="Organization">Organization</option>
              </select>
            </div>

            {/* Contact Information */}
            <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contact Information</div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label>Contact name</label><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Aung Min Htet" /></div>
              <div className="field"><label>Email</label><input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="contact@company.com" /></div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label>Phone</label><input value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+95 9 ..." /></div>
              <div className="field"><label>Alternate phone</label><input value={f.altPhone} onChange={e => set('altPhone', e.target.value)} placeholder="+95 9 ..." /></div>
            </div>
            <div className="field">
              <label>Legacy ID (optional - for existing customers from previous system)</label>
              <input value={f.legacyId} onChange={e => set('legacyId', e.target.value)} placeholder="e.g., CUST-001" />
              <div className="hint">Only enter a legacy ID if the customer already has one from the previous system</div>
            </div>

            {/* Organization Details */}
            {f.accountType === 'Organization' && (
              <>
                <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Organization Details</div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="field"><label>Company name</label><input value={f.company} onChange={e => set('company', e.target.value)} placeholder="Mandalay Logistics Co., Ltd" /></div>
                  <div className="field"><label>Registration number</label><input value={f.orgRegNo} onChange={e => set('orgRegNo', e.target.value)} placeholder="12345678" /></div>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="field"><label>Organization type</label>
                    <select value={f.orgType} onChange={e => set('orgType', e.target.value)}>
                      <option value="Private Limited">Private Limited</option>
                      <option value="Public Limited">Public Limited</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Sole Proprietorship">Sole Proprietorship</option>
                      <option value="NGO">NGO</option>
                      <option value="Government">Government</option>
                    </select>
                  </div>
                  <div className="field"><label>Industry</label>
                    <select value={f.orgIndustry} onChange={e => set('orgIndustry', e.target.value)}>
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Education">Education</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Retail">Retail</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="field"><label>Representative title</label><input value={f.orgRepTitle} onChange={e => set('orgRepTitle', e.target.value)} placeholder="Managing Director" /></div>
                  <div className="field"><label>Number of employees</label>
                    <select value={f.orgEmployees} onChange={e => set('orgEmployees', e.target.value)}>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                </div>
                <div className="field"><label>Website</label><input value={f.orgWebsite} onChange={e => set('orgWebsite', e.target.value)} placeholder="https://www.company.com" /></div>
              </>
            )}

            {/* Address */}
            <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Address</div>
            <div className="field"><label>Street address</label><input value={f.address} onChange={e => set('address', e.target.value)} placeholder="Building, street, township" /></div>
            <div className="grid-3" style={{ gap: 10 }}>
              <div className="field"><label>City</label><input value={f.city} onChange={e => set('city', e.target.value)} /></div>
              <div className="field"><label>State/Region</label><input value={f.state} onChange={e => set('state', e.target.value)} /></div>
              <div className="field"><label>Postal code</label><input value={f.postalCode} onChange={e => set('postalCode', e.target.value)} /></div>
            </div>
            <div className="field"><label>Country</label><input value={f.country} onChange={e => set('country', e.target.value)} /></div>

            {/* Payment Information */}
            <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment Information</div>
            <div className="field">
              <label>Preferred payment method</label>
              <select value={f.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                <option value="KBZ Pay">KBZ Pay</option>
                <option value="AYA Bank">AYA Bank</option>
                <option value="CB Bank">CB Bank</option>
                <option value="Yoma Bank">Yoma Bank</option>
              </select>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label>Payer name</label><input value={f.payerName} onChange={e => set('payerName', e.target.value)} placeholder="Name on payment account" /></div>
              <div className="field"><label>Payer phone</label><input value={f.payerPhone} onChange={e => set('payerPhone', e.target.value)} placeholder="+95 9 ..." /></div>
            </div>

            <div style={{ padding: 12, background: 'var(--warn-soft)', borderRadius: 6, fontSize: 12, color: 'oklch(0.4 0.13 75)', display: 'flex', gap: 8 }}>
              <Icon name="alert" size={14} />
              <div>Customer will be created with a temporary password. They'll need to change their password on first login. KYC status will be <strong>Auto-approved</strong>.</div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn accent" disabled={!f.name || !f.email || loading} onClick={submit}>
            <Icon name="plus" size={12} />{loading ? 'Creating...' : 'Add customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Temp Password Modal ─────────────────────────────────────────────────────
interface TempPasswordModalProps {
  email: string
  tempPassword: string
  name: string
  onClose: () => void
}

const TempPasswordModal: React.FC<TempPasswordModalProps> = ({ email, tempPassword, name, onClose }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Customer Created Successfully</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--ok-soft)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Icon name="check" size={32} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{name}</h3>
              <p className="text-sm text-mute mt-1">{email}</p>
            </div>

            <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8 }}>
              <div className="text-sm fw-6 mb-2">Temporary Password</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'var(--surface-3)', padding: 12, borderRadius: 6, fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, letterSpacing: 2, textAlign: 'center' }}>
                  {tempPassword}
                </div>
                <button className="btn" onClick={copyToClipboard} style={{ padding: '12px' }}>
                  <Icon name={copied ? "check" : "copy"} size={14} />
                </button>
              </div>
              {copied && <div className="text-xs text-ok mt-2">Password copied to clipboard</div>}
            </div>

            <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 6, fontSize: 12, color: 'var(--info)' }}>
              <div className="flex gap-2">
                <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>Important:</strong> Share this temporary password with the customer. They will need to change their password on first login.
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose} style={{ width: '100%' }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Email Modal ───────────────────────────────────────────────────────────
interface EmailModalProps {
  onClose: () => void
  to?: string
  template?: string
}

const EmailModal: React.FC<EmailModalProps> = ({ onClose, to, template }) => {
  const { toast } = useUIStore()
  const { settings } = useSystemSettingsStore()
  const companyName = settings?.company_name || 'VPS Myanmar'
  const templates: Record<string, { subject: string; body: string }> = {
    receipt: { subject: 'Payment receipt', body: `Hi,\n\nThank you for your payment. Your receipt is attached for your records.\n\nIf you have any questions, please don't hesitate to contact us.\n\n— ${companyName} Team` },
  }
  const [tmpl, setTmpl] = useState(template || 'receipt')
  const [f, setF] = useState({ to: to || '', subject: templates[tmpl].subject, body: templates[tmpl].body })
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Compose email</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="field"><label>To</label><input value={f.to} onChange={e => set('to', e.target.value)} placeholder="customer@email.com" /></div>
            <div className="field"><label>Subject</label><input value={f.subject} onChange={e => set('subject', e.target.value)} /></div>
            <div className="field"><label>Body</label><textarea rows={6} value={f.body} onChange={e => set('body', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Discard</button>
          <button className="btn" onClick={() => { toast('Saved as draft', 'info'); onClose() }}>Save draft</button>
          <button className="btn accent" onClick={() => { toast(`Email sent to ${f.to || 'customer'}`, 'ok'); onClose() }}><Icon name="mail" size={12} />Send</button>
        </div>
      </div>
    </div>
  )
}

// ── Task Detail Modal ───────────────────────────────────────────────────────
interface TaskDetailModalProps {
  taskId: string
  onClose: () => void
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ taskId, onClose }) => {
  const { updateTask } = useTaskStore()
  const { tasks } = useTaskStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const t = tasks.find((x: any) => x.id === taskId)
  if (!t) return null
  const c = customers.find((cust: any) => cust.id === t.customer)

  const [f, setF] = useState({
    assignee: t.assignee || '—',
    priority: t.priority || 'Normal',
    status: t.status,
    internalNotes: (t as any).internalNotes || '',
  })
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const save = () => {
    updateTask(t.id, f)
    toast(`${t.id} updated`, 'ok')
    onClose()
  }

  const WF = [
    { label: 'Submitted', team: 'Customer', icon: 'mail', desc: 'Request received via portal' },
    { label: 'Sales review & KYC', team: 'Sales', icon: 'shield', desc: 'Verify customer & documents' },
    { label: 'KYC approved → notify Eng', team: 'VPS Portal', icon: 'check', desc: 'Provisioning task created' },
    { label: 'System: provision VM', team: 'Engineering', icon: 'server', desc: 'Build VM per specs' },
    { label: 'Network: firewall rules', team: 'Network', icon: 'shield', desc: 'Configure firewall & ports' },
    { label: 'KT: test & credentials', team: 'Engineering', icon: 'key', desc: 'Test VM, upload credentials' },
    { label: 'Handover to customer', team: 'Sales', icon: 'users', desc: 'Notify customer, send credentials' },
  ]
  const wfStage = WF.findIndex(w => w.label.includes(t.status) || t.status === 'Done' ? 6 : 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t.id} · {t.title}</h3>
            <div className="text-xs text-mute mt-1">{c?.company} · {t.type} · {t.priority}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-4">
            {(t.type === 'New' || t.type === 'Upgrade') && (
              <div className="card">
                <div className="card-head">
                  <h3 className="card-title">Provisioning workflow</h3>
                  <span className="pill accent"><span className="dot" />Step {Math.min(wfStage + 1, WF.length)} of {WF.length}</span>
                </div>
                <div className="card-body">
                  <div className="flex col gap-2">
                    {WF.map((w, i) => (
                      <div key={w.label} className="flex center gap-3" style={{ opacity: i <= wfStage ? 1 : 0.4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: i < wfStage ? 'var(--ok)' : i === wfStage ? 'var(--accent)' : 'var(--surface-3)', color: i <= wfStage ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', fontSize: 11 }}>
                          {i < wfStage ? <Icon name="check" size={11} /> : <Icon name={w.icon} size={11} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="fw-6 text-sm">{w.label}</div>
                          <div className="text-xs text-mute">{w.desc} · {w.team}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-head"><h3 className="card-title">Task details</h3></div>
              <div className="card-body">
                <dl className="dl">
                  <dt>Customer</dt><dd>{c?.company}</dd>
                  <dt>Type</dt><dd>{t.type}</dd>
                  <dt>Priority</dt><dd>{t.priority}</dd>
                  <dt>Assignee</dt><dd>{t.assignee}</dd>
                  <dt>Team</dt><dd>{t.team}</dd>
                  <dt>Status</dt><dd>{t.status}</dd>
                  <dt>Created</dt><dd className="tnum">{t.created}</dd>
                </dl>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h3 className="card-title">Customer notes</h3></div>
              <div className="card-body">
                <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{t.notes || 'No notes'}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h3 className="card-title">Internal notes</h3></div>
              <div className="card-body">
                <textarea rows={3} value={f.internalNotes} onChange={e => set('internalNotes', e.target.value)} placeholder="Internal notes..." />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn accent" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  )
}

// ── New Invoice Modal ───────────────────────────────────────────────────────
interface NewInvoiceModalProps {
  onClose: () => void
  presetCustomer?: string
  presetQuote?: any
}

const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({ onClose, presetCustomer, presetQuote }) => {
  const { addInvoice } = useInvoiceStore()
  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()
  const { toast } = useUIStore()
  const [loading, setLoading] = useState(false)

  const [f, setF] = useState({
    customer: presetCustomer || presetQuote?.customer_id || '',
    vm_request_ids: [] as string[],
    addon_request_ids: [] as string[],
    months: 6,
    invoiceDate: new Date().toISOString().slice(0, 10),
    vatRate: 5,
  })

  // Auto-fill from quote if provided
  React.useEffect(() => {
    if (presetQuote) {
      let initialVMRequestIds: string[] = []
      let initialAddonRequestIds: string[] = []
      let initialMonths = 6

      // Use the quote's vm_request_id or addon_request_id
      if (presetQuote.vm_request_id) {
        initialVMRequestIds = [presetQuote.vm_request_id]

        // Get duration from VM request
        const vmRequest = vmRequests.find((r: any) => r.id === presetQuote.vm_request_id)
        if (vmRequest && vmRequest.duration) {
          initialMonths = vmRequest.duration
        }
      }
      
      // Also check for addon_request_id (can coexist with vm_request_id for addon services)
      if ((presetQuote as any).addon_request_id) {
        initialAddonRequestIds = [(presetQuote as any).addon_request_id]
      }

      setF(prev => ({
        ...prev,
        customer: presetCustomer || presetQuote.customer_id || prev.customer,
        vm_request_ids: initialVMRequestIds.length > 0 ? initialVMRequestIds : prev.vm_request_ids,
        addon_request_ids: initialAddonRequestIds.length > 0 ? initialAddonRequestIds : prev.addon_request_ids,
        months: initialMonths
      }))
    }
  }, [presetQuote, presetCustomer, vmRequests])

  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  // Only show the specific VM request from the quote, not all customer requests
  const selectedVMRequests = presetQuote?.vm_request_id
    ? vmRequests.filter((r: any) => r.id === presetQuote.vm_request_id)
    : vmRequests.filter((r: any) => r.customer_id === f.customer)

  // Use quote totals if provided, otherwise calculate from VM request pricing
  const amount = presetQuote
    ? (presetQuote as any).instance_total + (presetQuote as any).public_ip_total + (presetQuote as any).backup_total
    : selectedVMRequests
      .filter((r: any) => f.vm_request_ids.includes(r.id))
      .reduce((a: number, r: any) => {
        const monthlyPrice = r.estimated_monthly_cost || 0
        return a + (monthlyPrice * f.months)
      }, 0)

  const vat = presetQuote ? (presetQuote as any).tax_amount : amount * (f.vatRate / 100)
  const grossAmount = presetQuote ? (presetQuote as any).grand_total : amount + vat
  const discount = presetQuote ? (presetQuote as any).discount_amount : 0
  const netAmount = presetQuote ? (presetQuote as any).net_amount : amount - discount

  const toggle = (id: string) => set('vm_request_ids', f.vm_request_ids.includes(id) ? f.vm_request_ids.filter((x: string) => x !== id) : [...f.vm_request_ids, id])

  const issuedDate = new Date()
  const dueDate = new Date(issuedDate)
  dueDate.setDate(dueDate.getDate() + 7)

  const submit = async () => {
    try {
      setLoading(true)
      const id = await addInvoice({
        customer_id: f.customer,
        vm_request_ids: f.vm_request_ids,
        addon_request_ids: f.addon_request_ids,
        amount,
        vat,
        gross_amount: grossAmount,
        net_amount: netAmount,
        discount,
        issued: issuedDate.toISOString(),
        due: dueDate.toISOString(),
        invoice_date: f.invoiceDate,
        quote_id: presetQuote?.id,
        sales_person: presetQuote?.created_by,
        billing_term: presetQuote ? (presetQuote as any).billing_term : undefined,
        line_items: presetQuote?.line_items || []
      })
      toast(`Invoice ${id} created successfully`, 'ok')
      onClose()
    } catch (error) {
      toast('Failed to create invoice', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Create invoice</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="field"><label>Customer</label>
              {presetQuote ? (
                <div style={{ padding: '8px', background: 'var(--surface-2)', borderRadius: '4px', border: '1px solid var(--line)' }}>
                  {(() => {
                    const customer = customers.find((c: any) => c.id === f.customer)
                    const customerName = customer?.name || customer?.company || customer?.legacy_id || f.customer
                    const orgName = customer?.org_name
                    return orgName ? `${customerName} (${orgName})` : customerName
                  })()}
                </div>
              ) : (
                <select value={f.customer} onChange={e => { set('customer', e.target.value); set('vm_request_ids', []); }}>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{(() => {
                    const customerName = c.name || c.company || c.legacy_id || c.id
                    const orgName = c.org_name
                    return orgName ? `${customerName} (${orgName})` : customerName
                  })()}</option>)}
                </select>
              )}
            </div>
            <div className="field"><label>Billing period</label>
              <select value={f.months} onChange={e => set('months', parseInt(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m} month{m === 1 ? '' : 's'}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>VAT Rate (%)</label>
              <input type="number" value={f.vatRate} onChange={e => set('vatRate', parseFloat(e.target.value) || 0)} style={{ padding: '8px' }} />
            </div>
            {presetQuote ? (
              <>
                <div className="field"><label>Quote Line Items</label>
                  <div className="card" style={{ borderColor: 'var(--line)' }}>
                    <div className="card-body flush" style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {(presetQuote.line_items || []).length === 0 && <div className="empty"><div className="sub">No line items in quote.</div></div>}
                      {(presetQuote.line_items || []).map((item: any, i: number) => (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                          <div className="flex between">
                            <div className="fw-6 text-sm">{item.spec || `Item ${i + 1}`}</div>
                            <div className="tnum text-sm">MMK {formatMMK(item.unit || 0)}</div>
                          </div>
                          <div className="flex between text-xs text-mute mt-1">
                            <div>
                              {item.kind === 'instance' && (
                                <>
                                  {(item.spec?.startsWith('CPFS') || item.spec?.startsWith('CCIS')) ? (
                                    <span>Qty: {item.qty || 1}</span>
                                  ) : (
                                    <>
                                      <span>vCPU: {item.vcpu}</span>
                                      {item.ram && <span> · RAM: {item.ram}GB</span>}
                                      {item.storage && <span> · Storage: {item.storage}GB</span>}
                                      <span> · Qty: {item.qty || 1}</span>
                                    </>
                                  )}
                                </>
                              )}
                              {item.kind === 'backup' && (
                                <>
                                  <span>Storage: {item.storage}GB</span>
                                  <span> · Type: {item.spec}</span>
                                </>
                              )}
                              {item.kind === 'publicIP' && (
                                <span>Public IP</span>
                              )}
                            </div>
                            <div>Term: {item.term || '—'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <div className="card-body">
                    <div className="flex between"><span className="text-mute">Instance Total</span><span className="tnum fw-6">MMK {formatMMK((presetQuote as any).instance_total || 0)}</span></div>
                    <div className="flex between"><span className="text-mute">Public IP Total</span><span className="tnum fw-6">MMK {formatMMK((presetQuote as any).public_ip_total || 0)}</span></div>
                    <div className="flex between"><span className="text-mute">Backup Total</span><span className="tnum fw-6">MMK {formatMMK((presetQuote as any).backup_total || 0)}</span></div>
                    {discount > 0 && <div className="flex between"><span className="text-mute">Discount</span><span className="tnum fw-6">MMK {formatMMK(discount)}</span></div>}
                    <div className="divider" />
                    <div className="flex between"><span className="text-mute">Net Amount</span><span className="tnum fw-6">MMK {formatMMK(netAmount)}</span></div>
                    <div className="flex between"><span className="text-mute">VAT</span><span className="tnum fw-6">MMK {formatMMK(vat)}</span></div>
                    <div className="flex between"><span className="text-mute">Billing Term</span><span className="tnum fw-6">{(presetQuote as any).billing_term || '—'}</span></div>
                    <div className="flex between"><span className="text-mute">Invoice Date</span><input type="date" value={f.invoiceDate} onChange={e => set('invoiceDate', e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--line)', width: 140 }} /></div>
                    <div className="flex between"><span className="text-mute">Due Date</span><span className="tnum fw-6">{dueDate.toISOString().slice(0, 10)}</span></div>
                    <div className="divider" />
                    <div className="flex between"><span className="fw-7">Grand Total</span><span className="tnum fw-7" style={{ fontSize: 16 }}>MMK {formatMMK(grossAmount)}</span></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="field"><label>Include these VM Requests</label>
                <div className="card" style={{ borderColor: 'var(--line)' }}>
                  <div className="card-body flush" style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {selectedVMRequests.length === 0 && <div className="empty"><div className="sub">No VM requests for this customer.</div></div>}
                    {selectedVMRequests.map((r: any) => (
                      <label key={r.id} style={{ display: 'flex', padding: '10px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={f.vm_request_ids.includes(r.id)} onChange={() => toggle(r.id)} />
                        <div style={{ flex: 1 }}>
                          <div className="fw-6 text-sm">{r.hostname || r.legacy_id || r.id}</div>
                          <div className="text-xs text-mute mono">{r.legacy_id || r.id} · {r.task_type || 'new'} · Qty: {r.qty || 1}</div>
                        </div>
                        <div className="tnum text-sm">MMK {formatMMK(r.estimated_monthly_cost || 0)}/mo</div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="card-body">
                <div className="flex between"><span className="text-mute">Duration</span><span className="tnum fw-6">{f.months} month{f.months !== 1 ? 's' : ''}</span></div>
                <div className="flex between"><span className="text-mute">Due date</span><span className="tnum fw-6">{new Date().toISOString().slice(0, 10)}</span></div>
                <div className="divider" />
                <div className="flex between"><span className="text-mute">Subtotal</span><span className="tnum fw-6">MMK {formatMMK(amount)}</span></div>
                <div className="flex between"><span className="text-mute">VAT ({f.vatRate}%)</span><span className="tnum fw-6">MMK {formatMMK(vat)}</span></div>
                <div className="divider" />
                <div className="flex between"><span className="fw-7">Gross Total</span><span className="tnum fw-7" style={{ fontSize: 16 }}>MMK {formatMMK(grossAmount)}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn accent" disabled={loading || (!f.vm_request_ids.length && !f.addon_request_ids.length)} onClick={submit}>
            {loading ? <Icon name="spinner" size={12} /> : <Icon name="plus" size={12} />}
            {loading ? 'Creating...' : 'Create invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Invite Member Modal ─────────────────────────────────────────────────────
interface InviteMemberModalProps {
  onClose: () => void
}

const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ onClose }) => {
  const { addMember } = useTeamStore()
  const { toast } = useUIStore()
  const [f, setF] = useState({ name: '', email: '', role: 'Sales', team: 'Sales' })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const submit = async () => {
    setLoading(true)
    try {
      await addMember(f)
      toast(`Invite sent to ${f.email}`, 'ok')
      onClose()
    } catch (error) {
      toast('Failed to send invite', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Invite team member</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="field"><label>Name</label><input value={f.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="field"><label>Work email</label><input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="@vpsmm.co" /></div>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label>Role</label><select value={f.role} onChange={e => set('role', e.target.value)}><option>Admin</option><option>Sales</option><option>Engineer</option><option>Finance</option></select></div>
              <div className="field"><label>Team</label><select value={f.team} onChange={e => set('team', e.target.value)}><option>Sales</option><option>Provisioning</option><option>Network</option><option>Finance</option><option>Management</option></select></div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" disabled={!f.name || !f.email || loading} onClick={submit}><Icon name="mail" size={12} />{loading ? 'Sending...' : 'Send invite'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm Modal ───────────────────────────────────────────────────────────
interface ConfirmModalProps {
  onClose: () => void
  title?: string
  message?: string
  onConfirm?: () => void
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ onClose, title = 'Confirm action', message, onConfirm }) => {
  const submit = () => {
    onConfirm?.()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="text-sm">{message}</div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" onClick={submit}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

export { NewVMModal, RenewModal, SpecModal, TerminateModal, DeleteModal, NewTaskModal, TaskDetailModal, NewCustomerModal, TempPasswordModal, EmailModal, NewInvoiceModal, InviteMemberModal, ConfirmModal }
