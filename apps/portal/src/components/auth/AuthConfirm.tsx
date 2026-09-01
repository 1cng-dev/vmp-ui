import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './shared/AuthLayout'
import Spinner from '../ui/Spinner'

const AuthConfirm: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    const verify = async () => {
      // The GoTrue /auth/v1/verify endpoint may have already set the session
      // by redirecting back with the access_token / refresh_token in the URL.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setMessage('Email verified. Redirecting...')
        navigate('/', { replace: true })
        return
      }

      // Fallback for newer PKCE-style links that carry token_hash and type.
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      if (token_hash && (type === 'signup' || type === 'email_change' || type === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        })

        if (error) {
          setMessage('Verification link is invalid or expired. Please try signing up again or contact support.')
          return
        }

        setMessage('Email verified. Redirecting...')
        navigate('/', { replace: true })
        return
      }

      setMessage('Invalid verification link.')
    }

    verify()
  }, [searchParams, navigate])

  return (
    <AuthLayout>
      <div style={{ width: 'min(480px, 100%)', textAlign: 'center' }}>
        <Spinner />
        <p className="text-sm text-mute mt-3">{message}</p>
      </div>
    </AuthLayout>
  )
}

export default AuthConfirm
