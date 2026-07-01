import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from '../lib/icons'

const Welcome = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const validateInvite = async () => {
      const token = searchParams.get('token')
      
      if (!token) {
        setError('Invalid invite link')
        setLoading(false)
        return
      }

      // Validate invite token
      const { data: member, error: memberError } = await supabase
        .from('team_members')
        .select('*')
        .eq('invite_token', token)
        .single()

      if (memberError || !member) {
        setError('Invalid or expired invite link')
        setLoading(false)
        return
      }

      // Check if invite expired
      if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
        setError('Invite link has expired')
        setLoading(false)
        return
      }

      // Check if already accepted
      if (member.accepted_at) {
        setError('This invite has already been accepted')
        setLoading(false)
        return
      }

      // Trigger password reset for the user
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(member.email, {
        redirectTo: `${window.location.origin}/setup-password`,
      })

      if (resetError) {
        setError('Failed to send password reset link')
        setLoading(false)
        return
      }

      // Update team_members record to mark as accepted
      await supabase
        .from('team_members')
        .update({ 
          status: 'Active',
          accepted_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .eq('id', member.id)

      setLoading(false)
      // Show success message
    }

    validateInvite()
  }, [searchParams])

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 className="card-title">Processing invite...</h2>
          <p className="text-mute">Please wait</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 className="card-title" style={{ color: 'var(--bad)' }}>Error</h2>
          <p className="text-mute">{error}</p>
          <button className="btn primary" onClick={() => navigate('/')}>Go to home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
        <h2 className="card-title">Invite accepted</h2>
        <p className="text-mute">A password reset link has been sent to your email. Please check your inbox to set your password.</p>
        <button className="btn primary" onClick={() => navigate('/')}>Go to home</button>
      </div>
    </div>
  )
}

export default Welcome