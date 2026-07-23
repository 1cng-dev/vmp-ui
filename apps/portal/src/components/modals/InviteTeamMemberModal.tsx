import React, { useState } from 'react'
import Icon from '../../lib/icons'
import { useTeamStore } from '../../store/TeamContext'
import useUIStore from '../../store/uiStore'

interface InviteTeamMemberModalProps {
  onClose: () => void
  onSuccess?: () => void
}

const InviteTeamMemberModal: React.FC<InviteTeamMemberModalProps> = ({ onClose, onSuccess }) => {
  const { addMember } = useTeamStore()
  const { toast } = useUIStore()
  const [f, setF] = useState({ name: '', email: '', role: 'Sales', team: 'Sales' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const submit = async () => {
    setLoading(true)
    try {
      const result = await addMember(f)
      setTempPassword(result.password)
      setShowSuccess(true)
      toast('Team member added successfully', 'ok')
      onSuccess?.()
    } catch (error) {
      toast('Failed to add team member', 'error')
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPassword)
    toast('Password copied to clipboard', 'ok')
  }

  const handleClose = () => {
    setShowSuccess(false)
    setTempPassword('')
    onClose()
  }

  if (showSuccess) {
    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="modal-head">
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Team member added</h3>
            <button className="icon-btn" onClick={handleClose}><Icon name="x" size={14} /></button>
          </div>
          <div className="modal-body">
            <div className="text-center">
              <Icon name="check-circle" size={48} style={{ color: 'var(--ok)', marginBottom: 16 }} />
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{f.name} has been added to the team</h4>
              <p className="text-sm text-mute mt-2">Share these credentials with them:</p>
              
              <div className="card mt-3" style={{ background: 'var(--bg-soft)' }}>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="flex col gap-2">
                    <div className="text-xs text-mute">Email</div>
                    <div className="fw-6 text-sm">{f.email}</div>
                    <div className="text-xs text-mute mt-1">Temporary Password</div>
                    <div className="flex center between">
                      <div className="fw-6 text-sm mono" style={{ fontFamily: 'monospace' }}>
                        {showPassword ? tempPassword : '••••••••••••'}
                      </div>
                      <div className="flex gap-1">
                        <button className="icon-btn" onClick={() => setShowPassword(!showPassword)}>
                          <Icon name={showPassword ? 'eye-off' : 'eye'} size={14} />
                        </button>
                        <button className="icon-btn" onClick={copyPassword}>
                          <Icon name="copy" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-mute mt-3">They can log in with these credentials and change their password later.</p>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn primary" onClick={handleClose} style={{ width: '100%' }}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Add team member</h3>
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
          <button className="btn accent" disabled={!f.name || !f.email || loading} onClick={submit}><Icon name="plus" size={12} />{loading ? 'Adding...' : 'Add member'}</button>
        </div>
      </div>
    </div>
  )
}

export default InviteTeamMemberModal
