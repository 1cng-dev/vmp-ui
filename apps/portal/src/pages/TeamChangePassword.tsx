import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useUIStore from '../store/uiStore'
import Icon from '../lib/icons'
import { supabase } from '../lib/supabase'
import { AuthLayout } from '../components/auth/shared/AuthLayout'
import { useSystemSettingsStore } from '../store/systemSettingsStore'

const TeamChangePasswordPage: React.FC = () => {
  const { toast } = useUIStore()
  const navigate = useNavigate()
  const [f, setF] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast('Please login first', 'bad')
          navigate('/')
          return
        }

        // Check if user is a team member
        const { data: teamMember, error } = await supabase
          .from('team_members')
          .select('force_password_change')
          .eq('user_id', user.id)
          .single()

        if (error || !teamMember) {
          toast('Access denied. Team members only.', 'bad')
          navigate('/')
          return
        }

        // Check if force_password_change flag is set
        if (!teamMember.force_password_change) {
          toast('Password change not required', 'info')
          navigate('/')
          return
        }
      } catch (error) {
        console.error('Auth check error:', error)
        toast('Access denied', 'bad')
        navigate('/')
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [navigate, toast])

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

      if (updateError) {
        console.error('Password update error:', updateError)
        throw updateError
      }


      // Clear force_password_change flag for team member
      const { error: teamError } = await supabase
        .from('team_members')
        .update({ force_password_change: false })
        .eq('user_id', user.id)

      if (teamError) {
        console.error('Team member update error:', teamError)
        throw teamError
      }


      toast('Password changed successfully', 'ok')
      navigate('/admin')
    } catch (error: any) {
      console.error('Password change error:', error)
      toast(error.message || 'Failed to change password', 'bad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {checkingAuth ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--line-weak)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
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
      )}
    </AuthLayout>
  )
}

export default TeamChangePasswordPage
