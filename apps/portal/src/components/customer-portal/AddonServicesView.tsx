import React, { useState, useMemo } from 'react'
import Icon from '../../lib/icons'
import { IaaSCard } from './VMHelperComponents'
import { useAddonRequestStore } from '../../store/addonRequestStore'
import useUIStore from '../../store/uiStore'

interface AddonServicesViewProps {
  myVMs: any[]
}

export const AddonServicesView: React.FC<AddonServicesViewProps> = ({ myVMs }) => {
  const { createAddonRequest, addonRequests } = useAddonRequestStore()
  const { toast } = useUIStore()
  const [selectedVM, setSelectedVM] = useState<string>('')
  const [cpfsEnabled, setCpfsEnabled] = useState(false)
  const [cpfsPackage, setCpfsPackage] = useState<'standard' | 'premium'>('standard')
  const [ccisEnabled, setCcisEnabled] = useState(false)
  const [ccisPlan, setCcisPlan] = useState<'basic' | 'standard' | 'professional' | 'enterprise' | undefined>(undefined)
  const [duration, setDuration] = useState<string>('12')
  const [remainingDuration, setRemainingDuration] = useState<{ months: number; days: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Filter out expired and terminated VMs
  const activeVMs = useMemo(() => {
    return myVMs.filter((vm: any) => {
      if (!vm.expiry || vm.expiry === '—') return vm.status !== 'Terminated' // Show VMs without expiry only if not terminated
      const expiryDate = new Date(vm.expiry)
      const today = new Date()
      return expiryDate >= today && vm.status !== 'Terminated'
    })
  }, [myVMs])

  // Get existing addon requests for selected VM (Completed status means active, and not terminated)
  const existingAddons = useMemo(() => {
    return addonRequests.filter(a => 
      a.vm_id === selectedVM && 
      a.status === 'Completed' &&
      a.operational_status !== 'Terminated'
    )
  }, [addonRequests, selectedVM])

  // Calculate remaining duration from VM expiry
  const calculateRemainingDuration = (vm: any) => {
    if (!vm.expiry) return null

    const today = new Date()
    const expiryDate = new Date(vm.expiry)

    if (isNaN(expiryDate.getTime())) return null

    // Calculate exact months and days using actual calendar
    let months = expiryDate.getMonth() - today.getMonth()
    let years = expiryDate.getFullYear() - today.getFullYear()
    let days = expiryDate.getDate() - today.getDate()

    if (days < 0) {
      months -= 1
      const previousMonth = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), 0)
      days += previousMonth.getDate()
    }

    if (months < 0) {
      years -= 1
      months += 12
    }

    const totalMonths = years * 12 + months

    // Convert excess days to months (if days > 28, add a month)
    if (days > 28) {
      const extraMonths = Math.floor(days / 30)
      return { months: totalMonths + extraMonths, days: days % 30 }
    }

    return { months: totalMonths, days }
  }

  // When VM is selected, calculate remaining duration and pre-populate form
  React.useEffect(() => {
    if (selectedVM) {
      const vm = activeVMs.find((v: any) => v.id === selectedVM)
      if (vm) {
        const remaining = calculateRemainingDuration(vm)
        setRemainingDuration(remaining)

        if (remaining && remaining.months > 0) {
          setDuration(`${remaining.months} months`)
        } else {
          setDuration('12 months')
        }
      }

      const currentExistingAddons = addonRequests.filter(a => 
        a.vm_id === selectedVM && 
        a.status === 'Completed' &&
        a.operational_status !== 'Terminated'
      )
      if (currentExistingAddons.length > 0) {
        const latestAddon = currentExistingAddons[0]
        setCpfsEnabled(latestAddon.cpfs_enabled || false)
        if (latestAddon.cpfs_enabled) {
          setCpfsPackage(latestAddon.cpfs_package || 'standard')
        }
        setCcisEnabled(latestAddon.ccis_enabled || false)
        if (latestAddon.ccis_enabled) {
          setCcisPlan(latestAddon.ccis_package as 'basic' | 'standard' | 'professional' | 'enterprise')
        }
        setDuration(latestAddon.duration || '12 months')
      } else {
        setCpfsEnabled(false)
        setCcisEnabled(false)
      }
    } else {
      setRemainingDuration(null)
      setCpfsEnabled(false)
      setCcisEnabled(false)
      setDuration('12 months')
    }
  }, [selectedVM, activeVMs, addonRequests])

  const canSubmit = () => {
    if (!selectedVM || (!cpfsEnabled && !ccisEnabled)) return false
    
    // If no existing add-ons, allow submission
    if (existingAddons.length === 0) return true
    
    // Compare with existing add-ons to detect changes
    const latestAddon = existingAddons[0]
    const hasChanges = 
      cpfsEnabled !== latestAddon.cpfs_enabled ||
      (cpfsEnabled && cpfsPackage !== latestAddon.cpfs_package) ||
      ccisEnabled !== latestAddon.ccis_enabled ||
      (ccisEnabled && ccisPlan !== latestAddon.ccis_package) ||
      duration !== latestAddon.duration
    
    return hasChanges
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Add-on Services</h1>
          <p className="page-subtitle">Enhance your VM with additional security and performance services</p>
        </div>
      </div>

      {/* VM Selection */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3 className="card-title">Select VM</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {activeVMs.map((vm: any) => (
              <IaaSCard key={vm.id} selected={selectedVM === vm.id} onClick={() => setSelectedVM(vm.id)} padding={14 as any}>
                <div className="flex center between mb-2">
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    <Icon name="server" size={18}/>
                  </div>
                  {selectedVM === vm.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                </div>
                <div className="fw-7 text-sm">{vm.hostname}</div>
                <div className="text-xs text-mute mono">{vm.legacy_id || vm.id}</div>
                <div className="text-xs mt-2"><span className="text-mute">Status:</span> <span className={`fw-6 ${vm.status === 'Active' ? 'text-ok' : 'text-mute'}`}>{vm.status}</span></div>
              </IaaSCard>
            ))}
            {activeVMs.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: 'var(--ink-2)' }}>
                <div className="text-sm">No active VMs available</div>
                <div className="text-xs text-mute mt-1">Expired VMs are not eligible for add-on services</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Duration Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3 className="card-title">Billing Term</h3></div>
        <div className="card-body">
          <div>
            {selectedVM && remainingDuration ? (
              <div style={{ padding: 12, background: 'var(--accent-soft)', borderRadius: 6, border: '1px solid var(--accent)' }}>
                <div className="text-sm fw-6" style={{ color: 'var(--accent-strong)' }}>
                  {remainingDuration.days > 0 
                    ? `${remainingDuration.months} months ${remainingDuration.days} days` 
                    : `${remainingDuration.months} months`}
                </div>
                <div className="text-xs text-mute mt-1">Remaining duration based on VM expiry</div>
              </div>
            ) : selectedVM && !remainingDuration ? (
              <div style={{ padding: 12, background: 'var(--warn-soft)', borderRadius: 6, border: '1px solid oklch(0.55 0.16 75)' }}>
                <div className="text-sm fw-6" style={{ color: 'oklch(0.4 0.13 75)' }}>
                  VM has no expiry date
                </div>
                <div className="text-xs text-mute mt-1">Duration will be set to 12 months by default</div>
              </div>
            ) : (
              <div className="text-sm text-mute">Select a VM to see the remaining duration</div>
            )}
          </div>
        </div>
      </div>

      {/* CPFS Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="card-title">CPFS (Cloud Protection Firewall Service)</h3>
          <span className={`toggle ${cpfsEnabled ? 'on' : ''}`} onClick={() => setCpfsEnabled(!cpfsEnabled)}/>
        </div>
        {cpfsEnabled && (
          <div className="card-body">
            <div className="grid-2" style={{ gap: 12 }}>
              {/* Standard Package */}
              <IaaSCard selected={cpfsPackage === 'standard'} onClick={() => setCpfsPackage('standard')} padding={16 as any}>
                <div className="flex center between mb-2">
                  <h4 className="fw-6">CPFS - Standard Package</h4>
                  {cpfsPackage === 'standard' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)' }}>
                  <li>1000 concurrent sessions per second</li>
                  <li>Weekly Report</li>
                </ul>
              </IaaSCard>

              {/* Premium Package */}
              <IaaSCard selected={cpfsPackage === 'premium'} onClick={() => setCpfsPackage('premium')} padding={16 as any}>
                <div className="flex center between mb-2">
                  <h4 className="fw-6">CPFS - Premium Package</h4>
                  {cpfsPackage === 'premium' && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
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

      {/* CCIS Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="card-title">CCIS (Cloud Content Inspection Service)</h3>
          <span className={`toggle ${ccisEnabled ? 'on' : ''}`} onClick={() => setCcisEnabled(!ccisEnabled)}/>
        </div>
        {ccisEnabled && (
          <div className="card-body">
            <div className="grid-4" style={{ gap: 12 }}>
              {[
                { id: 'basic', name: 'Basic Plan', mb: '100 MB' },
                { id: 'standard', name: 'Standard Plan', mb: '500 MB' },
                { id: 'professional', name: 'Professional Plan', mb: '1 GB' },
                { id: 'enterprise', name: 'Enterprise Plan', mb: '5 GB' },
              ].map((plan) => (
                <IaaSCard key={plan.id} selected={ccisPlan === plan.id} onClick={() => setCcisPlan(plan.id as 'basic' | 'standard' | 'professional' | 'enterprise')} padding={16 as any}>
                  <div className="flex center between mb-2">
                    <div className="fw-6 text-sm">{plan.name}</div>
                    {ccisPlan === plan.id && <Icon name="check" size={14} style={{ color: 'var(--accent-strong)' }}/>}
                  </div>
                  <div className="text-mute text-xs">{plan.mb}</div>
                </IaaSCard>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Existing Add-on Requests */}
      {selectedVM && existingAddons.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3 className="card-title">Active Add-on Services</h3></div>
          <div className="card-body">
            {existingAddons.map((addon) => (
              <div key={addon.id} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6, marginBottom: 8, border: '1px solid var(--line)' }}>
                <div className="flex center between mb-2">
                  <div className="fw-6 text-sm">
                    {addon.cpfs_enabled && 'CPFS'}{addon.cpfs_enabled && addon.ccis_enabled && ' + '}{addon.ccis_enabled && 'CCIS'}
                  </div>
                  <span className="pill ok"><span className="dot" />Active</span>
                </div>
                <div className="grid-2" style={{ gap: 8 }}>
                  {addon.cpfs_enabled && <div className="text-xs text-mute">CPFS: {addon.cpfs_package}</div>}
                  {addon.ccis_enabled && <div className="text-xs text-mute">CCIS: {addon.ccis_package}</div>}
                  <div className="text-xs text-mute">Duration: {addon.duration}</div>
                  {addon.start_date && <div className="text-xs text-mute">Start: {new Date(addon.start_date).toLocaleDateString()}</div>}
                  {addon.expiry && <div className="text-xs text-mute">Expiry: {new Date(addon.expiry).toLocaleDateString()}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex center" style={{ gap: 10, paddingTop: 8, marginTop: 24 }}>
        <div style={{ flex: 1 }}/>
        <button className="btn accent" onClick={async () => {
          try {
            setSubmitting(true)
            console.log('Submitting add-on request:', { selectedVM, cpfsEnabled, cpfsPackage, ccisEnabled, ccisPlan, duration, remainingDuration })
            const vm = myVMs.find((v: any) => v.id === selectedVM)
            console.log('Selected VM:', vm)
            console.log('Customer ID from VM:', vm?.customer_id)
            
            // Format duration as text with months and days
            let durationText = ''
            if (remainingDuration) {
              durationText = remainingDuration.days > 0 
                ? `${remainingDuration.months} months ${remainingDuration.days} days` 
                : `${remainingDuration.months} months`
            } else {
              durationText = `${duration} months`
            }
            
            // Calculate start_date, end_date, and expiry for addon request using VM's start_date
            const vmStartDate = vm?.start_date ? new Date(vm.start_date) : new Date()
            vmStartDate.setDate(vmStartDate.getDate() + 1) // Add 1 day to match VM logic
            
            // Parse duration to get months and days
            const durationMonths = remainingDuration ? remainingDuration.months : parseInt(duration)
            const durationDays = remainingDuration ? remainingDuration.days : 0
            
            const expiryDate = new Date(vmStartDate)
            expiryDate.setMonth(expiryDate.getMonth() + durationMonths)
            expiryDate.setDate(expiryDate.getDate() + durationDays)
            
            const addonRequest = {
              customer_id: vm?.customer_id,
              vm_id: selectedVM,
              cpfs_enabled: cpfsEnabled,
              cpfs_package: cpfsEnabled ? cpfsPackage : undefined,
              ccis_enabled: ccisEnabled,
              ccis_package: ccisEnabled ? ccisPlan : undefined,
              duration: durationText,
              start_date: vm?.start_date || new Date().toISOString(),
              end_date: expiryDate.toISOString(),
              expiry: expiryDate.toISOString(),
              status: 'Pending' as 'Pending',
            }
            console.log('Add-on request data:', addonRequest)
            await createAddonRequest(addonRequest)
            
            toast('Add-on request submitted successfully', 'ok')
            setSelectedVM('')
            setCpfsEnabled(false)
            setCcisEnabled(false)
            setDuration('12 months')
          } catch (error: any) {
            console.error('Error submitting add-on request:', error)
            console.error('Error details:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            })
            toast('Failed to submit add-on request: ' + (error.message || 'Unknown error'), 'error')
          } finally {
            setSubmitting(false)
          }
        }} disabled={!canSubmit() || submitting} style={{ padding: '10px 18px', fontSize: 13 }}>
          {submitting ? <Icon name="spinner" size={13} /> : <Icon name="check" size={13}/>}
          {submitting ? 'Submitting...' : 'Submit add-on request'}
        </button>
      </div>
    </div>
  )
}
