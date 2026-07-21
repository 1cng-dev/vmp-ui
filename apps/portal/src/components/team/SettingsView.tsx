import React from 'react'
import useUIStore from '../../store/uiStore'

export const SettingsView: React.FC = () => {
  const { toast } = useUIStore()
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">System settings</h1>
          <p className="page-subtitle">Company info</p>
        </div>
      </div>
      <div className="mb-4">
        <div className="card">
          <div className="card-head"><h3 className="card-title">Company</h3><button className="btn sm accent" onClick={() => toast('Company settings saved', 'ok')}>Save</button></div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="field"><label>Company name</label><input defaultValue="VPS Myanmar Co., Ltd"/></div>
              <div className="field">
                <label>Logo</label>
                <div style={{ padding: '14px 12px', border: '1px dashed var(--line-strong)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="brand-mark" style={{ width: 36, height: 36, fontSize: 16 }}>V</div>
                  <div className="text-sm"><div className="fw-6">vpsmm-logo.svg</div><div className="text-xs text-mute">120 × 32 · 4 KB</div></div>
                  <div style={{ flex: 1 }}/>
                  <button className="btn sm">Change</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
