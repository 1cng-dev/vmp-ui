import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Spinner from '../components/ui/Spinner'

const Welcome = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minDisplayTimeElapsed, setMinDisplayTimeElapsed] = useState(false)

  useEffect(() => {
    // Set minimum display time
    const minDisplayTimer = setTimeout(() => {
      setMinDisplayTimeElapsed(true)
    }, 1000)

    const validateInvite = async () => {
      const token = searchParams.get('token')
      if (!token) {
        setError('Invalid invite link')
        setDataLoaded(true)
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
        setDataLoaded(true)
        return
      }

      // Check if invite expired
      if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
        setError('Invite link has expired')
        setDataLoaded(true)
        return
      }

      // Check if already accepted
      if (member.accepted_at) {
        setError('This invite has already been accepted')
        setDataLoaded(true)
        return
      }

      // Redirect directly to setup password page with the token
      setDataLoaded(true)
      navigate(`/setup-password?token=${token}`)
    }

    validateInvite()

    return () => clearTimeout(minDisplayTimer)
  }, [searchParams, navigate])

  // Only hide loading when both conditions are met
  const shouldShowLoading = !dataLoaded || !minDisplayTimeElapsed

  if (shouldShowLoading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', zIndex: 9999 }}>
        <Spinner />
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