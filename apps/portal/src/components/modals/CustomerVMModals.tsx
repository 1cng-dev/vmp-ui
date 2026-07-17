// Customer VM action modals — Renew, Upgrade, Change Plan (IaaS style)

import React, { useState } from 'react'
import useTaskStore from '../../store/taskStore'
import useCustomerStore from '../../store/customerStore'
import useTicketStore from '../../store/ticketStore'
import useUIStore from '../../store/uiStore'
import { createAlert } from '../../services/notificationService'
import Icon from '../../lib/icons'
import { formatMMK } from '../ui/ui'
import { supabase } from '@/lib/supabase'

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
}

interface IaaSCardProps {
  selected: boolean
  onClick: () => void
  padding?: number
  children: React.ReactNode
}

const IaaSCard: React.FC<IaaSCardProps> = ({ selected, onClick, padding = 14, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: `${padding}px`,
      textAlign: 'left',
      background: selected ? 'var(--accent-soft)' : 'var(--surface)',
      border: '1.5px solid',
      borderColor: selected ? 'var(--accent)' : 'var(--line)',
      borderRadius: 10,
      cursor: 'pointer',
      fontFamily: 'inherit',
      color: 'var(--ink)',
      boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'none',
      transition: 'all 0.15s',
    }}
  >
    {children}
  </button>
)

// ── Renew (IaaS-style) ────────────────────────────────────────────────────
interface CustRenewModalProps {
  vm: VM
  onClose: () => void
  me: any
}

