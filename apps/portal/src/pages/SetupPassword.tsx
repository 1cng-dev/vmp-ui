import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import Icon from '../lib/icons'
import { AuthLayout } from '../components/auth/shared/AuthLayout'

const SetupPassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [member, setMember] = useState<any>(null)

  useEffect(() => {
    const validateInvite = async () => {
      const token = searchParams.get('token')
      
      if (!token) {
        setErr('Invalid invite link')
        setValidating(false)
        return
      }

      // Validate invite token
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('*')
        .eq('invite_token', token)
        .single()

      if (memberError || !memberData) {
        setErr('Invalid or expired invite link')
        setValidating(false)
        return
      }

      // Check if invite expired
      if (memberData.invite_expires_at && new Date(memberData.invite_expires_at) < new Date()) {
        setErr('Invite link has expired')
        setValidating(false)
        return
      }

      // Check if already accepted
      if (memberData.accepted_at) {
        setErr('This invite has already been accepted')
        setValidating(false)
        return
      }

      setMember(memberData)
      setValidating(false)
    }

    validateInvite()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    
    if (password !== confirmPassword) {
      setErr('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setErr('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      // Update the auth user's password using admin client
      await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
        password: password
      })

      // Update team_members record
      await supabase
        .from('team_members')
        .update({ 
          status: 'Active',
          accepted_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .eq('id', member.id)

      // Sign in with the new password
      await supabase.auth.signInWithPassword({
        email: member.email,
        password: password
      })

      navigate('/admin')
    } catch (error: any) {
      setErr('Failed to set password: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 className="card-title">Validating invite...</h2>
          <p className="text-mute">Please wait</p>
        </div>
      </div>
    )
  }

  if (err) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 className="card-title" style={{ color: 'var(--bad)' }}>Error</h2>
          <p className="text-mute">{err}</p>
          <button className="btn primary" onClick={() => navigate('/')}>Go to home</button>
        </div>
      </div>
    )
  }

  return (
    <AuthLayout>
      <div style={{ width: 'min(420px, 100%)' }}>
        <div className="text-center mb-4">
          <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22, margin: '0 auto 16px', borderRadius: 12 }}>V</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Set your password</h1>
          <p className="text-sm text-mute mt-2">Create a password to activate your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          <div className="card-body" style={{ padding: 24 }}>
            <div className="flex col gap-3">
              {err && (
                <div style={{ padding: '10px 12px', background: 'var(--bad-soft)', color: 'var(--bad)', borderRadius: 6, fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="alert" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>{err}</div>
                </div>
              )}
              <div className="field">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPw ? 'text' : 'password'} 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required 
                    minLength={8}
                    placeholder="At least 8 characters"
                    style={{ paddingRight: 36, width: '100%' }} 
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                    <Icon name="eye" size={13} />
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Confirm password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showConfirmPw ? 'text' : 'password'} 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    style={{ paddingRight: 36, width: '100%' }} 
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28 }}>
                    <Icon name="eye" size={13} />
                  </button>
                </div>
              </div>
              <button type="submit" className="btn primary" disabled={!password || !confirmPassword || loading} style={{ justifyContent: 'center', padding: '10px 16px', fontSize: 13 }}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </div>
        </form>

        <div className="text-center text-sm text-mute mt-3">
          <a onClick={() => navigate('/')} style={{ color: 'var(--accent-strong)', cursor: 'pointer', fontWeight: 600 }}>Cancel</a>
        </div>
      </div>
    </AuthLayout>
  )
}

export default SetupPassword