// Customer VM action modals — Renew, Upgrade, Change Plan (IaaS style)

import React, { useState, useEffect } from 'react'
import useTaskStore from '../../store/taskStore'
import useCustomerStore from '../../store/customerStore'
import useTicketStore from '../../store/ticketStore'
import useUIStore from '../../store/uiStore'
import useActivityStore from '../../store/activityStore'
import { useAddonServiceStore } from '../../store/addonServiceStore'
import useAddonRequestStore from '../../store/addonRequestStore'
import { createAlert } from '../../services/notificationService'
import { sendVMRequestEmail } from '../../services/emailService'
import { getVMDisks } from '../../store/vmStore'
import Icon from '../../lib/icons'
import { formatMMK } from '../ui/ui'
import { supabase } from '@/lib/supabase'
import type { VMDisk, RequestedDiskChange } from '../../types'

// Helper to compute remaining billing term from VM expiry (same logic as QuotesView / TaskDrawer)
const formatRemainingTerm = (expiry: string | Date): string => {
  const today = new Date()
  const expiryDate = new Date(expiry)

  if (expiryDate <= today) {
    return 'Expired'
  }

  let months = expiryDate.getMonth() - today.getMonth()
  let years = expiryDate.getFullYear() - today.getFullYear()
  let days = expiryDate.getDate() - today.getDate()

  if (days < 0) {
    months--
    const prevMonth = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), 0)
    days += prevMonth.getDate()
  }

  if (months < 0) {
    years--
    months += 12
  }

  const totalMonths = years * 12 + months

  if (days > 28) {
    const extraMonths = Math.floor(days / 30)
    const finalMonths = totalMonths + extraMonths
    const finalDays = days % 30
    if (finalDays > 0) {
      return `${finalMonths} month${finalMonths > 1 ? 's' : ''} ${finalDays} day${finalDays > 1 ? 's' : ''}`
    }
    return `${finalMonths} month${finalMonths > 1 ? 's' : ''}`
  }

  if (totalMonths > 0 && days > 0) {
    return `${totalMonths} month${totalMonths > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`
  }
  if (totalMonths > 0) {
    return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  }
  return `${days} day${days > 1 ? 's' : ''}`
}

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
  const { getAddonServicesForVM } = useAddonServiceStore()
  const { createAddonRequest } = useAddonRequestStore()
  const { toast } = useUIStore()
  const [months, setMonths] = useState(12)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('12')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const periods = [1, 3, 6, 12]

  // Get existing add-on services for this VM
  const existingAddons = getAddonServicesForVM(vm.id)
  const hasExistingAddons = existingAddons.length > 0

  // Check which add-ons exist on this VM
  const hasCpfs = existingAddons.some((a: any) => a.cpfs_enabled)
  const hasCcis = existingAddons.some((a: any) => a.ccis_enabled)

  // Add-on service selection state
  const [selectedAddons, setSelectedAddons] = useState<{ cpfs: boolean; ccis: boolean }>({
    cpfs: hasCpfs,
    ccis: hasCcis
  })
  const [cpfsPackage, setCpfsPackage] = useState<'standard' | 'premium'>(
    (existingAddons.find((a: any) => a.cpfs_enabled)?.cpfs_package as 'standard' | 'premium') || 'standard'
  )
  const [ccisPackage, setCcisPackage] = useState<'basic' | 'standard' | 'professional' | 'enterprise'>(
    (existingAddons.find((a: any) => a.ccis_enabled)?.ccis_package as 'basic' | 'standard' | 'professional' | 'enterprise') || 'standard'
  )

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

    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      // Create VM request with task_type='renewal'
      const { data: insertedData, error } = await supabase.from('vm_requests').insert({
        customer_id: me.id,
        task_type: 'Renewal',
        request_type: 'paid',
        vm_id: vm.id,
        hostname: (vm as any).hostname || vm.name,
        purpose: `Renew for ${(vm as any).hostname || vm.name}`,
        vcpu: vm.vcpu,
        ram_gb: (vm as any).ram_gb || vm.ram,
        storage: (vm as any).storage_gb || vm.storage,
        qty: 1,
        duration: `${months} month${months > 1 ? 's' : ''}`,
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
        firewall_outbound_allow_all: (vm as any).firewall_outbound_allow_all !== undefined ? (vm as any).firewall_outbound_allow_all : true,
        firewall_outbound_custom_ports: (vm as any).firewall_outbound_custom_ports || [],
        backup_enabled: (vm as any).backup_enabled || false,
        backup_type: (vm as any).backup_type || 'weekly',
        notes: `Renewal request for ${months} month${months > 1 ? 's' : ''}. Current expiry: ${currentExpiry}, New expiry: ${newExpiry}`,
      }).select().single()

      if (error) throw error

      // Send email to customer about VM request
      await sendVMRequestEmail({
        to: me.email,
        customerName: me.name,
        requestId: insertedData.legacy_id || insertedData.id,
        requestType: 'Renewal',
        hostname: (vm as any).hostname || vm.name,
        details: `Your renewal request for ${months} month${months > 1 ? 's' : ''} has been received and is being processed.`
      })

      // Create add-on request if selected (single record with both CPFS and CCIS)
      if (selectedAddons.cpfs || selectedAddons.ccis) {
        // Duration string should only show base duration (months), grace period added in calculation
        const durationString = `${months} month${months > 1 ? 's' : ''}`

        await createAddonRequest({
          customer_id: me.id,
          vm_id: vm.id,
          cpfs_enabled: selectedAddons.cpfs,
          cpfs_package: selectedAddons.cpfs ? cpfsPackage : undefined,
          ccis_enabled: selectedAddons.ccis,
          ccis_package: selectedAddons.ccis ? ccisPackage : undefined,
          duration: durationString,
          status: 'Pending',
          notes: `Add-on renewal for ${months} month${months > 1 ? 's' : ''} along with VM renewal${selectedAddons.cpfs ? ' (CPFS: ' + cpfsPackage + ')' : ''}${selectedAddons.ccis ? ' (CCIS: ' + ccisPackage + ')' : ''}`,
          start_date: vm.expiry,
          end_date: newExpiry,
          expiry: newExpiry,
          related_entity_id: insertedData.id, // Link to the renewal request for safe filtering
          related_entity_type: 'vm_request'
        })
      }

      // Create alert for team roles (customer_id = NULL so customer doesn't see it)
      await createAlert({
        sev: 'info',
        title: 'Renewal Request',
        body: `Renewal Request for ${(vm as any).hostname || vm.name} (${months} month${months > 1 ? 's' : ''})${selectedAddons.cpfs || selectedAddons.ccis ? ' with add-on services' : ''}`,
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
          task_type: 'Renewal',
          addons: {
            cpfs: selectedAddons.cpfs,
            ccis: selectedAddons.ccis
          }
        }
      })

      // Also create task for ops visibility
      addTask({
        title: `Renewal — ${(vm as any).hostname || vm.name} (${months} month${months > 1 ? 's' : ''})${selectedAddons.cpfs || selectedAddons.ccis ? ' + Add-ons' : ''}`,
        customer: me.id, vm: vm.id, type: 'Renewal', priority: 'Normal', status: 'Pending', team: 'Sales',
        notes: `Customer-initiated renewal request for ${months} month${months > 1 ? 's' : ''}. Current expiry: ${currentExpiry}, New expiry: ${newExpiry}${selectedAddons.cpfs ? '\nCPFS: ' + cpfsPackage : ''}${selectedAddons.ccis ? '\nCCIS: ' + ccisPackage : ''}`,
      })

      toast('Renewal request sent to Sales', 'ok')
      onClose()
    } catch (err) {
      console.error('Error creating renewal request:', err)
      toast('Failed to submit renewal request', 'error')
    } finally {
      setIsSubmitting(false)
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

          {/* Add-on Services Section */}
          {hasExistingAddons && (
            <div className="card" style={{ borderColor: 'var(--line)', marginTop: 12 }}>
              <div className="card-body" style={{ padding: 14 }}>
                <div className="flex center between mb-2">
                  <div className="flex center gap-2">
                    <Icon name="box" size={13} />
                    <span className="fw-7 text-sm">Add-on Services</span>
                  </div>
                  <div className="text-xs text-mute">Renew along with VM</div>
                </div>

                {/* CPFS */}
                <div className="flex center between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="flex center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAddons.cpfs}
                      disabled={!hasCpfs}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          // When unselecting CPFS, also unselect CCIS
                          setSelectedAddons({ cpfs: false, ccis: false })
                        } else {
                          // When selecting CPFS, also select CCIS if VM originally has both
                          setSelectedAddons({ cpfs: true, ccis: hasCcis })
                        }
                      }}
                      style={{ cursor: hasCpfs ? 'pointer' : 'not-allowed' }}
                    />
                    <div>
                      <div className="fw-6 text-sm">CPFS</div>
                      <div className="text-xs text-mute">Cloud Parallel File System</div>
                    </div>
                  </div>
                  {selectedAddons.cpfs && (
                    <select
                      value={cpfsPackage}
                      onChange={(e) => setCpfsPackage(e.target.value as 'standard' | 'premium')}
                      style={{ padding: '4px 8px', borderRadius: 4, fontSize: 12 }}
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  )}
                </div>

                {/* CCIS */}
                <div className="flex center between" style={{ padding: '8px 0' }}>
                  <div className="flex center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAddons.ccis}
                      disabled={!hasCcis}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          // When unselecting CCIS, also unselect CPFS
                          setSelectedAddons({ cpfs: false, ccis: false })
                        } else {
                          // When selecting CCIS, also select CPFS if VM originally has both
                          setSelectedAddons({ cpfs: hasCpfs, ccis: true })
                        }
                      }}
                      style={{ cursor: hasCcis ? 'pointer' : 'not-allowed' }}
                    />
                    <div>
                      <div className="fw-6 text-sm">CCIS</div>
                      <div className="text-xs text-mute">Cloud Container Image Service</div>
                    </div>
                  </div>
                  {selectedAddons.ccis && (
                    <select
                      value={ccisPackage}
                      onChange={(e) => setCcisPackage(e.target.value as 'basic' | 'standard' | 'professional' | 'enterprise')}
                      style={{ padding: '4px 8px', borderRadius: 4, fontSize: 12 }}
                    >
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  )}
                </div>

                {existingAddons.length > 0 && (
                  <div className="text-xs text-mute mt-2" style={{ fontStyle: 'italic' }}>
                    Currently active: {existingAddons.map((a: any) => a.cpfs_enabled ? 'CPFS' : a.ccis_enabled ? 'CCIS' : '').filter(Boolean).join(', ') || 'None'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn accent" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Icon name="loader" size={12} className="spin" /> Submitting...
              </>
            ) : (
              <>
                <Icon name="check" size={12} /> Submit renewal request
              </>
            )}
          </button>
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [existingDisks, setExistingDisks] = useState<VMDisk[]>([])
  const [selectedDiskIds, setSelectedDiskIds] = useState<string[]>([])
  const [extendSizes, setExtendSizes] = useState<Record<string, string>>({})
  const [newDisks, setNewDisks] = useState<{ size: string }[]>([])
  const [editingSpec, setEditingSpec] = useState<'vcpu' | 'ram' | null>(null)

  const currentStorage = (vm as any).storage_gb || vm.storage

  useEffect(() => {
    getVMDisks(vm.id).then(setExistingDisks)
  }, [vm.id])

  useEffect(() => {
    const newTotal = newDisks.reduce((sum, d) => sum + (parseInt(d.size, 10) || 0), 0)
    const extendTotal = selectedDiskIds.reduce((sum, id) => sum + (parseInt(extendSizes[id] || '0', 10) || 0), 0)
    const projected = currentStorage + newTotal + extendTotal
    setSpec(prev => prev.storage !== projected ? { ...prev, storage: projected } : prev)
  }, [selectedDiskIds, extendSizes, newDisks, currentStorage])

  const getNextDiskName = (offset = 0) => {
    const names = new Set(existingDisks.map(d => d.name.toLowerCase()))
    let n = 1
    for (let i = 0; i <= offset; i++) {
      while (names.has(`disk${n}`)) n++
      names.add(`disk${n}`)
    }
    return `disk${n}`
  }

  const buildRequestedDisks = (): RequestedDiskChange[] | null => {
    if (existingDisks.length + newDisks.length > 5) return null

    const all: RequestedDiskChange[] = []

    const usedNames = new Set(existingDisks.map(d => d.name.toLowerCase()))
    for (const d of newDisks) {
      const size = parseInt(d.size, 10)
      if (!size || size <= 0) return null
      let n = 1
      while (usedNames.has(`disk${n}`)) n++
      usedNames.add(`disk${n}`)
      all.push({ action: 'new', name: `disk${n}`, size_gb: size })
    }

    for (const id of selectedDiskIds) {
      const add = parseInt(extendSizes[id] || '0', 10)
      if (!add || add <= 0) return null
      all.push({ action: 'extend', disk_id: id, add_gb: add })
    }

    return all
  }

  const currentVcpu = vm.vcpu
  const currentRam = (vm as any).ram_gb || vm.ram

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

    if (isSubmitting) return
    setIsSubmitting(true)

    // Validate all fields
    const isValid = validateField('vcpu', spec.vcpu) && validateField('ram', spec.ram) && validateField('storage', spec.storage)
    if (!isValid) {
      toast('Please fix validation errors before submitting', 'error')
      setIsSubmitting(false)
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

      // If no original request found (admin-created VM), use VM's current data as fallback
      const fallbackRequest = {
        request_type: (vm as any).request_type || 'paid',
        duration: (vm as any).duration || '12 months',
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
        firewall_outbound_allow_all: (vm as any).firewall_outbound_allow_all !== undefined ? (vm as any).firewall_outbound_allow_all : true,
        firewall_outbound_custom_ports: (vm as any).firewall_outbound_custom_ports || [],
        notes: (vm as any).notes || '',
      }

      const requestSource = originalRequest || fallbackRequest

      const requestedDisks = buildRequestedDisks()
      if (requestedDisks === null) {
        toast('Please fix disk fields', 'error')
        setIsSubmitting(false)
        return
      }

      // Create VM request with task_type='change-plan' using all original data, only changing upgrade fields
      const requestData: any = {
        customer_id: me.id,
        task_type: 'change-plan',
        request_type: requestSource.request_type,
        vm_id: vm.id,
        hostname: currentHostname,
        purpose: purpose,
        vcpu: spec.vcpu,
        ram_gb: spec.ram,
        storage: spec.storage,
        requested_disks: requestedDisks,
        qty: 1, // Upgrade is always for a single VM
        duration: (vm as any).expiry ? formatRemainingTerm((vm as any).expiry) : requestSource.duration,
        sizing: requestSource.sizing,
        storage_partitions: requestSource.storage_partitions,
        os_name: requestSource.os_name,
        os_version: requestSource.os_version,
        spec_changed: specChanged,
        backup_changed: backupChanged,
        custom_os_name: requestSource.custom_os_name,
        custom_os_version: requestSource.custom_os_version,
        zone: requestSource.zone,
        nics: requestSource.nics,
        public_ip_required: requestSource.public_ip_required,
        firewall_ports: requestSource.firewall_ports,
        firewall_outbound_allow_all: requestSource.firewall_outbound_allow_all,
        firewall_outbound_custom_ports: requestSource.firewall_outbound_custom_ports,
        backup_enabled: backupEnabled,
        backup_type: backupType,
        notes: `${requestSource.notes}\n\n${specChanged && backupChanged
          ? `Change Plan from: ${vm.vcpu} vCPU · ${(vm as any).ram_gb || vm.ram} GB RAM · ${(vm as any).storage_gb || vm.storage} GB storage\nTo: ${spec.vcpu} vCPU · ${spec.ram} GB RAM · ${spec.storage} GB storage\nBackup: ${backupEnabled ? `${backupType === 'daily' ? 'Daily' : 'Weekly'}` : 'No'}`
          : specChanged
            ? `Change Plan from: ${vm.vcpu} vCPU · ${(vm as any).ram_gb || vm.ram} GB RAM · ${(vm as any).storage_gb || vm.storage} GB storage\nTo: ${spec.vcpu} vCPU · ${spec.ram} GB RAM · ${spec.storage} GB storage`
            : `Backup service ${backupEnabled ? 'enabled' : 'disabled'} (${backupType === 'daily' ? 'Daily' : 'Weekly'})`
          }`,
      }

      const { data: insertedData, error } = await supabase.from('vm_requests').insert(requestData).select().maybeSingle()

      if (error) throw error

      // Send email to customer about VM request
      await sendVMRequestEmail({
        to: me.email,
        customerName: me.name,
        requestId: insertedData.legacy_id || insertedData.id,
        requestType: 'Change Plan',
        hostname: currentHostname,
        details: `Your change plan request for ${currentHostname} has been received and is being processed.`,
        vmLegacyId: (vm as any).legacy_id || vm.id,
        currentPlan: `CPU ${vm.vcpu} cores · RAM ${(vm as any).ram_gb || vm.ram} GB · Storage ${(vm as any).storage_gb || vm.storage} GB · Backup: ${(vm as any).backup_enabled ? ((vm as any).backup_type === 'daily' ? 'Daily' : 'Weekly') : 'No'}`,
        requestedPlan: `CPU ${spec.vcpu} cores · RAM ${spec.ram} GB · Storage ${spec.storage} GB · Backup: ${backupEnabled ? (backupType === 'daily' ? 'Daily' : 'Weekly') : 'No'}`
      })

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
    } finally {
      setIsSubmitting(false)
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
            {/* Compute */}
            <div className="card" style={{ borderColor: 'var(--line)' }}>
              <div className="card-head">
                <h3 className="card-title">Compute</h3>
              </div>
              <div className="card-body" style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div
                    className="card"
                    onClick={() => setEditingSpec(editingSpec === 'vcpu' ? null : 'vcpu')}
                    style={{
                      cursor: 'pointer',
                      borderColor: editingSpec === 'vcpu' ? 'var(--accent)' : 'var(--line)',
                      background: editingSpec === 'vcpu' ? 'var(--accent-soft)' : 'var(--surface)'
                    }}
                  >
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="flex between" style={{ alignItems: 'center' }}>
                        <span className="fw-6">vCPU</span>
                        <span className="mono text-xs">{spec.vcpu} cores</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="card"
                    onClick={() => setEditingSpec(editingSpec === 'ram' ? null : 'ram')}
                    style={{
                      cursor: 'pointer',
                      borderColor: editingSpec === 'ram' ? 'var(--accent)' : 'var(--line)',
                      background: editingSpec === 'ram' ? 'var(--accent-soft)' : 'var(--surface)'
                    }}
                  >
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="flex between" style={{ alignItems: 'center' }}>
                        <span className="fw-6">RAM</span>
                        <span className="mono text-xs">{spec.ram} GB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {editingSpec === 'vcpu' && (
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label>Change vCPU to</label>
                    <input
                      type="number"
                      value={spec.vcpu}
                      onChange={(e) => handleSpecChange('vcpu', e.target.value)}
                      min={currentVcpu}
                      step={1}
                      autoFocus
                    />
                    {errors.vcpu && <div className="text-xs" style={{ color: 'var(--bad)', marginTop: 4 }}>{errors.vcpu}</div>}
                  </div>
                )}

                {editingSpec === 'ram' && (
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label>Change RAM to (GB)</label>
                    <input
                      type="number"
                      value={spec.ram}
                      onChange={(e) => handleSpecChange('ram', e.target.value)}
                      min={currentRam}
                      step={1}
                      autoFocus
                    />
                    {errors.ram && <div className="text-xs" style={{ color: 'var(--bad)', marginTop: 4 }}>{errors.ram}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Disks */}
            <div className="card" style={{ borderColor: 'var(--line)' }}>
              <div className="card-head">
                <h3 className="card-title">Disks</h3>
              </div>
              <div className="card-body" style={{ padding: 14 }}>
                {existingDisks.length === 0 ? (
                  <div className="text-sm text-mute mb-3">No existing disks found.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
                    {existingDisks.map(d => (
                      <div
                        key={d.id}
                        className="card"
                        onClick={() => {
                          if (selectedDiskIds.includes(d.id)) {
                            setSelectedDiskIds(prev => prev.filter(id => id !== d.id))
                            setExtendSizes(prev => {
                              const s = { ...prev }
                              delete s[d.id]
                              return s
                            })
                          } else {
                            setSelectedDiskIds(prev => [...prev, d.id])
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedDiskIds.includes(d.id) ? 'var(--accent)' : 'var(--line)',
                          background: selectedDiskIds.includes(d.id) ? 'var(--accent-soft)' : 'var(--surface)'
                        }}
                      >
                        <div className="card-body" style={{ padding: 12 }}>
                          <div className="flex col" style={{ alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <span className="fw-6">{d.name}</span>
                            <span className="mono text-xs">{d.size_gb} GB</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDiskIds.map(id => {
                  const disk = existingDisks.find(d => d.id === id)
                  return (
                    <div key={id} className="field" style={{ marginBottom: 14 }}>
                      <label>Add to {disk?.name} (GB)</label>
                      <input
                        type="number"
                        value={extendSizes[id] || ''}
                        onChange={(e) => setExtendSizes(prev => ({ ...prev, [id]: e.target.value }))}
                        min={1}
                        step={10}
                        autoFocus
                      />
                    </div>
                  )
                })}

                <div className="flex gap-2 wrap mb-3">
                  {existingDisks.length + newDisks.length >= 5 ? (
                    <div className="text-sm" style={{ color: 'var(--bad)' }}>Maximum 5 disks allowed</div>
                  ) : (
                    <div
                      className="filter-chip"
                      onClick={() => setNewDisks(prev => [...prev, { size: '' }])}
                      style={{ cursor: 'pointer' }}
                    >
                      + Add new disk
                    </div>
                  )}
                </div>

                {newDisks.map((d, i) => (
                  <div key={i} className="field" style={{ marginBottom: 14 }}>
                    <div className="flex between" style={{ alignItems: 'center' }}>
                      <label>New disk {getNextDiskName(i)} (GB)</label>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setNewDisks(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ color: 'var(--bad)' }}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={d.size}
                      onChange={(e) => setNewDisks(prev => prev.map((item, idx) => idx === i ? { ...item, size: e.target.value } : item))}
                      min={1}
                      step={10}
                    />
                  </div>
                ))}
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
          <button className="btn ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn accent" disabled={spec.vcpu === vm.vcpu && spec.ram === vm.ram && spec.storage === vm.storage && !backupEnabled || isSubmitting} onClick={submit}>
            {isSubmitting ? (
              <>
                <Icon name="loader" size={12} className="spin" /> Submitting...
              </>
            ) : (
              <>
                <Icon name="arrow-up" size={12} />Submit upgrade request
              </>
            )}
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
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (isSubmitting) return
    setIsSubmitting(true)
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
    setIsSubmitting(false)
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
          <button className="btn ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn accent" disabled={!target || target.id === currentPlan.id || isSubmitting} onClick={submit}>
            {isSubmitting ? (
              <>
                <Icon name="loader" size={12} className="spin" /> Submitting...
              </>
            ) : (
              <>
                <Icon name="check" size={12} />Submit {direction.toLowerCase()} request
              </>
            )}
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
  const { logActivity } = useActivityStore()
  const me = customers.find((c: any) => c.id === (vm as any).customer_id)

  const [duration, setDuration] = useState(12)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('12')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    if (isSubmitting) return
    setIsSubmitting(true)

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
        duration: `${duration} month${duration > 1 ? 's' : ''}`,
        sizing: (vm as any).sizing || 'Standard',
        storage_partitions: (vm as any).storage_partitions || '',
        os_name: (vm as any).os_name || 'Linux',
        os_version: (vm as any).os_version || '',
        zone: (vm as any).zone || 'yangon-dc1',
        nics: (vm as any).nics || [],
        public_ip_required: (vm as any).public_ip_required ?? true,
        firewall_ports: (vm as any).firewall_ports || [],
        firewall_outbound_allow_all: (vm as any).firewall_outbound_allow_all !== undefined ? (vm as any).firewall_outbound_allow_all : true,
        firewall_outbound_custom_ports: (vm as any).firewall_outbound_custom_ports || [],
        backup_enabled: (vm as any).backup_enabled || false,
        notes: `Trial to paid conversion for VM: ${(vm as any).legacy_id || vm.id}`,
      }).select().single()

      if (error) throw error

      // Send email to customer for convert to paid request
      try {
        await sendVMRequestEmail({
          to: me.email,
          customerName: me.name,
          requestId: insertedData.legacy_id,
          requestType: 'Trial to Paid Conversion',
          hostname: (vm as any).hostname || vm.name,
          vmLegacyId: (vm as any).legacy_id,
          details: `Your trial to paid conversion request for ${(vm as any).hostname || vm.name} has been received. Duration: ${getDurationLabel(duration)}. We will notify you once the conversion is completed.`
        })
      } catch (emailError) {
        console.error('Failed to send convert to paid request email:', emailError)
        // Don't throw error - email failure shouldn't block the request
      }

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

      // Log the trial to paid conversion request
      await logActivity(
        `Requested trial to paid conversion for VM ${(vm as any).hostname || vm.name} with ${getDurationLabel(duration)} duration`,
        'vm',
        me.name || 'Customer',
        {
          vmId: vm.id,
          hostname: (vm as any).hostname || vm.name,
          customerId: me.id,
          duration: duration,
          requestId: insertedData.id
        }
      )

      toast('Trial to paid conversion request submitted', 'ok')
      onClose()
    } catch (error: any) {
      toast('Failed to submit conversion request: ' + error.message, 'error')
    } finally {
      setIsSubmitting(false)
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
          <button className="btn ghost" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Icon name="loader" size={12} className="spin" /> Submitting...
              </>
            ) : (
              <>
                <Icon name="check" size={12} />Submit Conversion Request
              </>
            )}
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
