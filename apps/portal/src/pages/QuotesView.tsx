import { useState, useEffect } from 'react'
import Icon from '../lib/icons'
import { formatMMK } from '../components/ui/ui'
import useQuoteStore from '../store/quoteStore'
import useUIStore from '../store/uiStore'
import useCustomerStore from '../store/customerStore'
import useVMRequestStore from '../store/vmRequestStore'
import useAuthStore from '../store/authStore'
import useVMStore from '../store/vmStore'
import { supabase } from '../lib/supabase'
import { exportQuoteToPDF } from '../lib/pdfExport'
import QuoteDrawer from '../components/quote/QuoteDrawer'


interface QuotesViewProps {
  autoOpen?: boolean
  onAutoOpenReset?: () => void
  prefillCustomerId?: string
  prefillRequestId?: string
  prefillRequestType?: 'vm' | 'addon'
}

const QuotesView = ({ autoOpen = false, onAutoOpenReset, prefillCustomerId, prefillRequestId, prefillRequestType }: QuotesViewProps) => {
  const { quotes, addQuote } = useQuoteStore()
  const { toast } = useUIStore()
  const { user, refreshUser } = useAuthStore()
  const { vms, loadVMs } = useVMStore()
  const [building, setBuilding] = useState(false)
  const [addonRequests, setAddonRequests] = useState<any[]>([])
  const [requestType, setRequestType] = useState<'vm' | 'addon'>('vm')
  const [currentVMData, setCurrentVMData] = useState<any>(null)
  const [selectedQuote, setSelectedQuote] = useState<any>(null)

  // Row types for the sheet
  type InstanceLine = { spec: string; vcpu: number; ram: number; storage: number; qty: number; unit: number; term: string }
  type BackupLine = { spec: string; storage: number; unit: number; term: string }
  type PublicIPLine = { spec: string; unit: number; term: string }

  const { customers } = useCustomerStore()
  const { vmRequests } = useVMRequestStore()

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined)
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined)

  const customerRequests = requestType === 'vm'
    ? vmRequests.filter(r => r.customer_id === selectedCustomerId)
    : addonRequests.filter(r => r.customer_id === selectedCustomerId)

  const selectedRequest = requestType === 'vm'
    ? vmRequests.find(r => r.id === selectedRequestId)
    : addonRequests.find(r => r.id === selectedRequestId)
  const isUpgrade = requestType === 'vm' && selectedRequest?.task_type?.toLowerCase() === 'change-plan'
  const isRenewal = requestType === 'vm' && selectedRequest?.task_type?.toLowerCase() === 'renewal'

  // Load addon requests
  useEffect(() => {
    const loadAddonRequests = async () => {
      const { data, error } = await supabase.from('addon_requests').select('*')
      if (!error && data) {
        setAddonRequests(data)
      }
    }
    loadAddonRequests()
    loadVMs()
  }, [loadVMs])

  // Helper function to parse billing term string to number of months
  const parseBillingTermToMonths = (term: string): number => {
    if (term === 'Monthly') return 1
    if (term === 'Quarterly') return 3
    if (term === 'Half Yearly') return 6
    if (term === 'Yearly') return 12

    // Parse custom terms like "9 months" or "9 months 2 days"
    const match = term.match(/(\d+)\s*months/)
    if (match) {
      return parseInt(match[1], 10)
    }

    return 1 // Default to 1 month
  }

  // Load current VM data for renewal and change-plan requests
  useEffect(() => {
    const loadCurrentVMData = async () => {
      if ((isRenewal || isUpgrade) && selectedRequest) {
        // vm_requests table doesn't have vm_id, so we need to lookup by hostname
        if (selectedRequest.hostname) {
          const { data: vmData } = await supabase.from('vms').select('*').eq('hostname', selectedRequest.hostname).single()
          if (vmData) {
            setCurrentVMData(vmData)
          } else {
            setCurrentVMData(null)
          }
        } else {
          setCurrentVMData(null)
        }
      } else {
        setCurrentVMData(null)
      }
    }
    loadCurrentVMData()
  }, [isRenewal, isUpgrade, selectedRequest])

  // Update quote sheet when currentVMData is loaded for change-plan requests
  useEffect(() => {
    if (isUpgrade && currentVMData && selectedRequest) {
      // For change-plan requests, calculate remaining duration from VM expiry
      const today = new Date()
      const expiryDate = new Date(currentVMData.expiry)

      if (isNaN(expiryDate.getTime())) {
        return
      }

      // Calculate exact months and days using actual calendar
      let months = expiryDate.getMonth() - today.getMonth()
      let years = expiryDate.getFullYear() - today.getFullYear()
      let days = expiryDate.getDate() - today.getDate()

      // Adjust for negative values
      if (days < 0) {
        months--
        // Get days in the month before expiry
        const prevMonth = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), 0)
        days += prevMonth.getDate()
      }

      if (months < 0) {
        years--
        months += 12
      }

      const totalMonths = years * 12 + months

      // Convert excess days to months (if days > 28, add a month)
      if (days > 28) {
        const extraMonths = Math.floor(days / 30)
        const finalMonths = totalMonths + extraMonths
        const finalDays = days % 30

        // Determine billing term based on remaining duration, or show exact months and days
        let billingTerm: string
        if (finalMonths === 1 && finalDays === 0) {
          billingTerm = 'Monthly'
        } else if (finalMonths === 3 && finalDays === 0) {
          billingTerm = 'Quarterly'
        } else if (finalMonths === 6 && finalDays === 0) {
          billingTerm = 'Half Yearly'
        } else if (finalMonths === 12 && finalDays === 0) {
          billingTerm = 'Yearly'
        } else {
          billingTerm = finalDays > 0
            ? `${finalMonths} months ${finalDays} days`
            : `${finalMonths} months`
        }

        // Parse notes to determine what changed
        const notes = selectedRequest.notes || ''
        const isSpecChange = selectedRequest.spec_changed || false
        const isBackupChange = selectedRequest.backup_changed || false

        console.log('Before comparison logic:', { notes, isSpecChange, isBackupChange })

        // Fallback: check if spec values differ from current VM data
        const specDiffers = currentVMData && (
          selectedRequest.vcpu !== currentVMData.vcpu ||
          selectedRequest.ram_gb !== (currentVMData.ram_gb || currentVMData.ram) ||
          selectedRequest.storage !== (currentVMData.storage_gb || currentVMData.storage)
        )
        const backupDiffers = currentVMData && (
          selectedRequest.backup_enabled !== currentVMData.backup_enabled ||
          (selectedRequest.backup_enabled && selectedRequest.backup_type !== currentVMData.backup_type)
        )

        console.log('Change comparison:', {
          isSpecChange,
          isBackupChange,
          specDiffers,
          backupDiffers,
          requestVcpu: selectedRequest.vcpu,
          currentVcpu: currentVMData?.vcpu,
          requestRam: selectedRequest.ram_gb,
          currentRam: currentVMData?.ram_gb || currentVMData?.ram,
          requestStorage: selectedRequest.storage,
          currentStorage: currentVMData?.storage_gb || currentVMData?.storage,
          requestBackupEnabled: selectedRequest.backup_enabled,
          currentBackupEnabled: currentVMData?.backup_enabled,
        })

        const instanceLines: InstanceLine[] = []
        const backupLines: BackupLine[] = []

        if (isSpecChange || specDiffers) {
          if (selectedRequest.vcpu) {
            const vcpuMonthlyPrice = 25000 // Fixed price per vCPU core

            instanceLines.push({
              spec: `vCPU|${selectedRequest.vcpu} cores`,
              vcpu: 0,
              ram: 0,
              storage: 0,
              qty: 1,
              unit: vcpuMonthlyPrice,
              term: billingTerm
            })
          }
          if (selectedRequest.ram_gb) {
            const ramMonthlyPrice = selectedRequest.ram_gb * 3000 // 3000 MMK per GB

            instanceLines.push({
              spec: `RAM|${selectedRequest.ram_gb} GB`,
              vcpu: 0,
              ram: 0,
              storage: 0,
              qty: 1,
              unit: ramMonthlyPrice,
              term: billingTerm
            })
          }
          if (selectedRequest.storage) {
            const storageMonthlyPrice = selectedRequest.storage * 500 // 500 MMK per GB

            instanceLines.push({
              spec: `Storage|${selectedRequest.storage} GB`,
              vcpu: 0,
              ram: 0,
              storage: 0,
              qty: 1,
              unit: storageMonthlyPrice,
              term: billingTerm
            })
          }
        }

        if ((isBackupChange || backupDiffers) && selectedRequest.backup_enabled) {
          backupLines.push({
            spec: selectedRequest.backup_type === 'daily' ? 'Daily Backup' : 'Weekly Backup',
            storage: selectedRequest.storage || 0,
            unit: 0,
            term: billingTerm
          })
        }

        setSheet(s => ({ ...s, instance: instanceLines, backup: backupLines }))
        return
      }

      // Determine billing term based on remaining duration, showing exact months and days
      let billingTerm: string
      if (totalMonths === 1 && days === 0) {
        billingTerm = 'Monthly'
      } else if (totalMonths === 3 && days === 0) {
        billingTerm = 'Quarterly'
      } else if (totalMonths === 6 && days === 0) {
        billingTerm = 'Half Yearly'
      } else if (totalMonths === 12 && days === 0) {
        billingTerm = 'Yearly'
      } else {
        billingTerm = days > 0
          ? `${totalMonths} months ${days} days`
          : `${totalMonths} months`
      }

      // Parse notes to determine what changed
      const notes = selectedRequest.notes || ''
      const isSpecChange = selectedRequest.spec_changed || false
      const isBackupChange = selectedRequest.backup_changed || false

      // Fallback: check if spec values differ from current VM data
      const specDiffers = currentVMData && (
        selectedRequest.vcpu !== currentVMData.vcpu ||
        selectedRequest.ram_gb !== (currentVMData.ram_gb || currentVMData.ram) ||
        selectedRequest.storage !== (currentVMData.storage_gb || currentVMData.storage)
      )
      const backupDiffers = currentVMData && (
        selectedRequest.backup_enabled !== currentVMData.backup_enabled ||
        (selectedRequest.backup_enabled && selectedRequest.backup_type !== currentVMData.backup_type)
      )

      const instanceLines: InstanceLine[] = []
      const backupLines: BackupLine[] = []

      if (isSpecChange || specDiffers) {
        if (selectedRequest.vcpu) {
          // Calculate vCPU monthly price
          const vcpuMonthlyPrice = (currentVMData.priceMonth || 0) / currentVMData.vcpu

          instanceLines.push({
            spec: `vCPU|${selectedRequest.vcpu} cores`,
            vcpu: 0,
            ram: 0,
            storage: 0,
            qty: 1,
            unit: vcpuMonthlyPrice,
            term: billingTerm
          })
        }
        if (selectedRequest.ram_gb) {
          // Calculate RAM monthly price
          const ramMonthlyPrice = (currentVMData.priceMonth || 0) * (currentVMData.ram_gb / currentVMData.vcpu)

          instanceLines.push({
            spec: `RAM|${selectedRequest.ram_gb} GB`,
            vcpu: 0,
            ram: 0,
            storage: 0,
            qty: 1,
            unit: ramMonthlyPrice,
            term: billingTerm
          })
        }
        if (selectedRequest.storage) {
          // Calculate Storage monthly price
          const storageMonthlyPrice = (currentVMData.priceMonth || 0) * (currentVMData.storage_gb / currentVMData.vcpu)

          instanceLines.push({
            spec: `Storage|${selectedRequest.storage} GB`,
            vcpu: 0,
            ram: 0,
            storage: 0,
            qty: 1,
            unit: storageMonthlyPrice,
            term: billingTerm
          })
        }
      }

      if ((isBackupChange || backupDiffers) && selectedRequest.backup_enabled) {
        // Calculate backup monthly price (assuming backup is 20% of monthly price)
        const backupMonthlyPrice = (currentVMData.priceMonth || 0) * 0.2

        backupLines.push({
          spec: selectedRequest.backup_type === 'daily' ? 'Daily Backup' : 'Weekly Backup',
          storage: selectedRequest.storage || 0,
          unit: backupMonthlyPrice,
          term: billingTerm
        })
      }

      setSheet(s => ({ ...s, instance: instanceLines, backup: backupLines }))
    }
  }, [currentVMData, isUpgrade, selectedRequest])
  useEffect(() => {
    if (isRenewal && currentVMData && selectedRequest) {
      let billingTerm: string
      if (selectedRequest.duration === 1) {
        billingTerm = 'Monthly'
      } else if (selectedRequest.duration === 3) {
        billingTerm = 'Quarterly'
      } else if (selectedRequest.duration === 6) {
        billingTerm = 'Half Yearly'
      } else if (selectedRequest.duration === 12) {
        billingTerm = 'Yearly'
      } else {
        // Show custom duration
        billingTerm = `${selectedRequest.duration} months`
      }
      
      const instanceLines: InstanceLine[] = []
      const backupLines: BackupLine[] = []
      const publicIPLines: PublicIPLine[] = []

      // Use full spec format like new VM requests
      instanceLines.push({
        spec: currentVMData.hostname || 'VM',
        vcpu: currentVMData.vcpu || 0,
        ram: currentVMData.ram_gb || 0,
        storage: currentVMData.storage_gb || 0,
        qty: 1,
        unit: 0,
        term: billingTerm
      })

      // Add backup if enabled on current VM
      if (currentVMData.backup_enabled) {
        backupLines.push({
          spec: currentVMData.backup_type === 'daily' ? 'Daily Backup' : 'Weekly Backup',
          storage: currentVMData.storage_gb || 0,
          unit: 0,
          term: billingTerm
        })
      }

      // Add public IP if enabled on current VM
      if (currentVMData.public_ip) {
        publicIPLines.push({
          spec: 'Public IP',
          unit: 0,
          term: billingTerm
        })
      }

      setSheet(s => ({ ...s, instance: instanceLines, backup: backupLines, publicIP: publicIPLines }))
    }
  }, [currentVMData, isRenewal, selectedRequest])

  const onSelectCustomer = (id?: string) => {
    setSelectedCustomerId(id)
    setSelectedRequestId(undefined)
  }

  const onSelectRequest = (id?: string) => {
    setSelectedRequestId(id)
    if (id) {
      if (requestType === 'vm') {
        const request = vmRequests.find(r => r.id === id)
        if (request) {
          let billingTerm: string
          if (request.duration === 1) {
            billingTerm = 'Monthly'
          } else if (request.duration === 3) {
            billingTerm = 'Quarterly'
          } else if (request.duration === 6) {
            billingTerm = 'Half Yearly'
          } else if (request.duration === 12) {
            billingTerm = 'Yearly'
          } else {
            // Show custom duration
            billingTerm = `${request.duration} months`
          }
          
          const isUpgradeRequest = request.task_type?.toLowerCase() === 'change-plan'
          const isRenewalRequest = request.task_type?.toLowerCase() === 'renewal'
          if (isUpgradeRequest) {
            // For upgrade requests, wait for currentVMData to load before setting sheet
            // The sheet will be set in the useEffect when currentVMData is available
            setSheet(s => ({ ...s, instance: [], backup: [] }))
          } else if (isRenewalRequest) {
            // For renewal requests, wait for currentVMData to load before setting sheet
            // The sheet will be set in the useEffect when currentVMData is available
            setSheet(s => ({ ...s, instance: [], backup: [], publicIP: [] }))
          } else {
            // Regular VM requests use full spec structure
            const backupLines: BackupLine[] = []
            if (request.backup_enabled) {
              backupLines.push({
                spec: request.backup_type === 'daily' ? 'Daily Backup' : 'Weekly Backup',
                storage: request.storage || 0,
                unit: 0,
                term: billingTerm
              })
            }
            const publicIPLines: PublicIPLine[] = []
            if (request.public_ip_required) {
              publicIPLines.push({
                spec: 'Public IP',
                unit: 0,
                term: billingTerm
              })
            }
            setSheet(s => ({
              ...s,
              instance: [
                {
                  spec: request.hostname || request.sizing,
                  vcpu: request.vcpu,
                  ram: request.ram_gb,
                  storage: request.storage,
                  qty: request.qty,
                  unit: 0,
                  term: billingTerm
                }
              ],
              backup: backupLines.map(l => ({
                ...l,
                unit: 0
              })),
              publicIP: publicIPLines.map(l => ({
                ...l,
                unit: 0
              }))
            }))
          }
        }
      } else {
        const request = addonRequests.find(r => r.id === id)
        if (request) {
          let billingTerm: string
          if (request.duration === 1) {
            billingTerm = 'Monthly'
          } else if (request.duration === 3) {
            billingTerm = 'Quarterly'
          } else if (request.duration === 6) {
            billingTerm = 'Half Yearly'
          } else if (request.duration === 12) {
            billingTerm = 'Yearly'
          } else {
            // Show custom duration
            billingTerm = `${request.duration} months`
          }
          
          const instanceLines: InstanceLine[] = []
          if (request.cpfs_enabled) {
            instanceLines.push({
              spec: `CPFS|${request.cpfs_package || 'standard'}`,
              vcpu: 0,
              ram: 0,
              storage: 0,
              qty: 1,
              unit: 0,
              term: billingTerm
            })
          }
          if (request.ccis_enabled) {
            instanceLines.push({
              spec: `CCIS|${request.ccis_package || 'standard'}`,
              vcpu: 0,
              ram: 0,
              storage: 0,
              qty: 1,
              unit: 0,
              term: billingTerm
            })
          }
          setSheet(s => ({ ...s, instance: instanceLines }))
        }
      }
    } else {
      setSheet(s => ({ ...s, instance: [] }))
    }
  }

  //quotation sheet state
  const [sheet, setSheet] = useState<{
    instance: InstanceLine[]
    backup: BackupLine[]
    publicIP: PublicIPLine[]
    taxPct: number
    discountPct: number
  }>({
    instance: [],
    backup: [],
    publicIP: [],
    taxPct: 5,
    discountPct: 0,
  })

  useEffect(() => {
    if (autoOpen) {
      setBuilding(true)
      onAutoOpenReset?.()
    }
  }, [autoOpen, onAutoOpenReset])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  useEffect(() => {
    if (prefillCustomerId && prefillRequestId) {
      // Auto-select customer and request when prefill props are provided
      onSelectCustomer(prefillCustomerId)
      // Set request type if provided
      if (prefillRequestType) {
        setRequestType(prefillRequestType)
      }
      // Small delay to ensure customer is selected first
      setTimeout(() => {
        onSelectRequest(prefillRequestId)
        setBuilding(true)
      }, 50)
    }
  }, [prefillCustomerId, prefillRequestId, prefillRequestType])

  useEffect(() => {
    // When add-on requests finish loading, auto-fill service lines if a request is already selected
    if (requestType === 'addon' && selectedRequestId) {
      const found = addonRequests.find(r => r.id === selectedRequestId)
      if (found && sheet.instance.length === 0) {
        onSelectRequest(selectedRequestId)
      }
    }
  }, [addonRequests, requestType, selectedRequestId])
  const getTermMultiplier = (term: string) => {
    switch (term) {
      case 'Monthly': return 1
      case 'Quarterly': return 3
      case 'Half Yearly': return 6
      case 'Yearly': return 12
      default:
        // Parse custom terms like "9 months" or "9 months 2 days"
        const monthsMatch = term.match(/(\d+)\s*months/)
        const daysMatch = term.match(/(\d+)\s*days/)

        let multiplier = 1
        if (monthsMatch) {
          multiplier = parseInt(monthsMatch[1], 10)
        }
        if (daysMatch) {
          // Convert days to fraction of a month (assuming 30 days per month)
          const days = parseInt(daysMatch[1], 10)
          multiplier += days / 30
        }
        return multiplier
    }
  }

  const instExt = (l: InstanceLine) => (l.unit || 0) * (l.qty || 0) * getTermMultiplier(l.term)
  const backupExt = (l: BackupLine) => (l.unit || 0) * getTermMultiplier(l.term)
  const publicIPExt = (l: PublicIPLine) => (l.unit || 0) * getTermMultiplier(l.term)
  const instanceSub = sheet.instance.reduce((a: number, l: InstanceLine) => a + instExt(l), 0)
  const backupSub = sheet.backup.reduce((a: number, l: BackupLine) => a + backupExt(l), 0)
  const publicIPSub = sheet.publicIP.reduce((a: number, l: PublicIPLine) => a + publicIPExt(l), 0)
  const subTotal = instanceSub + backupSub + publicIPSub
  const discountAmount = Math.round(subTotal * (sheet.discountPct / 100))
  const netAmount = subTotal - discountAmount
  const tax = Math.round(netAmount * (sheet.taxPct / 100))
  const grand = netAmount + tax
  const backupTotalGB = sheet.backup.reduce((a: number, l: BackupLine) => a + (l.storage || 0), 0)

  const updateInstance = (i: number, patch: Partial<InstanceLine>) => {
    const instance = [...sheet.instance]
    instance[i] = { ...instance[i], ...patch }
    setSheet({ ...sheet, instance })
  }
  const addInstance = () => {
    const isAddon = requestType === 'addon'
    const next = isAddon
      ? { spec: 'Service|package', vcpu: 0, ram: 0, storage: 0, qty: 1, unit: 0, term: 'Monthly' as const }
      : { spec: `Instance ${sheet.instance.length + 1}`, vcpu: 2, ram: 8, storage: 100, qty: 1, unit: 120000, term: 'Monthly' as const }
    setSheet({ ...sheet, instance: [...sheet.instance, next] })
  }
  const removeInstance = (i: number) => setSheet({ ...sheet, instance: sheet.instance.filter((_, j) => j !== i) })

  const updateBackup = (i: number, patch: Partial<BackupLine>) => {
    const backup = [...sheet.backup]
    backup[i] = { ...backup[i], ...patch }
    setSheet({ ...sheet, backup })
  }
  const updatePublicIP = (i: number, patch: Partial<PublicIPLine>) => {
    const publicIP = [...sheet.publicIP]
    publicIP[i] = { ...publicIP[i], ...patch }
    setSheet({ ...sheet, publicIP })
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{quotes.length} quotes · {quotes.filter(q => q.status === 'Accepted').length} accepted this month</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setBuilding(true)}><Icon name="plus" size={13} />New quote</button>
        </div>
      </div>

      {building && (
        <div className="card mb-4" style={{ overflow: 'visible' }}>
          <div className="card-head">
            <h3 className="card-title">Quotation</h3>
            <button className="icon-btn" onClick={() => setBuilding(false)}><Icon name="x" size={14} /></button>
          </div>
          <div className="card-body" style={{ padding: 18, overflow: 'visible' }}>
            {/* Top header (company + title) */}
            <div className="flex between center" style={{ marginBottom: 12 }}>
              <div className="fw-7" style={{ fontSize: 18 }}>ONE CLOUD NEXT-GEN CO., LTD</div>
              <div className="fw-7" style={{ fontSize: 16, letterSpacing: '0.06em' }}>QUOTATION</div>
            </div>

            <div className="grid-3" style={{ gap: 16, marginBottom: 12 }}>
              <div className="field">
                <label>Customer</label>
                <select value={selectedCustomerId || ''} onChange={e => onSelectCustomer(e.target.value || undefined)}>
                  <option value="">— Select —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.org_name ? ` (${c.org_name})` : ''}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Request Type</label>
                <select
                  value={requestType}
                  onChange={e => { setRequestType(e.target.value as 'vm' | 'addon'); setSelectedRequestId(undefined); setSheet(s => ({ ...s, instance: [], backup: [], publicIP: [] })) }}
                >
                  <option value="vm">VM Request</option>
                  <option value="addon">Add-on Service</option>
                </select>
              </div>
              <div className="field">
                <label>Link to Request</label>
                <select
                  value={selectedRequestId || ''}
                  onChange={e => onSelectRequest(e.target.value || undefined)}
                  disabled={!selectedCustomerId}
                >
                  <option value="">— Select a request —</option>
                  {customerRequests.map(r => (
                    <option key={r.id} value={r.id}>
                      {requestType === 'vm'
                        ? `${(r.legacy_id || r.id)} · ${(r.hostname || '')} · [${(r.task_type || 'new')}]`
                        : `${(r.legacy_id || r.id)} · ${r.cpfs_enabled ? 'CPFS' : ''}${r.cpfs_enabled && r.ccis_enabled ? ' + ' : ''}${r.ccis_enabled ? 'CCIS' : ''}`
                      }
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main table */}
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              {requestType === 'addon' || isUpgrade ? (
                <table className="tbl" style={{ border: '1px solid var(--line)' }}>
                  <thead>
                    <tr style={{ background: 'oklch(0.78 0.08 250)', color: 'white' }}>
                      <th>Service</th>
                      <th>Package</th>
                      <th className="right">Unit Price (MMK)</th>
                      <th className="right">QTY</th>
                      <th>Billing Term</th>
                      <th className="right">Extended Price (MMK)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colSpan={6} className="fw-6" style={{ background: 'var(--surface-2)' }}>{isUpgrade ? 'Upgrade Items' : isRenewal ? 'Renewal Items' : 'Add-on Services'}</td></tr>
                    {sheet.instance.map((l, i) => (
                      <tr key={i}>
                        <td><input value={l.spec.split('|')[0] || ''} onChange={e => updateInstance(i, { spec: `${e.target.value}|${l.spec.split('|')[1] || ''}` })} /></td>
                        <td><input value={l.spec.split('|')[1] || ''} onChange={e => updateInstance(i, { spec: `${l.spec.split('|')[0] || ''}|${e.target.value}` })} /></td>
                        <td className="right"><input type="number" value={l.unit} onChange={e => updateInstance(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                        <td className="right"><input type="number" value={l.qty} onChange={e => updateInstance(i, { qty: +e.target.value })} style={{ width: 60 }} /></td>
                        <td>
                          {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(l.term) ? (
                            <select value={l.term} onChange={e => updateInstance(i, { term: e.target.value as InstanceLine['term'] })}>
                              <option>Monthly</option>
                              <option>Quarterly</option>
                              <option>Half Yearly</option>
                              <option>Yearly</option>
                            </select>
                          ) : (
                            <input value={l.term} onChange={e => updateInstance(i, { term: e.target.value as InstanceLine['term'] })} style={{ width: 120 }} />
                          )}
                        </td>
                        <td className="right tnum fw-6">MMK {formatMMK(instExt(l))}</td>
                      </tr>
                    ))}
                    {sheet.backup.map((l, i) => (
                      <tr key={`backup-${i}`}>
                        <td><input value={l.spec} onChange={e => updateBackup(i, { spec: e.target.value })} /></td>
                        <td><input value={`${l.storage} GB`} readOnly style={{ background: 'var(--surface-2)' }} /></td>
                        <td className="right"><input type="number" value={l.unit} onChange={e => updateBackup(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                        <td className="right"><input type="number" value={1} readOnly style={{ width: 60, background: 'var(--surface-2)' }} /></td>
                        <td>
                          {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(l.term) ? (
                            <select value={l.term} onChange={e => updateBackup(i, { term: e.target.value as BackupLine['term'] })}>
                              <option>Monthly</option>
                              <option>Quarterly</option>
                              <option>Half Yearly</option>
                              <option>Yearly</option>
                            </select>
                          ) : (
                            <input value={l.term} onChange={e => updateBackup(i, { term: e.target.value as BackupLine['term'] })} style={{ width: 120 }} />
                          )}
                        </td>
                        <td className="right tnum fw-6">MMK {formatMMK(l.unit)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="right fw-6">{isUpgrade ? 'Upgrade Total' : isRenewal ? 'Renewal Total' : 'Add-on Services Total'}</td>
                      <td className="right tnum fw-7">MMK {formatMMK(instanceSub)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="tbl" style={{ border: '1px solid var(--line)' }}>
                  <thead>
                    <tr style={{ background: 'oklch(0.78 0.08 250)', color: 'white' }}>
                      <th>Specification</th>
                      <th>vCPU (Cores)</th>
                      <th>RAM (GB)</th>
                      <th>Storage (GB)</th>
                      <th className="right">Unit Price (MMK)</th>
                      <th className="right">QTY</th>
                      <th>Billing Term/Month</th>
                      <th className="right">Extended Price (MMK)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Instance Cost section */}
                    <tr><td colSpan={8} className="fw-6" style={{ background: 'var(--surface-2)' }}>Instance Cost</td></tr>
                    {sheet.instance.map((l, i) => (
                      <tr key={i}>
                        <td><input value={l.spec} onChange={e => updateInstance(i, { spec: e.target.value })} /></td>
                        <td><input type="number" value={l.vcpu} onChange={e => updateInstance(i, { vcpu: +e.target.value })} style={{ width: 70 }} /></td>
                        <td><input type="number" value={l.ram} onChange={e => updateInstance(i, { ram: +e.target.value })} style={{ width: 70 }} /></td>
                        <td><input type="number" value={l.storage} onChange={e => updateInstance(i, { storage: +e.target.value })} style={{ width: 90 }} /></td>
                        <td className="right"><input type="number" value={l.unit} onChange={e => updateInstance(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                        <td className="right"><input type="number" value={l.qty} onChange={e => updateInstance(i, { qty: +e.target.value })} style={{ width: 60 }} /></td>
                        <td>
                          {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(l.term) ? (
                            <select value={l.term} onChange={e => updateInstance(i, { term: e.target.value as InstanceLine['term'] })}>
                              <option>Monthly</option>
                              <option>Quarterly</option>
                              <option>Half Yearly</option>
                              <option>Yearly</option>
                            </select>
                          ) : (
                            <input value={l.term} onChange={e => updateInstance(i, { term: e.target.value as InstanceLine['term'] })} style={{ width: 120 }} />
                          )}
                        </td>
                        <td className="right tnum fw-6">MMK {formatMMK(instExt(l))}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className="right fw-6">Instance Cost Total</td>
                      <td className="right tnum fw-7">MMK {formatMMK(instanceSub)}</td>
                    </tr>

                    {/* Public IP Cost section */}
                    <tr><td colSpan={8} className="fw-6" style={{ background: 'var(--surface-2)' }}>Public IP Cost</td></tr>
                    {sheet.publicIP.length === 0 && (
                      <tr><td colSpan={8} className="text-mute">No public IP</td></tr>
                    )}
                    {sheet.publicIP.map((l, i) => (
                      <tr key={i}>
                        <td><input value={l.spec} onChange={e => updatePublicIP(i, { spec: e.target.value })} /></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td className="right"><input type="number" value={l.unit} onChange={e => updatePublicIP(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                        <td></td>
                        <td>
                          {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(l.term) ? (
                            <select value={l.term} onChange={e => updatePublicIP(i, { term: e.target.value as PublicIPLine['term'] })}>
                              <option>Monthly</option>
                              <option>Quarterly</option>
                              <option>Half Yearly</option>
                              <option>Yearly</option>
                            </select>
                          ) : (
                            <input value={l.term} onChange={e => updatePublicIP(i, { term: e.target.value as PublicIPLine['term'] })} style={{ width: 120 }} />
                          )}
                        </td>
                        <td className="right tnum fw-6">MMK {formatMMK(publicIPExt(l))}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className="right fw-6">Public IP Total</td>
                      <td className="right tnum fw-7">MMK {formatMMK(publicIPSub)}</td>
                    </tr>

                    {/* Backup Cost section */}
                    <tr><td colSpan={8} className="fw-6" style={{ background: 'var(--surface-2)' }}>Backup Cost (GB)</td></tr>
                    {sheet.backup.length === 0 && (
                      <tr><td colSpan={8} className="text-mute">No backup lines yet</td></tr>
                    )}
                    {sheet.backup.map((l, i) => (
                      <tr key={i}>
                        <td><input value={l.spec} onChange={e => updateBackup(i, { spec: e.target.value })} /></td>
                        <td></td>
                        <td></td>
                        <td><input type="number" value={l.storage} onChange={e => updateBackup(i, { storage: +e.target.value })} style={{ width: 90 }} /></td>
                        <td className="right"><input type="number" value={l.unit} onChange={e => updateBackup(i, { unit: +e.target.value })} style={{ width: 120 }} /></td>
                        <td></td>
                        <td>
                          {['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(l.term) ? (
                            <select value={l.term} onChange={e => updateBackup(i, { term: e.target.value as BackupLine['term'] })}>
                              <option>Monthly</option>
                              <option>Quarterly</option>
                              <option>Half Yearly</option>
                              <option>Yearly</option>
                            </select>
                          ) : (
                            <input value={l.term} onChange={e => updateBackup(i, { term: e.target.value as BackupLine['term'] })} style={{ width: 120 }} />
                          )}
                        </td>
                        <td className="right tnum fw-6">MMK {formatMMK(backupExt(l))}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className="right fw-6">Backup Cost Total {backupTotalGB > 0 ? `— ${backupTotalGB}GB` : ''}</td>
                      <td className="right tnum fw-7">MMK {formatMMK(backupSub || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Totals */}
            <div className="grid-3" style={{ gap: 16, marginTop: 14 }}>
              <div />
              <div />
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card-body">
                  <div className="flex between"><div>Sub Total</div><div className="tnum fw-7">MMK {formatMMK(subTotal)}</div></div>
                  <div className="flex between mt-1" style={{ alignItems: 'center' }}>
                    <div className="flex center gap-2">
                      <div>(-) Reseller Discount</div>
                      <input
                        type="number"
                        value={sheet.discountPct}
                        onChange={e => setSheet({ ...sheet, discountPct: +e.target.value })}
                        style={{ width: 60, padding: '4px 8px', fontSize: 12 }}
                        min="0"
                        max="100"
                      />
                      <div>%</div>
                    </div>
                    <div className="tnum fw-7">MMK {formatMMK(discountAmount)}</div>
                  </div>
                  <div className="flex between mt-1">
                    <div>Net Amount</div>
                    <div className="tnum fw-7">MMK {formatMMK(netAmount)}</div>
                  </div>
                  <div className="flex between mt-1">
                    <div>(+) Commercial Tax {sheet.taxPct}%</div>
                    <div className="tnum fw-7">MMK {formatMMK(tax)}</div>
                  </div>
                  <div className="divider" />
                  <div className="flex between fw-7"><div>Grand Total</div><div className="tnum">MMK {formatMMK(grand)}</div></div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button
                className="btn"
                onClick={async () => {
                  if (!selectedCustomerId) { toast('Select a customer first', 'warn'); return }
                  if (!selectedRequestId) { toast('Select a request first', 'warn'); return }
                  const id = await addQuote({
                    vm_request_id: requestType === 'vm' ? selectedRequestId : undefined,
                    addon_request_id: requestType === 'addon' ? selectedRequestId : undefined,
                    status: 'Draft',
                    validity_date: new Date(Date.now() + 7 * 86400000).toISOString(),
                    instance_total: instanceSub,
                    public_ip_total: publicIPSub,
                    backup_total: backupSub,
                    discount_amount: discountAmount,
                    tax_amount: tax,
                    net_amount: netAmount,
                    grand_total: grand,
                    billing_term: sheet.instance[0]?.term || 'Monthly',
                    discount_pct: sheet.discountPct,
                    currency: 'MMK',
                    created_by: user?.id,
                    line_items: [
                      ...sheet.instance.map(l => ({ kind: 'instance', ...l })),
                      ...sheet.backup.map(l => ({ kind: 'backup', ...l })),
                      ...sheet.publicIP.map(l => ({ kind: 'publicIP', ...l })),
                    ],
                    notes: null,
                  })
                  toast(`Quote ${id} saved`, 'ok')
                  setBuilding(false)
                }}
              >
                Save draft
              </button>

              <button
                className="btn accent"
                onClick={async () => {
                  if (!selectedCustomerId) { toast('Select a customer first', 'warn'); return }
                  if (!selectedRequestId) { toast('Select a request first', 'warn'); return }
                  const id = await addQuote({
                    vm_request_id: requestType === 'vm' ? selectedRequestId : undefined,
                    addon_request_id: requestType === 'addon' ? selectedRequestId : undefined,
                    status: 'Sent',
                    validity_date: new Date(Date.now() + 7 * 86400000).toISOString(),
                    instance_total: instanceSub,
                    public_ip_total: publicIPSub,
                    backup_total: backupSub,
                    discount_amount: discountAmount,
                    tax_amount: tax,
                    net_amount: netAmount,
                    grand_total: grand,
                    billing_term: sheet.instance[0]?.term || 'Monthly',
                    discount_pct: sheet.discountPct,
                    currency: 'MMK',
                    created_by: user?.id,
                    line_items: [
                      ...sheet.instance.map(l => ({ kind: 'instance', ...l })),
                      ...sheet.backup.map(l => ({ kind: 'backup', ...l })),
                      ...sheet.publicIP.map(l => ({ kind: 'publicIP', ...l })),
                    ],
                    notes: null,
                  })

                  toast(`Quote ${id} prepared for Finance`, 'ok')
                  setBuilding(false)
                }}
              >
                <Icon name="mail" size={12} />Send to Finance
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => setBuilding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body flush">
          <table className="tbl">
            <thead><tr><th>Quote #</th><th>Customer</th><th>Type</th><th>Request</th><th>Billing Term</th><th className="right">Lines</th><th className="right">Total</th><th>Valid until</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {quotes.map(q => {
                const cust = customers.find(c => c.id === q.customer_id)
                const request = vmRequests.find(r => r.id === q.vm_request_id)
                const addonReq = addonRequests.find(a => a.id === (q as any).addon_request_id)
                const isAddon = !!(q as any).addon_request_id
                const requestHostname = isAddon ? addonReq?.description : request?.hostname || request?.sizing || '—'
                return (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedQuote(q)}>
                    <td className="mono fw-6">{q.legacy_id || q.id.slice(0, 8)}</td>
                    <td>{cust?.org_name || cust?.name || '—'}</td>
                    <td><span className="pill subtle"><span className="dot" />{isAddon ? 'Add-on' : (request?.task_type || 'new')}</span></td>
                    <td>{requestHostname}</td>
                    <td>{q.billing_term || 'Monthly'}</td>
                    <td className="right tnum">{(q.line_items || []).length}</td>
                    <td className="right tnum fw-6">MMK {formatMMK(q.grand_total || 0)}</td>
                    <td className="tnum text-sm">{new Date(q.validity_date).toLocaleDateString()}</td>
                    <td><span className={`pill ${q.status === 'Accepted' ? 'ok' : q.status === 'Sent' ? 'accent' : 'subtle'}`}><span className="dot" />{q.status}</span></td>
                    <td className="right" onClick={e => e.stopPropagation()}><button className="btn sm" onClick={async () => {
                  const cust = customers.find(c => c.id === q.customer_id)
                  const request = vmRequests.find(r => r.id === q.vm_request_id)
                  await exportQuoteToPDF(q, cust, request)
                }}><Icon name="download" size={11} />PDF</button></td>
                  </tr>
                )
              })}
              {quotes.length === 0 && <tr><td colSpan={10}><div className="empty"><div className="title">No quotes yet</div><div className="sub">Create your first quote to get started.</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {selectedQuote && <QuoteDrawer quote={selectedQuote} onClose={() => setSelectedQuote(null)} />}
    </div>
  )
}

export default QuotesView
