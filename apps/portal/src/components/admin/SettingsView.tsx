import React, { useState, useRef } from 'react'
import useUIStore from '../../store/uiStore'
import { useSystemSettingsStore } from '../../store/systemSettingsStore'
import { supabase } from '../../lib/supabase'

export const SettingsView: React.FC = () => {
  const { toast } = useUIStore()
  const { settings, loading, updateSettings } = useSystemSettingsStore()
  const [companyName, setCompanyName] = useState(settings?.company_name || 'VPS Myanmar Co., Ltd')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    try {
      await updateSettings({ company_name: companyName })
      toast('Company settings saved', 'ok')
    } catch (error) {
      toast('Failed to save company settings', 'error')
      console.error(error)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast('Invalid file type. Please use JPEG, PNG, SVG, or WebP.', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('File too large. Maximum size is 5MB.', 'error')
      return
    }

    setUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `company-logo.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath)

      await updateSettings({ logo_url: publicUrl })
      toast('Logo uploaded successfully', 'ok')
    } catch (error) {
      toast('Failed to upload logo', 'error')
      console.error(error)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleLogoChangeClick = () => {
    fileInputRef.current?.click()
  }

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
          <div className="card-head"><h3 className="card-title">Company</h3><button className="btn sm accent" onClick={handleSave} disabled={loading}>Save</button></div>
          <div className="card-body">
            <div className="flex col gap-3">
              <div className="field"><label>Company name</label><input value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={loading}/></div>
              <div className="field">
                <label>Logo</label>
                <div style={{ padding: '14px 12px', border: '1px dashed var(--line-strong)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {settings?.logo_url ? (
                    <img src={`${settings.logo_url}?v=${settings.updated_at}`} alt="Company logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                  ) : (
                    <div className="brand-mark" style={{ width: 36, height: 36, fontSize: 16 }}>V</div>
                  )}
                  <div className="text-sm">
                    <div className="fw-6">{settings?.logo_url ? 'Custom logo' : 'Default logo'}</div>
                    <div className="text-xs text-mute">{settings?.logo_url ? 'Uploaded' : 'No logo uploaded'}</div>
                  </div>
                  <div style={{ flex: 1 }}/>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                  <button className="btn sm" onClick={handleLogoChangeClick} disabled={uploadingLogo}>
                    {uploadingLogo ? 'Uploading...' : 'Change'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
