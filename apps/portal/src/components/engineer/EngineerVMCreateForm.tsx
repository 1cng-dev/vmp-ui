import { useState, useEffect } from 'react'
import Icon from '../../lib/icons'
import type { Task } from '../../types'

interface EngineerVMCreateFormProps {
  task: Task
  onSubmit: (details: {
    publicIps: string[]
    privateIps: string[]
    username: string
    password: string
  }) => void
}

const EngineerVMCreateForm = ({ task, onSubmit }: EngineerVMCreateFormProps) => {
  const qty = task.qty || 1
  const [publicIps, setPublicIps] = useState<string[]>(() => Array(qty).fill(''))
  const [privateIps, setPrivateIps] = useState<string[]>(() => Array(qty).fill(''))
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')

  useEffect(() => {
    setPublicIps(Array(qty).fill(''))
    setPrivateIps(Array(qty).fill(''))
  }, [qty])

  const handlePublicIpChange = (index: number, value: string) => {
    const newIps = [...publicIps]
    newIps[index] = value
    setPublicIps(newIps)
  }

  const handlePrivateIpChange = (index: number, value: string) => {
    const newIps = [...privateIps]
    newIps[index] = value
    setPrivateIps(newIps)
  }

  const handleSubmit = () => {
    if (!username || !password) {
      alert('Please fill in username and password')
      return
    }
    if (publicIps.some(ip => !ip) || privateIps.some(ip => !ip)) {
      alert('Please fill in all IP fields')
      return
    }
    onSubmit({ publicIps, privateIps, username, password })
  }

  return (
    <div className="flex col gap-4">
      <div className="text-sm text-mute">
        <div><strong>Request:</strong> {task.hostname}</div>
        <div><strong>Configuration:</strong> {task.task_type || 'new'} · {qty} VM{qty > 1 ? 's' : ''} · {task.vcpu} vCPU · {task.ram}GB RAM · {task.storage}GB Storage</div>
      </div>

      {Array.from({ length: qty }).map((_, i) => (
        <div key={i} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 4 }}>
          <div className="fw-6 mb-3" style={{ fontSize: 14 }}>VM #{i + 1}: {task.hostname}-{i + 1}</div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Public IP</label>
              <input
                type="text"
                className="input"
                value={publicIps[i] ?? ''}
                onChange={e => handlePublicIpChange(i, e.target.value)}
                placeholder="e.g., 203.0.113.1"
              />
            </div>
            <div className="field">
              <label>Private IP</label>
              <input
                type="text"
                className="input"
                value={privateIps[i] ?? ''}
                onChange={e => handlePrivateIpChange(i, e.target.value)}
                placeholder="e.g., 10.0.0.1"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label>Username (shared for all VMs)</label>
          <input
            type="text"
            className="input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="e.g., root"
          />
        </div>
        <div className="field">
          <label>Password (shared for all VMs)</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Initial password"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn primary" onClick={handleSubmit}>
          <Icon name="check" size={12} />Create VM Records
        </button>
      </div>
    </div>
  )
}

export default EngineerVMCreateForm