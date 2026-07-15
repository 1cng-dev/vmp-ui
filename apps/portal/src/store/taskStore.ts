import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

export interface TaskStoreValue {
  tasks: Task[]
  addTask: (t: any) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
  moveTask: (id: string, to: number) => void
  advanceProvision: (id: string, parsedSpec?: any, addVM?: (vm: any) => string, updateVM?: (id: string, patch: any) => void) => void
  createVMManually: (taskId: string, vmDetails: {
    publicIps: string[]
    privateIps: string[]
    assigned_vmids: number[]
    username: string
    password: string
  }, addVM: (vm: any) => Promise<string>) => Promise<void>
  setTasks: (tasks: Task[]) => void
  updateVMExpiryForRequest: (vmRequestId: string, durationMonths?: number, updateVM?: (id: string, patch: any) => Promise<void>) => Promise<void>
}

const useTaskStore = (): TaskStoreValue => {
  const [tasks, setTasks] = useState<Task[]>([])

  const addTask = useCallback((t: any) => {
    const id = `TSK-${3300 + Math.floor(Math.random() * 600)}`
    const newT = {
      id, status: 'Pending', priority: 'Normal', assignee: '—', team: 'Provisioning',
      created: new Date().toISOString().slice(0, 10),
      notes: '',
      ...t,
    }
    setTasks(s => [newT, ...s])
    return id
  }, [])

  const updateTask = useCallback((id: string, patch: any) => {
    setTasks(s => s.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const advanceProvision = useCallback((id: string, parsedSpec?: any, addVM?: (vm: any) => string, updateVM?: (id: string, patch: any) => void) => {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const stage = (t.wfStage || 0) + 1
    const notes: any = {
      1: { team: 'Sales', msg: `Sales reviewing ${t.id} — KYC check in progress`, kind: 'task', status: 'In Progress' },
      2: { team: 'Engineering', msg: `KYC approved — Engineering notified`, kind: 'customer', status: 'In Progress' },
      3: { team: 'Engineer', msg: `Engineer creating VM in Proxmox`, kind: 'vm', status: 'In Progress' },
      4: { team: 'Network', msg: `Network team configuring firewall rules`, kind: 'vm', status: 'In Progress' },
      5: { team: 'Engineering', msg: `Testing VM & uploading credentials`, kind: 'vm', status: 'In Progress' },
      6: { team: 'Customer', msg: `VM is ready — customer notified ✓`, kind: 'customer', status: 'Done' },
    }[stage]

    let patch: any = { wfStage: stage, status: notes?.status || t.status }


    if (stage === 6 && t.createdVmId && updateVM) {
      updateVM(t.createdVmId, { status: 'Active' })
    }

    setTasks(s => s.map(x => x.id === id ? { ...x, ...patch } : x))
  }, [tasks])

  const createVMManually = useCallback(async (task: any, vmDetails: {
    publicIps: string[]
    privateIps: string[]
    assigned_vmids: number[]
    username: string
    password: string
  }, addVM: (vm: any) => Promise<string>) => {
    console.log('createVMManually called with task:', task, 'vmDetails:', vmDetails)
    const t = task
    if (!t) {
      console.error('Task is null/undefined')
      return
    }
    console.log('Processing task:', t)
    
    // Calculate expiry using VM's created_at (service provision date)
    // Formula: created_at + 1 day + duration (in months)
    let expiry: string | undefined
    
    if (t.created_at && t.duration) {
      const startDate = new Date(t.created_at)
      startDate.setDate(startDate.getDate() + 1) // Add 1 day
      
      // Duration is in months (integer)
      const durationMonths = parseInt(String(t.duration)) || 3
      
      const expiryDate = new Date(startDate)
      expiryDate.setMonth(expiryDate.getMonth() + durationMonths)
      
      expiry = expiryDate.toISOString()
      
      console.log('Expiry calculated:', {
        created_at: t.created_at,
        startDate,
        duration: t.duration,
        durationMonths,
        expiry
      })
    } else {
      console.log('No created_at or duration found in task, expiry will be null')
      console.log('Task object keys:', Object.keys(t))
    }
    
    const qty = t.qty || 1
    const vmIds: string[] = []

    // Generate legacy_id for VMs (format: VM-XXXX)
    const { data: existingVMs } = await supabase
      .from('vms')
      .select('legacy_id')
      .order('created_at', { ascending: false })
      .limit(1)
    
    const lastLegacyId = existingVMs?.[0]?.legacy_id
    let nextNum = 1001
    if (lastLegacyId) {
      const match = lastLegacyId.match(/VM-(\d+)/)
      if (match) {
        nextNum = parseInt(match[1]) + 1
      }
    }

    for (let i = 0; i < qty; i++) {
      const legacyId = `VM-${nextNum + i}`
      const vmData = {
        hostname: `${t.hostname}-${i + 1}`,
        public_ip: vmDetails.publicIps[i] || vmDetails.publicIps[0],
        private_ip: vmDetails.privateIps[i] || vmDetails.privateIps[0],
        username: vmDetails.username,
        password: vmDetails.password,
        vcpu: t.vcpu,
        ram_gb: t.ram,
        storage_gb: t.storage,
        status: 'Active',
        power_state: 'Running',
        customer_id: t.customer_id,
        vm_request_id: t.id,
        task_type: t.task_type,
        expiry: expiry,
        duration: t.duration,
        legacy_id: legacyId,
        assigned_vmid: vmDetails.assigned_vmids[i] || null,
        backup_enabled: t.backup_enabled || false,
        backup_type: t.backup_type || 'weekly',
      }
      console.log(`About to call addVM for VM ${i + 1}:`, vmData)
      try {
        const vmId = await addVM(vmData)
        console.log(`addVM returned ID for VM ${i + 1}:`, vmId)
        vmIds.push(vmId)
      } catch (error: any) {
        console.error(`Error calling addVM for VM ${i + 1}:`, error)
        throw error
      }
    }

    console.log('All VMs created with IDs:', vmIds)
  }, [])

  // Function to update VM expiry when quotation is created
  const updateVMExpiryForRequest = useCallback(async (vmRequestId: string, durationMonths: number = 3, updateVM?: (id: string, patch: any) => Promise<void>) => {
    console.log('updateVMExpiryForRequest called:', { vmRequestId, durationMonths })
    
    // Get VMs for this request to get their created_at
    const { data: vms } = await supabase
      .from('vms')
      .select('id, created_at')
      .eq('vm_request_id', vmRequestId)
    
    if (vms && vms.length > 0) {
      console.log(`Found ${vms.length} VMs to update expiry for`)
      // Update each VM with expiry calculated from its created_at
      for (const vm of vms) {
        if (vm.created_at) {
          // Calculate expiry: created_at + 1 day + duration
          const startDate = new Date(vm.created_at)
          startDate.setDate(startDate.getDate() + 1)
          const expiryDate = new Date(startDate)
          expiryDate.setMonth(expiryDate.getMonth() + durationMonths)
          const expiry = expiryDate.toISOString()
          
          if (updateVM) {
            await updateVM(vm.id, { expiry })
          } else {
            await supabase.from('vms').update({ expiry }).eq('id', vm.id)
          }
          console.log(`Updated VM ${vm.id} with expiry ${expiry}`)
        }
      }
    } else {
      console.log('No VMs found for this request')
    }
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks(s => s.filter(t => t.id !== id))
  }, [])

  const moveTask = useCallback((id: string, status: string) => {
    const t = tasks.find(t => t.id === id)
    if (!t || t.status === status) return
    updateTask(id, { status })
  }, [tasks, updateTask])

  return {
    tasks,
    addTask, updateTask, deleteTask, moveTask, advanceProvision, createVMManually, setTasks, updateVMExpiryForRequest,
  }
}

export default useTaskStore
