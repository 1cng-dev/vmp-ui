import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './shared/AuthLayout'
import { ForgotPasswordScreen } from './ForgotPasswordScreen'

interface LoginScreenProps {
  onSwitchToSignup: () => void
  prefillEmail: string
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToSignup, prefillEmail }) => {
  const { toast } = useUIStore()
  const navigate = useNavigate()
  const [f, setF] = useState({ email: prefillEmail || '', password: '', remember: true })
  const [showPw, setShowPw] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: f.email,
      password: f.password,
    })

    if (error) {
      toast(error.message, 'bad')
      setLoading(false)
      return
    }

    // Check customer status after successful auth
    if (authData.user) {
      const { data: customer } = await supabase
        .from('customers')
        .select('status, force_password_change')
        .eq('id', authData.user.id)
        .single()

      // Note: Customer availability check removed to prevent race condition after signup
      // CustomerPortal handles loading states when customer data is not immediately available

      if (customer && customer.status !== 'Active') {
        toast('Your account has been suspended. Please contact support.', 'bad')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // Check if user needs to change password
      if (customer?.force_password_change) {
        navigate('/change-password')
        setLoading(false)
        return
      }
    }

    setLoading(false)
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen
      onBackToLogin={() => setShowForgotPassword(false)}
      userType="customer"
    />
  }


  return (
    <AuthLayout>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div className="text-center mb-4">
          <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Welcome back</h1>
          <p className="text-sm text-mute mt-2">Sign in to your VPS Myanmar account</p>
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
          New to VPS Myanmar? <a onClick={onSwitchToSignup} style={{ color: 'var(--accent-strong)', cursor: 'pointer', fontWeight: 600 }}>Create an account</a>
        </div>
      </div>
    </AuthLayout>
  )
}

export { LoginScreen }
