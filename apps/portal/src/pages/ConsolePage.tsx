import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import RFB from '@novnc/novnc'
import { getVMConsoleSession } from '../lib/proxmoxApi'

type Phase = 'connecting' | 'connected' | 'error' | 'disconnected'

const CONNECT_TIMEOUT_MS = 15000

const ConsolePage: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<InstanceType<typeof RFB> | null>(null)
  const [phase, setPhase] = useState<Phase>('connecting')
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!recordId) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      setPhase('connecting')
      setMessage(null)

      let session
      try {
        session = await getVMConsoleSession(recordId)
      } catch (err: any) {
        if (cancelled) return
        const status = err?.response?.status
        setPhase('error')
        setMessage(
          status === 404 ? 'This VM could not be found.' :
          status === 403 ? "You don't have access to this VM's console." :
          'Could not start a console session. Please try again.'
        )
        return
      }

      if (cancelled || !containerRef.current) return

      const apiUrl = (import.meta as any).env?.VITE_API_URL || window.location.origin
      const wsUrl = `${apiUrl.replace(/^http/, 'ws')}${session.wsPath}`

      timeoutId = setTimeout(() => {
        if (cancelled) return
        setPhase('error')
        setMessage('The console took too long to connect. The VM node may be unreachable, or the session may have expired. Please try again.')
        rfbRef.current?.disconnect()
      }, CONNECT_TIMEOUT_MS)

      const rfb = new RFB(containerRef.current, wsUrl, {
        credentials: { password: session.ticket },
      })
      rfb.scaleViewport = true
      rfb.resizeSession = false

      rfb.addEventListener('connect', () => {
        if (cancelled) return
        if (timeoutId) clearTimeout(timeoutId)
        setPhase('connected')
      })

      rfb.addEventListener('disconnect', (e: any) => {
        if (cancelled) return
        if (timeoutId) clearTimeout(timeoutId)
        if (e?.detail?.clean) {
          setPhase('disconnected')
        } else {
          setPhase('error')
          setMessage('The console connection was lost. Please try again.')
        }
      })

      rfb.addEventListener('securityfailure', () => {
        if (cancelled) return
        if (timeoutId) clearTimeout(timeoutId)
        setPhase('error')
        setMessage('Could not authenticate the console session. Please try again.')
      })

      rfbRef.current = rfb
    }

    connect()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      rfbRef.current?.disconnect()
      rfbRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, attempt])

  if (!recordId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, marginBottom: 8 }}>Console Error</h2>
          <p style={{ margin: 0, color: '#888' }}>No VM ID provided</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', margin: 0, padding: 0, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />

      {phase !== 'connected' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff',
          background: '#000', padding: 24, textAlign: 'center',
        }}>
          {phase === 'connecting' && (
            <>
              <div style={{ width: 40, height: 40, border: '3px solid #333', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 14, color: '#888' }}>Connecting to console…</div>
            </>
          )}
          {(phase === 'error' || phase === 'disconnected') && (
            <>
              <div style={{ fontSize: 48, color: '#ff4444' }}>⚠</div>
              <div style={{ fontSize: 16, maxWidth: 400, color: '#ccc' }}>
                {message || 'The console session ended.'}
              </div>
              <button 
                onClick={() => setAttempt(a => a + 1)}
                style={{
                  padding: '10px 20px',
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Reconnect
              </button>
              <button 
                onClick={() => window.close()}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #333',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  marginTop: 8,
                }}
              >
                Close
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ConsolePage
