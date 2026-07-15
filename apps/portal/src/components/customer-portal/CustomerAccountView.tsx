import React, { useState } from 'react'
import { useCustomers } from '../../store/customerStore'
import { useVMs } from '../../store/vmStore'
import { useTickets } from '../../store/ticketStore'
import useUIStore from '../../store/uiStore'
import { Avatar, formatMMK } from '../ui/ui'
import Icon from '../../lib/icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../auth/Auth'

interface CustomerAccountViewProps {
  me: any
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({ me }) => {
  const { updateCustomer } = useCustomers()
  const { vms } = useVMs()
  const { tickets } = useTickets()
  const { toast } = useUIStore()
  const { signout } = useAuth() || { signout: () => { } }

  // Calculate MRR from active VMs
  const customerVMs = vms.filter((v: any) => v.customer_id === me.id)
  const mrr = customerVMs.filter((v: any) => v.status === 'Active').reduce((a: number, v: any) => a + (v.priceMonth || 0), 0)

  // Calculate open tickets - recalculate when tickets change
  const openTickets = React.useMemo(() => {
    const customerTickets = tickets.filter((t: any) => {
      const customerId = t.customer || t.customer_id
      return customerId === me.id
    })
    return customerTickets.filter((t: any) => {
      const status = t.status?.toLowerCase()
      return status === 'open' || status === 'in progress'
    }).length
  }, [tickets, me.id])

  const [profile, setProfile] = useState({
    name: me.name,
    email: me.email,
    phone: me.phone,
    altPhone: me.alt_phone || ''
  })

  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const saveProfile = async () => {
    try {
      await updateCustomer(me.id, {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        alt_phone: profile.altPhone
      })
      toast('Profile updated', 'ok')
    } catch (error) {
      toast('Failed to update profile', 'bad')
      console.error('Profile update error:', error)
    }
  }

  const savePassword = async () => {
    if (!security.currentPassword) return toast('Enter current password', 'warn')
    if (security.newPassword.length < 8) return toast('Password must be at least 8 characters', 'warn')
    if (!/[A-Z]/.test(security.newPassword)) return toast('Password must contain at least one uppercase letter', 'warn')
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(security.newPassword)) return toast('Password must contain at least one special character', 'warn')
    if (security.newPassword !== security.confirmPassword) return toast('Passwords do not match', 'bad')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        toast('Unable to verify user email', 'bad')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: security.currentPassword
      })

      if (signInError) {
        toast('Current password is incorrect', 'bad')
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: security.newPassword
      })
      if (error) throw error
      setSecurity(s => ({ ...s, currentPassword: '', newPassword: '', confirmPassword: '' }))
      toast('Password changed successfully', 'ok')
    } catch (error) {
      toast('Failed to change password', 'bad')
      console.error('Password update error:', error)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Account settings</h1>
          <p className="page-subtitle">Manage your profile and security settings</p>
        </div>
      </div>

      {/* Identity header */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex center gap-3">
            <Avatar name={profile.name} size={64} />
            <div style={{ flex: 1 }}>
              <div className="fw-7" style={{ fontSize: 18 }}>{profile.name}</div>
              <div className="text-sm text-mute">Customer</div>
              <div className="text-xs text-mute mt-1">{profile.email}</div>
              <div className="flex gap-3 mt-1">
                {me.totalSpend !== undefined && (
                  <div className="text-xs" style={{ color: 'var(--accent)' }}>
                    Lifetime: MMK {formatMMK(me.totalSpend)}
                  </div>
                )}
                {mrr > 0 && (
                  <div className="text-xs" style={{ color: 'var(--ok)' }}>
                    Monthly Recurring: MMK {formatMMK(mrr)}
                  </div>
                )}
                {openTickets > 0 && (
                  <div className="text-xs" style={{ color: 'var(--bad)' }}>
                    Open issues: {openTickets} tickets
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn danger" onClick={signout}><Icon name="logout" size={12} />Sign out</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Profile */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Profile</h3>
            <button className="btn sm accent" onClick={saveProfile}><Icon name="check" size={11} />Save profile</button>
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="field"><label>Full name</label><input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
              <div className="field"><label>Email</label><input type="email" value={profile.email} disabled className='disabled' /></div>
              <div className="field"><label>Phone</label><input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
              <div className="field"><label>Alt phone</label><input value={profile.altPhone} onChange={e => setProfile({ ...profile, altPhone: e.target.value })} style={{ fontFamily: 'var(--mono)' }} /></div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Security</h3>
          </div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="text-xs text-mute fw-6" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Change password</div>
              <div className="field">
                <label>Current password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={security.currentPassword}
                    onChange={e => setSecurity({ ...security, currentPassword: e.target.value })}
                    placeholder="••••••••"
                    style={{ paddingRight: 36, width: '100%' }}
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowCurrentPw(!showCurrentPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                    <Icon name="eye" size={13} />
                  </button>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={security.newPassword}
                      onChange={e => setSecurity({ ...security, newPassword: e.target.value })}
                      placeholder="At least 8 chars, 1 uppercase, 1 special"
                      style={{ paddingRight: 36, width: '100%' }}
                    />
                    <button type="button" className="icon-btn" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                      <Icon name="eye" size={13} />
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label>Confirm new</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={security.confirmPassword}
                      onChange={e => setSecurity({ ...security, confirmPassword: e.target.value })}
                      style={{ paddingRight: 36, width: '100%' }}
                    />
                    <button type="button" className="icon-btn" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                      <Icon name="eye" size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <button className="btn" onClick={savePassword}><Icon name="key" size={12} />Update password</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}