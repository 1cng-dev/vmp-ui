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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
