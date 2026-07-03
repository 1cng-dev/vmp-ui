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
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))

  const submit = async () => {
    setLoading(true)
    try {
      await addMember(f)
      toast(`Invite sent to ${f.email}`, 'ok')
      onSuccess?.()
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

export default InviteTeamMemberModal
