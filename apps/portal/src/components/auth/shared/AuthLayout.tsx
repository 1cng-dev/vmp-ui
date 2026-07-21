import React from 'react'
import Icon from '../../../lib/icons'
import { useSystemSettingsStore } from '../../../store/systemSettingsStore'

const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSystemSettingsStore()
  return (
  <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg)' }}>
    <div style={{
      background: 'linear-gradient(135deg, var(--ink) 0%, oklch(0.25 0.05 250) 50%, var(--accent) 100%)',
      color: 'oklch(0.99 0 0)',
      padding: '60px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: 500, height: 500, borderRadius: '50%', background: 'oklch(1 0 0 / 0.04)' }} />
      <div style={{ position: 'absolute', bottom: '-30%', left: '-15%', width: 400, height: 400, borderRadius: '50%', background: 'oklch(1 0 0 / 0.03)' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex center gap-3">
          {settings?.logo_url
            ? <img src={`${settings.logo_url}?v=${settings.updated_at}`} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8 }} />
            : <div style={{ width: 64, height: 64, borderRadius: 8, background: 'oklch(1 0 0 / 0.15)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 26, backdropFilter: 'blur(8px)' }}>V</div>}
          <div>
            <div className="fw-7" style={{ fontSize: 15 }}>{settings?.company_name || 'VPS Myanmar'}</div>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cloud infrastructure</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
          Cloud servers, simplified.
        </h2>
        <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.6, marginTop: 16 }}>
          High-performance VPS hosting from Yangon, with predictable pricing, daily backups, and 24/7 local support.
        </p>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Deploy in minutes', 'Instant provisioning from request to running'],
            ['Local infrastructure', 'Yangon DC1/DC2 · low latency for SE Asia'],
            ['Pay in MMK', 'KBZ, AYA, CB, Yoma Bank accepted'],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-3" style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'oklch(1 0 0 / 0.15)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>
                <Icon name="check" size={12} />
              </div>
              <div>
                <div className="fw-6 text-sm">{t}</div>
                <div className="text-xs" style={{ opacity: 0.7 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 1, fontSize: 11, opacity: 0.6 }}>
        {`© 2026 ${settings?.company_name || 'VPS Myanmar Co., Ltd'} · vpsmm.co`}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
      {children}
    </div>
  </div>
)}

export { AuthLayout }
