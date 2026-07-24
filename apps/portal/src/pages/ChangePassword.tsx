import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { supabase } from '../lib/supabase'
import { AuthLayout } from '../components/auth/shared/AuthLayout'
import { useSystemSettingsStore } from '../store/systemSettingsStore'

const ChangePasswordPage: React.FC = () => {
  const { toast } = useUIStore()
  const navigate = useNavigate()
  const [f, setF] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)

    // Validation
    if (f.newPassword.length < 8) {
      toast('Password must be at least 8 characters', 'bad')
      setLoading(false)
      return
    }
    if (f.newPassword.length > 64) {
      toast('Password must be at most 64 characters', 'bad')
      setLoading(false)
      return
    }
    if (!/[A-Z]/.test(f.newPassword)) {
      toast('Password must contain at least one uppercase letter', 'bad')
      setLoading(false)
      return
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(f.newPassword)) {
      toast('Password must contain at least one special character', 'bad')
      setLoading(false)
      return
    }
    if (f.newPassword !== f.confirmPassword) {
      toast('Passwords do not match', 'bad')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast('User not found', 'bad')
        setLoading(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: f.newPassword
      })

      if (updateError) throw updateError

      // Clear force_password_change flag
      const { error: customerError } = await supabase
        .from('customers')
        .update({ force_password_change: false })
        .eq('id', user.id)

      if (customerError) throw customerError

      toast('Password changed successfully', 'ok')
      navigate('/')
    } catch (error: any) {
      toast(error.message || 'Failed to change password', 'bad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div className="text-center mb-4">
          {(() => { const { settings } = useSystemSettingsStore(); return settings?.logo_url ? (
            <img src={`${settings.logo_url}?v=${settings.updated_at}`} alt="Logo" style={{ width: 96, height: 96, objectFit: 'contain', margin: '0 auto 16px', display: 'block', borderRadius: 12 }} />
          ) : (
            <div className="brand-mark" style={{ width: 96, height: 96, fontSize: 36, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
          )})()}
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Change your password</h1>
          <p className="text-sm text-mute mt-2">You need to change your password to continue</p>
        </div>

        <form onSubmit={submit} className="card">
          <div className="card-body" style={{ padding: 24 }}>
            <div className="flex col gap-3">
              <div className="field">
                <label>New password</label>
                <input 
                  type="password" 
                  required 
                  value={f.newPassword} 
                  onChange={e => setF({ ...f, newPassword: e.target.value })} 
                  placeholder="At least 8 chars, 1 uppercase, 1 special" 
                />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input 
                  type="password" 
                  required 
                  value={f.confirmPassword} 
                  onChange={e => setF({ ...f, confirmPassword: e.target.value })} 
                  placeholder="Enter your new password again" 
                />
              </div>

              <button 
                type="submit" 
                className="btn primary" 
                disabled={!f.newPassword || !f.confirmPassword || loading} 
                style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}
              >
                {loading ? 'Changing password…' : 'Change password'}
              </button>
            </div>
          </div>
        </form>

        <div style={{ padding: 12, background: 'var(--info-soft)', borderRadius: 8, fontSize: 12, color: 'var(--info)', marginTop: 16 }}>
          <div className="flex gap-2">
            <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Password requirements:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                <li>At least 8 characters</li>
                <li>At least 1 uppercase letter</li>
                <li>At least 1 special character (!@#$%^&* etc.)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}

export default ChangePasswordPage
