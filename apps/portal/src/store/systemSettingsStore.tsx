import React, { useState, useCallback, createContext, useContext, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface SystemSettings {
  id: string
  company_name: string
  logo_url: string | null
  updated_at: string
  updated_by: string | null
}

export interface SystemSettingsStoreValue {
  settings: SystemSettings | null
  loading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<Pick<SystemSettings, 'company_name' | 'logo_url'>>) => Promise<void>
}

const SystemSettingsContext = createContext<SystemSettingsStoreValue | null>(null)

export const SystemSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single()
      if (error) throw error
      setSettings(data as SystemSettings)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (updates: Partial<Pick<SystemSettings, 'company_name' | 'logo_url'>>) => {
    if (!settings) return

    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('system_settings')
      .update({
        ...updates,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings.id)
      .select()
      .single()
    
    if (error) throw error
    setSettings(data as SystemSettings)
  }, [settings])

  useEffect(() => {
    loadSettings()

    const ch = supabase
      .channel(`system-settings-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, async () => {
        const { data, error } = await supabase.from('system_settings').select('*').single()
        if (!error) {
          setSettings(data as SystemSettings)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [loadSettings])

  return (
    <SystemSettingsContext.Provider value={{ settings, loading, loadSettings, updateSettings }}>
      {loading ? (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', zIndex: 9999 }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--line-weak)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : children}
    </SystemSettingsContext.Provider>
  )
}

export const useSystemSettingsStore = (): SystemSettingsStoreValue => {
  const context = useContext(SystemSettingsContext)
  if (!context) {
    throw new Error('useSystemSettingsStore must be used within SystemSettingsProvider')
  }
  return context
}
