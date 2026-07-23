import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './shared/AuthLayout'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'
import { useSystemSettingsStore } from '../../store/systemSettingsStore'

const TeamLoginScreen: React.FC = () => {
  const { toast } = useUIStore()
  const navigate = useNavigate()
  const [f, setF] = useState({ email: '', password: '', remember: true })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: f.email,
      password: f.password,
    })

    if (error) {
      toast(error.message, 'bad')
      setLoading(false)
    } else {
      // Validate role immediately after login
      const userData = data.user?.user_metadata
      const userRole = userData?.role || 'Admin'
      const allowedRoles = ['Admin', 'Sales', 'Engineer', 'Finance']

      if (!allowedRoles.includes(userRole)) {
        await supabase.auth.signOut()
        toast('Invalid login credentials', 'bad')
        setLoading(false)
        return
      }

      // Check if team member needs to change password
      if (data.user && data.user.id) {
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('force_password_change')
          .eq('user_id', data.user.id)
          .single()

        if (teamMember?.force_password_change) {
          navigate('/team-change-password')
          setLoading(false)
          return
        }
      }

      toast('Welcome back!', 'ok')
    }
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen
      onBackToLogin={() => setShowForgotPassword(false)}
      userType="team"
    />
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Team Login</h1>
          {(() => { const { settings } = useSystemSettingsStore(); return (
            <p className="text-sm text-mute mt-2">Sign in to your {settings?.company_name || 'VPS Myanmar'} team account</p>
          )})()}
        </div>

        <form onSubmit={submit} className="card">
          <div className="card-body" style={{ padding: 24 }}>
            <div className="flex col gap-3">
              <div className="field">
                <label>Email</label>
                <input type="email" autoFocus required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="you@company.com" />
              </div>
              <div className="field">
                <div className="flex center between">
                  <label style={{ marginBottom: 0 }}>Password</label>
                  <a onClick={() => setShowForgotPassword(true)} style={{ fontSize: 11, color: 'var(--accent-strong)', cursor: 'pointer', fontWeight: 600 }}>Forgot?</a>                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} style={{ paddingRight: 36, width: '100%' }} placeholder="••••••••" />
                  <button type="button" className="icon-btn" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                    <Icon name="eye" size={13} />
                  </button>
                </div>
              </div>
              {/* <label className="flex center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={f.remember} onChange={e => setF({ ...f, remember: e.target.checked })} />
                Remember me for 30 days
              </label> */}
              <button type="submit" className="btn primary" disabled={!f.email || !f.password || loading} style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </div>
        </form>

        <div className="text-center text-sm text-mute mt-3">
          Contact your administrator if you need access to the team portal.
        </div>
      </div>
    </AuthLayout>
  )
}

export { TeamLoginScreen }