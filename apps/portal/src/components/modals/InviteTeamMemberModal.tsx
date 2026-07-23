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
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Team Member Added Successfully</h3>
            <button className="icon-btn" onClick={handleClose}><Icon name="x" size={14} /></button>
          </div>
          <div className="modal-body">
            <div className="flex col gap-3">
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--ok-soft)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Icon name="check" size={32} />
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{f.name}</h3>
                <p className="text-sm text-mute mt-1">{f.email}</p>
                <div className="flex gap-2 mt-2" style={{ justifyContent: 'center' }}>
                  <span className="pill subtle" style={{ fontSize: 11 }}>{f.role}</span>
                  <span className="pill subtle" style={{ fontSize: 11 }}>{f.team}</span>
                </div>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8 }}>
                <div className="text-sm fw-6 mb-2">Temporary Password</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'var(--surface-3)', padding: 12, borderRadius: 6, fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, letterSpacing: 2, textAlign: 'center' }}>
                    {showPassword ? tempPassword : '••••••••••••'}
                  </div>
                  <div onClick={() => setShowPassword(!showPassword)} style={{ padding: '12px', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e5e7eb', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                    <Icon name={showPassword ? "eye-off" : "eye"} size={14} />
                  </div>
                  <div onClick={copyPassword} style={{ padding: '12px', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e5e7eb', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                    <Icon name="copy" size={14} />
                  </div>
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 6, fontSize: 12, color: 'var(--info)' }}>
                <div className="flex gap-2">
                  <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Important:</strong> Share this temporary password with the team member. They will need to change their password on first login at /admin.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn primary" onClick={handleClose} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}>Done</button>
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
