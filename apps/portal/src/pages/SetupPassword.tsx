import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../lib/supabase'
import Icon from '../lib/icons'
import { AuthLayout } from '../components/auth/shared/AuthLayout'
import { useSystemSettingsStore } from '../store/systemSettingsStore'
import { Spinner } from '../components/ui/ui'
import useUIStore from '../store/uiStore'
import { useTeamStore } from '../store/TeamContext'

const SetupPassword = () => {
  const navigate = useNavigate()
  const { toast } = useUIStore()
  const { loadTeam } = useTeamStore()
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
      console.log('Setup password - token from URL:', token)

      if (!token) {
        console.log('No token found in URL')
        toast('Invalid invite link', 'bad')
        setValidating(false)
        return
      }

      // Validate invite token
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('team_members')
        .select('*')
        .eq('invite_token', token)
        .single()

      console.log('Member data:', memberData)
      console.log('Member error:', memberError)

      if (memberError || !memberData) {
        console.log('Validation failed - memberError:', memberError, 'memberData:', memberData)
        toast('Invalid or expired invite link', 'bad')
        setValidating(false)
        return
      }

      // Check if invite expired
      if (memberData.invite_expires_at && new Date(memberData.invite_expires_at) < new Date()) {
        console.log('Invite expired')
        toast('Invite link has expired', 'bad')
        setValidating(false)
        return
      }

      // Check if already accepted
      if (memberData.accepted_at) {
        console.log('Invite already accepted')
        toast('This invite has already been accepted', 'bad')
        setValidating(false)
        return
      }

      console.log('Validation successful, member:', memberData)
      setMember(memberData)
      setValidating(false)
    }

    validateInvite()
  }, [searchParams, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    if (password !== confirmPassword) {
      toast('Passwords do not match', 'bad')
      return
    }

    if (password.length < 8) {
      toast('Password must be at least 8 characters', 'bad')
      return
    }
    if (password.length > 64) {
      toast('Password must be at most 64 characters', 'bad')
      return
    }
    if (!/[A-Z]/.test(password)) {
      toast('Password must contain at least one uppercase letter', 'bad')
      return
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      toast('Password must contain at least one special character', 'bad')
      return
    }

    setLoading(true)

    try {
      console.log('Updating password for user:', member.user_id)

      // Update the auth user's password using admin client
      await supabaseAdmin.auth.admin.updateUserById(member.user_id, {
        password: password
      })


      // Update team_members record to mark as Active and accepted
      const { error: updateError } = await supabaseAdmin
        .from('team_members')
        .update({
          status: 'Active',
          accepted_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .eq('invite_token', member.invite_token)

      if (updateError) {
        console.error('Failed to update team_members status:', updateError)
        throw new Error('Failed to update status: ' + updateError.message)
      }

      console.log('Status updated successfully')

      // Sign in with the new password
      await supabase.auth.signInWithPassword({
        email: member.email,
        password: password
      })

      console.log('Login successful, now reloading team data')

      // Reload team data after authentication to update Context state
      await loadTeam()

      console.log('Team data reloaded, navigating to admin')
      navigate('/admin')
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      toast('Failed to set password: ' + error.message, 'bad')
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
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
                <label>Password</label>s, 1 upperas, 1 pecial
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