import React, { useEffect, useRef, useState } from 'react'
import RFB from '@novnc/novnc'
import Icon from '../../lib/icons'
import { getVMConsoleSession } from '../../lib/proxmoxApi'

interface VNCConsoleProps {
  recordId: string
  vmName: string
  onClose: () => void
}

type Phase = 'connecting' | 'connected' | 'error' | 'disconnected'

const CONNECT_TIMEOUT_MS = 15000

// Fetches a short-lived console session from proxmox-proxcy and connects a
// noVNC viewer to it. The session (including the VNC ticket, needed for the
// RFB auth handshake — see proxmox-proxcy's console route) lives only in
// this component's local state for the duration of one connection; it is
// never persisted to a store, logged, or reused across mounts. Each
// connection attempt fetches a brand-new session.
const VNCConsole: React.FC<VNCConsoleProps> = ({ recordId, vmName, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<InstanceType<typeof RFB> | null>(null)
  const [phase, setPhase] = useState<Phase>('connecting')
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 1200, width: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Console — {vmName}</h3>
            <div className="text-xs text-mute mt-1">
              {phase === 'connecting' && 'Connecting…'}
              {phase === 'connected' && 'Connected'}
              {phase === 'disconnected' && 'Disconnected'}
              {phase === 'error' && 'Connection error'}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>

        <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {phase !== 'connected' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff',
              background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center',
            }}>
              {phase === 'connecting' && (
                <>
                  <Icon name="refresh" size={20} className="spin" />
                  <div className="text-sm">Connecting to console…</div>
                </>
              )}
              {(phase === 'error' || phase === 'disconnected') && (
                <>
                  <Icon name="alert" size={20} />
                  <div className="text-sm" style={{ maxWidth: 360 }}>
                    {message || 'The console session ended.'}
                  </div>
                  <button className="btn" onClick={() => setAttempt(a => a + 1)}><Icon name="refresh" size={12} />Reconnect</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VNCConsole