const CustRenewModal: React.FC<CustRenewModalProps> = ({ vm, onClose, me }) => {
  const { addTask } = useTaskStore()
  const { toast } = useUIStore()
  const [months, setMonths] = useState(12)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('12')
  const periods = [1, 3, 6, 12]

  const formatDate = (dateStr: string) => {
    if (dateStr === '—') return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const newExpiry = (() => {
    const d = new Date(vm.expiry === '—' ? Date.now() : vm.expiry)
    d.setMonth(d.getMonth() + months)
    return formatDate(d.toISOString())
  })()

  const currentExpiry = formatDate(vm.expiry)
  const displayId = (vm as any).legacy_id || vm.id

  const handleCustomToggle = () => {
    setCustomMode(!customMode)
    if (!customMode) {
      setCustomValue(String(months))
    }
  }

  const handleCustomChange = (value: string) => {
    setCustomValue(value)
    const num = parseFloat(value)
    if (num && num > 0) {
      setMonths(num)
    }
  }

  const submit = async () => {
    if (!me) {
      toast('Customer information not found', 'error')
      return
    }

    try {
      // Create VM request with task_type='renewal'
      const { data: insertedData, error } = await supabase.from('vm_requests').insert({
        customer_id: me.id,
        task_type: 'Renewal',
        request_type: 'paid',
        hostname: (vm as any).hostname || vm.name,
        purpose: `Renew for ${(vm as any).hostname || vm.name}`,
        vcpu: vm.vcpu,
        ram_gb: (vm as any).ram_gb || vm.ram,
        storage: (vm as any).storage_gb || vm.storage,
        qty: 1,
        duration: months,
        sizing: (vm as any).sizing || 'Standard',
        storage_partitions: (vm as any).storage_partitions || '',
        os_name: (vm as any).os_name || 'Linux',
        os_version: (vm as any).os_version || '',
        custom_os_name: (vm as any).custom_os_name || null,
        custom_os_version: (vm as any).custom_os_version || null,
        zone: (vm as any).zone || 'yangon-dc1',
        nics: (vm as any).nics || [],
        public_ip_required: (vm as any).public_ip_required !== undefined ? (vm as any).public_ip_required : true,
        firewall_ports: (vm as any).firewall_ports || [],
        backup_enabled: (vm as any).backup_enabled || false,
        backup_type: (vm as any).backup_type || 'weekly',
        notes: `Renewal request for ${months} month${months > 1 ? 's' : ''}. Current expiry: ${vm.expiry}, New expiry: ${newExpiry}`,
      }).select().single()

      if (error) throw error

      // Create alert for team roles (customer_id = NULL so customer doesn't see it)
      await createAlert({
        sev: 'info',
        title: 'Renewal Request',
        body: `Renewal Request for ${(vm as any).hostname || vm.name} (${months} month${months > 1 ? 's' : ''})`,
        type: 'vm',
        related_entity_id: insertedData.id,
        related_entity_type: 'vm_request',
        actor_id: me.id,
        actor_name: me.name || 'Customer',
        customer_id: null, // NULL so team roles see it, customer doesn't
        metadata: {
          hostname: (vm as any).hostname || vm.name,
          request_type: 'renewal',
          vcpu: vm.vcpu,
          ram_gb: (vm as any).ram_gb || vm.ram,
          customer_id: me.id,
          task_type: 'Renewal'
        }
      })

      // Also create task for ops visibility
      addTask({
        title: `Renewal — ${(vm as any).hostname || vm.name} (${months} month${months > 1 ? 's' : ''})`,
        customer: me.id, vm: vm.id, type: 'Renewal', priority: 'Normal', status: 'Pending', team: 'Sales',
        notes: `Customer-initiated renewal request for ${months} month${months > 1 ? 's' : ''}. Current expiry: ${vm.expiry}, New expiry: ${newExpiry}`,
      })

      toast('Renewal request sent to Sales', 'ok')
      onClose()
    } catch (err) {
      console.error('Error creating renewal request:', err)
      toast('Failed to submit renewal request', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Renew {vm.name}</h3>
            <div className="text-xs text-mute mt-1 mono">{displayId} · expires {currentExpiry}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="card" style={{ borderColor: 'var(--line)' }}>
            <div className="card-body" style={{ padding: 14 }}>
              <div className="flex center between mb-2">
                <div className="flex center gap-2">
                  <Icon name="clock" size={13} />
                  <span className="fw-7 text-sm">Renewal period</span>
                </div>
                <div className="text-xs text-mute">
                  Current expiry: <span className="tnum fw-6">{currentExpiry}</span>
                  <span> → </span>
                  <span className="tnum fw-7" style={{ color: 'var(--accent-strong)' }}>{newExpiry}</span>
                </div>
              </div>
              <div className="flex gap-1 wrap">
                {periods.map(m => (
                  <button key={m}
                    className={`filter-chip ${!customMode && months === m ? 'active' : ''}`}
                    onClick={() => { setMonths(m); setCustomMode(false); }}>
                    {m} month{m > 1 ? 's' : ''}
                  </button>
                ))}
                {customMode ? (
                  <>
                    <input
                      type="number"
                      value={customValue}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="Enter months"
                      min="1"
                      style={{ padding: '6px 10px', border: '1px solid var(--accent)', borderRadius: 6, width: 100, fontSize: 12 }}
                    />
                    <span className="text-xs text-mute" style={{ alignSelf: 'center' }}>months</span>
                    <button
                      className="btn sm ghost"
                      onClick={() => { setCustomMode(false); setMonths(12) }}
                      style={{ padding: '6px 10px', fontSize: 11 }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="filter-chip"
                    onClick={handleCustomToggle}>
                    <Icon name="plus" size={11} /> Custom
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" onClick={submit}><Icon name="check" size={12} />Submit renewal request</button>
        </div>
      </div>
    </div>
  )
}

// ── Upgrade VM (CPU / RAM / Storage / Bandwidth) ──────────────────────────
interface CustUpgradeModalProps {
  vm: VM
  onClose: () => void
  me: any
  vmRequestId?: string // Optional: if upgrading an existing VM request
}

const CustUpgradeModal: React.FC<CustUpgradeModalProps> = ({ vm, onClose, me }) => {
  const { addTask } = useTaskStore()
  const { toast } = useUIStore()
  const [spec, setSpec] = useState({ vcpu: vm.vcpu, ram: (vm as any).ram_gb || vm.ram, storage: (vm as any).storage_gb || vm.storage })
  const [backupEnabled, setBackupEnabled] = useState((vm as any).backup_enabled || false)
  const [backupType, setBackupType] = useState(() => (vm as any).backup_type || 'daily')
  const [errors, setErrors] = useState({ vcpu: '', ram: '', storage: '' })

  const currentVcpu = vm.vcpu
  const currentRam = (vm as any).ram_gb || vm.ram
  const currentStorage = (vm as any).storage_gb || vm.storage

  const validateField = (field: 'vcpu' | 'ram' | 'storage', value: number) => {
    const current = field === 'vcpu' ? currentVcpu : field === 'ram' ? currentRam : currentStorage
    if (value < current) {
      setErrors(prev => ({ ...prev, [field]: `${field} cannot be less than current (${current})` }))
      return false
    }
    setErrors(prev => ({ ...prev, [field]: '' }))
    return true
  }

  const handleSpecChange = (field: 'vcpu' | 'ram' | 'storage', value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      setSpec(prev => ({ ...prev, [field]: num }))
      validateField(field, num)
    }
  }

  const submit = async () => {
    if (!me) {
      toast('Customer information not found', 'error')
      return
    }

    // Validate all fields
    const isValid = validateField('vcpu', spec.vcpu) && validateField('ram', spec.ram) && validateField('storage', spec.storage)
    if (!isValid) {
      toast('Please fix validation errors before submitting', 'error')
      return
    }

    try {
      // Fetch original VM request to get all original data
      let originalRequest = null
      if ((vm as any).vm_request_id) {
        const { data } = await supabase.from('vm_requests').select('*').eq('id', (vm as any).vm_request_id).single()
        originalRequest = data
      } else {
        // Try to find original request by hostname (strip suffix for qty>1 cases)
        const baseHostname = ((vm as any).hostname || vm.name).replace(/-\d+$/, '')
        const { data } = await supabase.from('vm_requests').select('*').eq('hostname', baseHostname).order('created_at', { ascending: false }).limit(1).single()
        originalRequest = data
      }

      if (!originalRequest) {
        toast('Could not find original VM request data', 'error')
        return
      }

      // Use current VM's actual hostname (e.g., my-web-app-2) instead of original base hostname
      const currentHostname = (vm as any).hostname || vm.name

      // Check if only backup is changed (compare with correct property names)
      const currentVcpu = vm.vcpu
      const currentRam = (vm as any).ram_gb || vm.ram
      const currentStorage = (vm as any).storage_gb || vm.storage
      const specChanged = spec.vcpu !== currentVcpu || spec.ram !== currentRam || spec.storage !== currentStorage
      const backupChanged = backupEnabled !== (vm as any).backup_enabled || (backupEnabled && backupType !== (vm as any).backup_type)

      // Set purpose based on what changed
      let purpose: string
      if (specChanged && backupChanged) {
        purpose = `Change Plan and Backup service for ${currentHostname}`
      } else if (specChanged) {
        purpose = `Change Plan for ${currentHostname}`
      } else {
        purpose = `Backup service ${backupEnabled ? 'enable' : 'disable'} for ${currentHostname}`
      }

      // Create VM request with task_type='change-plan' using all original data, only changing upgrade fields
      const requestData: any = {
        customer_id: me.id,
        task_type: 'change-plan',
        request_type: originalRequest.request_type || 'paid',
        hostname: currentHostname,
        purpose: purpose,
        vcpu: spec.vcpu,
        ram_gb: spec.ram,
        storage: spec.storage,
        qty: 1, // Upgrade is always for a single VM
        duration: originalRequest.duration || null,
        sizing: originalRequest.sizing || 'Standard',
        storage_partitions: originalRequest.storage_partitions || '',
        os_name: originalRequest.os_name || 'Linux',
        os_version: originalRequest.os_version || '',
        spec_changed: specChanged,
        backup_changed: backupChanged,
        custom_os_name: originalRequest.custom_os_name || null,
        custom_os_version: originalRequest.custom_os_version || null,
        zone: originalRequest.zone || 'yangon-dc1',
        nics: originalRequest.nics || [],
        public_ip_required: originalRequest.public_ip_required !== undefined ? originalRequest.public_ip_required : true,
        firewall_ports: originalRequest.firewall_ports || [],
        backup_enabled: backupEnabled,
        backup_type: backupType,
        notes: `${originalRequest.notes || ''}\n\n${specChanged && backupChanged
          ? `Change Plan from: ${vm.vcpu} vCPU · ${(vm as any).ram_gb || vm.ram} GB RAM · ${(vm as any).storage_gb || vm.storage} GB storage\nTo: ${spec.vcpu} vCPU · ${spec.ram} GB RAM · ${spec.storage} GB storage\nBackup: ${backupEnabled ? `${backupType === 'daily' ? 'Daily' : 'Weekly'}` : 'No'}`
          : specChanged
          ? `Change Plan from: ${vm.vcpu} vCPU · ${(vm as any).ram_gb || vm.ram} GB RAM · ${(vm as any).storage_gb || vm.storage} GB storage\nTo: ${spec.vcpu} vCPU · ${spec.ram} GB RAM · ${spec.storage} GB storage`
          : `Backup service ${backupEnabled ? 'enabled' : 'disabled'} (${backupType === 'daily' ? 'Daily' : 'Weekly'})`
          }`,
      }

      const { data: insertedData, error } = await supabase.from('vm_requests').insert(requestData).select().single()

      if (error) throw error

      // Create alert for team roles (customer_id = NULL so customer doesn't see it)
      await createAlert({
        sev: 'info',
        title: 'Change Plan Request',
        body: `Change Plan Request for ${currentHostname} (${spec.vcpu} vCPU, ${spec.ram}GB RAM)`,
        type: 'vm',
        related_entity_id: insertedData.id,
        related_entity_type: 'vm_request',
        actor_id: me.id,
        actor_name: me.name || 'Customer',
        customer_id: null, // NULL so team roles see it, customer doesn't
        metadata: {
          hostname: currentHostname,
          request_type: 'change-plan',
          vcpu: spec.vcpu,
          ram_gb: spec.ram,
          customer_id: me.id,
          task_type: 'change-plan'
        }
      })

      // Also create task for ops visibility
      addTask({
        title: specChanged
          ? `Change Plan — ${currentHostname} (${vm.vcpu}/${(vm as any).ram_gb || vm.ram}/${(vm as any).storage_gb || vm.storage} → ${spec.vcpu}/${spec.ram}/${spec.storage})`
          : `Backup ${backupEnabled ? 'enable' : 'disable'} — ${currentHostname}`,
        customer: me.id, vm: vm.id, type: 'Change Plan', priority: 'Normal', status: 'Pending', team: 'Sales',
        subscription: '—',
        assignee: (me as any)?.salesperson || '—',
        notes: `Customer-initiated ${specChanged ? 'change plan' : 'backup service'} request via portal.
${specChanged ? `Current: ${vm.vcpu} vCPU · ${(vm as any).ram_gb || vm.ram} GB RAM · ${(vm as any).storage_gb || vm.storage} GB
Requested: ${spec.vcpu} vCPU · ${spec.ram} GB RAM · ${spec.storage} GB` : ''}
${backupChanged ? `Backup: ${backupEnabled ? `${backupType === 'daily' ? 'Daily' : 'Weekly'}` : 'No'}` : ''}`,
      })

      toast('Upgrade request sent to Sales', 'ok')
      onClose()
    } catch (err) {
      console.error('Error creating upgrade request:', err)
      toast('Failed to submit upgrade request', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Change Plan {vm.name}</h3>
            <div className="text-xs text-mute mt-1">Pick higher spec — downgrades require sales approval</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="field">
                <label>vCPU</label>
                <input
                  type="number"
                  value={spec.vcpu}
                  onChange={(e) => handleSpecChange('vcpu', e.target.value)}
                  min={currentVcpu}
                  step={1}
                />
                <div className="text-xs text-mute mt-1">Current: {currentVcpu}</div>
                {errors.vcpu && <div className="text-xs" style={{ color: 'var(--bad)', marginTop: 4 }}>{errors.vcpu}</div>}
              </div>
              <div className="field">
                <label>RAM (GB)</label>
                <input
                  type="number"
                  value={spec.ram}
                  onChange={(e) => handleSpecChange('ram', e.target.value)}
                  min={currentRam}
                  step={1}
                />
                <div className="text-xs text-mute mt-1">Current: {currentRam}</div>
                {errors.ram && <div className="text-xs" style={{ color: 'var(--bad)', marginTop: 4 }}>{errors.ram}</div>}
              </div>
              <div className="field">
                <label>Storage (GB)</label>
                <input
                  type="number"
                  value={spec.storage}
                  onChange={(e) => handleSpecChange('storage', e.target.value)}
                  min={currentStorage}
                  step={10}
                />
                <div className="text-xs text-mute mt-1">Current: {currentStorage}</div>
                {errors.storage && <div className="text-xs" style={{ color: 'var(--bad)', marginTop: 4 }}>{errors.storage}</div>}
              </div>
            </div>

            {/* Backup service */}
            <div className="card" style={{ borderColor: 'var(--line)' }}>
              <div className="card-head">
                <h3 className="card-title">Backup service</h3>
                <span className={`toggle ${backupEnabled ? 'on' : ''}`} onClick={() => setBackupEnabled(!backupEnabled)} />
              </div>
              {backupEnabled && (
                <div className="card-body">
                  <div className="text-xs text-mute fw-6 mb-3" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Backup Options <span style={{ color: 'var(--bad)' }}>*</span></div>
                  <div className="flex col gap-2">
                    <label className="flex center gap-2" style={{ cursor: 'pointer', padding: 12, background: backupType === 'daily' ? 'var(--accent-soft)' : 'var(--surface)', border: backupType === 'daily' ? '1.5px solid var(--accent)' : '1px solid var(--line)', borderRadius: 8 }}>
                      <input
                        type="radio"
                        name="backupType"
                        value="daily"
                        checked={backupType === 'daily'}
                        onChange={() => setBackupType('daily')}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div className="fw-6 text-sm">Daily Backup</div>
                        <div className="text-xs text-mute">Daily Backups with 7 days Retention</div>
                      </div>
                    </label>
                    <label className="flex center gap-2" style={{ cursor: 'pointer', padding: 12, background: backupType === 'weekly' ? 'var(--accent-soft)' : 'var(--surface)', border: backupType === 'weekly' ? '1.5px solid var(--accent)' : '1px solid var(--line)', borderRadius: 8 }}>
                      <input
                        type="radio"
                        name="backupType"
                        value="weekly"
                        checked={backupType === 'weekly'}
                        onChange={() => setBackupType('weekly')}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div className="fw-6 text-sm">Weekly Backup</div>
                        <div className="text-xs text-mute">Weekly Backup with 4 weeks Retention</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" disabled={spec.vcpu === vm.vcpu && spec.ram === vm.ram && spec.storage === vm.storage && !backupEnabled} onClick={submit}>
            <Icon name="arrow-up" size={12} />Submit upgrade request
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Change Plan ───────────────────────────────────────────────────────────
interface CustChangePlanModalProps {
  vm: VM
  onClose: () => void
}

const CustChangePlanModal: React.FC<CustChangePlanModalProps> = ({ vm, onClose }) => {
  const { addTask } = useTaskStore()
  const { customers } = useCustomerStore()
  const { toast } = useUIStore()
  const me = customers.find((c: any) => c.id === vm.customer)

  const plans = [
    { id: 'starter', label: 'Starter', vcpu: 2, ram: 4, storage: 50, price: 90000, desc: 'Small services, dev work' },
    { id: 'standard', label: 'Standard', vcpu: 4, ram: 8, storage: 100, price: 140000, desc: 'Web apps, staging' },
    { id: 'business', label: 'Business', vcpu: 4, ram: 16, storage: 200, price: 180000, desc: 'Production workloads' },
    { id: 'performance', label: 'Performance', vcpu: 8, ram: 32, storage: 500, price: 280000, desc: 'Heavy traffic, databases' },
    { id: 'enterprise', label: 'Enterprise', vcpu: 16, ram: 64, storage: 1000, price: 520000, desc: 'Mission-critical' },
  ]

  const currentPlan = plans.find(p => p.vcpu === vm.vcpu && p.ram === vm.ram && p.storage === vm.storage) || { id: 'custom', label: 'Custom', vcpu: vm.vcpu, ram: vm.ram, storage: vm.storage, price: vm.priceMonth }
  const [picked, setPicked] = useState(currentPlan.id === 'custom' ? 'business' : currentPlan.id)

  const target = plans.find(p => p.id === picked)
  const diff = (target?.price || 0) - vm.priceMonth
  const direction = diff > 0 ? 'Upgrade' : diff < 0 ? 'Downgrade' : 'Switch'

  const submit = () => {
    if (!target) return
    addTask({
      title: `Plan change — ${vm.name} (${currentPlan.label} → ${target.label})`,
      customer: vm.customer, vm: vm.id, type: 'Upgrade', priority: 'Normal', status: 'Pending', team: 'Sales',
      subscription: '—',
      assignee: (me as any)?.salesperson || '—',
      notes: `Customer-initiated plan change via portal.
From: ${currentPlan.label} (${vm.vcpu}c / ${vm.ram}GB / ${vm.storage}GB) — MMK ${formatMMK(vm.priceMonth)}/mo
To: ${target.label} (${target.vcpu}c / ${target.ram}GB / ${target.storage}GB) — MMK ${formatMMK(target.price)}/mo
Direction: ${direction}
Cost diff: ${diff >= 0 ? '+' : ''}MMK ${formatMMK(Math.abs(diff))}/mo`,
    })
    toast(`${direction} request sent to Sales`, 'ok')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Change plan — {vm.name}</h3>
            <div className="text-xs text-mute mt-1">Currently on <strong>{currentPlan.label}</strong> · MMK {formatMMK(vm.priceMonth)}/mo</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {plans.map(p => {
              const isCurrent = p.id === currentPlan.id
              return (
                <IaaSCard key={p.id} selected={picked === p.id} onClick={() => setPicked(p.id)} padding={14}>
                  <div className="flex center between mb-2">
                    <div>
                      <div className="flex center gap-2">
                        <span className="fw-7 text-sm">{p.label}</span>
                        {isCurrent && <span className="pill subtle" style={{ fontSize: 10 }}>Current</span>}
                      </div>
                      <div className="text-xs text-mute mt-1">{p.desc}</div>
                    </div>
                    <div className="right">
                      <div className="tnum fw-7" style={{ fontSize: 14 }}>MMK {formatMMK(p.price)}</div>
                      <div className="text-xs text-mute">/month</div>
                    </div>
                  </div>
                  <div className="divider" style={{ margin: '8px 0' }} />
                  <div className="flex between text-xs">
                    <span><Icon name="cpu" size={10} /> <span className="tnum fw-6">{p.vcpu}</span>c</span>
                    <span><Icon name="database" size={10} /> <span className="tnum fw-6">{p.ram}</span>GB</span>
                    <span><Icon name="box" size={10} /> <span className="tnum fw-6">{p.storage}</span>GB</span>
                  </div>
                </IaaSCard>
              )
            })}
          </div>

          {target && target.id !== currentPlan.id && (
            <div style={{ marginTop: 16, padding: 14, background: diff > 0 ? 'var(--bad-soft)' : 'var(--ok-soft)', borderRadius: 8 }}>
              <div className="flex center between">
                <span className="fw-7 text-sm" style={{ color: diff > 0 ? 'var(--bad)' : 'var(--ok)' }}>{direction} to {target.label}</span>
                <span className="tnum fw-7" style={{ fontSize: 15, color: diff > 0 ? 'var(--bad)' : 'var(--ok)' }}>{diff > 0 ? '+' : '−'}MMK {formatMMK(Math.abs(diff))}/mo</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" disabled={!target || target.id === currentPlan.id} onClick={submit}>
            <Icon name="check" size={12} />Submit {direction.toLowerCase()} request
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Convert to Paid Modal ──────────────────────────────────────────────────────
interface CustConvertToPaidModalProps {
  vm: VM
  onClose: () => void
}

const CustConvertToPaidModal: React.FC<CustConvertToPaidModalProps> = ({ vm, onClose }) => {
  const { toast } = useUIStore()
  const { customers } = useCustomerStore()
  const { addTask } = useTaskStore()
  const me = customers.find((c: any) => c.id === (vm as any).customer_id)

  const [duration, setDuration] = useState(12)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('12')

  const getDurationLabel = (months: number) => {
    const labels: Record<number, string> = {
      1: 'Monthly',
      3: 'Quarterly',
      6: 'Half Yearly',
      12: 'Yearly'
    }
    return labels[months] || `${months} month${months > 1 ? 's' : ''}`
  }

  const handleCustomToggle = () => {
    setCustomMode(!customMode)
    if (!customMode) {
      setCustomValue(String(duration))
    }
  }

  const handleCustomChange = (value: string) => {
    setCustomValue(value)
    const num = parseFloat(value)
    if (num && num > 0) {
      setDuration(num)
    }
  }

  const submit = async () => {
    if (!me) {
      toast('Customer information not found', 'error')
      return
    }

    try {
      // Create VM request for conversion with task_type='New' and request_type='paid'
      const { data: insertedData, error } = await supabase.from('vm_requests').insert({
        customer_id: me.id,
        task_type: 'New',
        request_type: 'paid',
        hostname: (vm as any).hostname || vm.name,
        purpose: `Convert trial to paid for ${(vm as any).hostname || vm.name}`,
        vcpu: vm.vcpu,
        ram_gb: (vm as any).ram_gb || vm.ram,
        storage: (vm as any).storage_gb || vm.storage,
        qty: 1,
        duration: duration,
        sizing: (vm as any).sizing || 'Standard',
        storage_partitions: (vm as any).storage_partitions || '',
        os_name: (vm as any).os_name || 'Linux',
        os_version: (vm as any).os_version || '',
        zone: (vm as any).zone || 'yangon-dc1',
        nics: (vm as any).nics || [],
        public_ip_required: (vm as any).public_ip_required ?? true,
        firewall_ports: (vm as any).firewall_ports || [],
        backup_enabled: (vm as any).backup_enabled || false,
        notes: `Trial to paid conversion for VM: ${vm.id}`,
      }).select().single()

      if (error) throw error

      // Create alert for team roles (customer_id = NULL so customer doesn't see it)
      await createAlert({
        sev: 'info',
        title: 'Trial to Paid Conversion',
        body: `Trial to Paid Conversion for ${(vm as any).hostname || vm.name} (${getDurationLabel(duration)})`,
        type: 'vm',
        related_entity_id: insertedData.id,
        related_entity_type: 'vm_request',
        actor_id: me.id,
        actor_name: me.name || 'Customer',
        customer_id: null, // NULL so team roles see it, customer doesn't
        metadata: {
          hostname: (vm as any).hostname || vm.name,
          request_type: 'trial-to-paid',
          vcpu: vm.vcpu,
          ram_gb: (vm as any).ram_gb || vm.ram,
          customer_id: me.id,
          task_type: 'New',
          duration: duration
        }
      })

      // Create task for ops visibility
      addTask({
        id: crypto.randomUUID(),
        title: `Convert trial to paid - ${(vm as any).hostname || vm.name}`,
        customer: me.org_name || me.name,
        status: 'Pending',
        priority: 'Normal',
        team: 'Sales',
        assignee: '—',
        created: new Date().toISOString().slice(0, 10),
        notes: `Duration: ${getDurationLabel(duration)}`,
        vm_id: vm.id,
      })

      toast('Trial to paid conversion request submitted', 'ok')
      onClose()
    } catch (error: any) {
      toast('Failed to submit conversion request: ' + error.message, 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Convert to Paid — {(vm as any).hostname || vm.name}</h3>
            <div className="text-xs text-mute mt-1">Convert your trial VM to a paid subscription</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Billing Term <span style={{ color: 'var(--bad)' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[1, 3, 6, 12].map(months => (
                <button
                  key={months}
                  className={`filter-chip ${!customMode && duration === months ? 'active' : ''}`}
                  onClick={() => { setDuration(months); setCustomMode(false); }}
                >
                  {getDurationLabel(months)}
                </button>
              ))}
              {customMode ? (
                <>
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => handleCustomChange(e.target.value)}
                    placeholder="Enter months"
                    min="1"
                    style={{ padding: '6px 10px', border: '1px solid var(--accent)', borderRadius: 6, width: 100, fontSize: 12 }}
                  />
                  <span className="text-xs text-mute" style={{ alignSelf: 'center' }}>months</span>
                  <button
                    className="btn sm ghost"
                    onClick={() => { setCustomMode(false); setDuration(12) }}
                    style={{ padding: '6px 10px', fontSize: 11 }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="filter-chip"
                  onClick={handleCustomToggle}>
                  <Icon name="plus" size={11} /> Custom
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>
            <Icon name="check" size={12} />Submit Conversion Request
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Support ticket modal (legacy — kept for back-compat) ─────────────────
interface SupportTicketModalProps {
  onClose: () => void
}

const SupportTicketModal: React.FC<SupportTicketModalProps> = ({ onClose }) => {
  const { addTicket } = useTicketStore()
  const { customers } = useCustomerStore()
  const me = customers.find(c => c.id === 'C-1043')
  const [f, setF] = useState({ subject: '', priority: 'Normal', body: '' })
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-head"><h3 style={{ margin: 0 }}>New support ticket</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button></div>
        <div className="modal-body">
          <div className="flex col gap-3">
            <div className="field"><label>Subject</label><input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></div>
            <div className="field"><label>Priority</label>
              <div className="flex gap-2">
                {['Low', 'Normal', 'Urgent'].map(p => <button key={p} className={`filter-chip ${f.priority === p ? 'active' : ''}`} onClick={() => setF({ ...f, priority: p })}>{p}</button>)}
              </div>
            </div>
            <div className="field"><label>Describe the issue</label><textarea rows={6} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" disabled={!f.subject || !f.body} onClick={() => { if (me) addTicket({ ...f, customer: me.id }); onClose() }}>Submit ticket</button>
        </div>
      </div>
    </div>
  )
}

// ── Customer VM Detail-only modal (legacy compat) ─────────────────────────
interface CustVMModalProps {
  vm: VM
  onClose: () => void
}

const CustVMModal: React.FC<CustVMModalProps> = ({ vm, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h3 style={{ margin: 0 }}>{vm.name}</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button></div>
      <div className="modal-body"><div className="text-sm">Open the full VM detail page for control actions.</div></div>
      <div className="modal-foot"><button className="btn primary" onClick={onClose}>Close</button></div>
    </div>
  </div>
)

export { CustRenewModal, CustUpgradeModal, CustChangePlanModal, CustConvertToPaidModal, SupportTicketModal, CustVMModal }
