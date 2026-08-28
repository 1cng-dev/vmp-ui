import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import useCustomerStore from '@/store/customerStore'
import useUIStore from '@/store/uiStore'

const log2faActivity = async (text: string, customerId: string, meta: Record<string, unknown>) => {
  try {
    const [{ data: { user } }, { data: customer }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('customers').select('name, legacy_id').eq('id', customerId).single()
    ])
    const customerLabel = customer
      ? `${customer.name} (${customer.legacy_id || customerId})`
      : customerId
    const { error } = await supabase.from('activity_log').insert({
      actor: user?.email || 'admin',
      actor_role: 'staff',
      kind: 'auth',
      text: `${text} for ${customerLabel}`,
      meta: { ...meta, customer_id: customerId }
    })
    if (error) throw error
  } catch (err) {
    console.error('activity log error:', err)
  }
}

interface Props {
  customerId: string
  initial: { mfa_required: boolean; mfa_disabled: boolean }
}

export const CustomerSecurity: React.FC<Props> = ({ customerId, initial }) => {
  const { updateCustomer } = useCustomerStore()
  const { toast } = useUIStore()
  const [required, setRequired] = useState(initial.mfa_required)
  const [disabled, setDisabled] = useState(initial.mfa_disabled)

  const toggleRequired = async () => {
    const next = !required
    try {
      await updateCustomer(customerId, { mfa_required: next })
      await log2faActivity(`Admin set 2FA required to ${next}`, customerId, {
        event: 'mfa_required_changed',
        mfa_required: next
      })
      setRequired(next)
      toast(`2FA ${next ? 'required' : 'optional'} for this customer`, 'ok')
    } catch (error: any) {
      toast(error.message || 'Failed to update', 'bad')
    }
  }

  const toggleDisabled = async () => {
    const next = !disabled
    try {
      await updateCustomer(customerId, { mfa_disabled: next })

      if (next) {
        const { error } = await supabase.functions.invoke('admin-delete-mfa', { body: { userId: customerId } })
        if (error) throw error
        toast('2FA disabled and factors deleted', 'ok')
        await log2faActivity('Admin disabled 2FA', customerId, {
          event: 'mfa_admin_disabled'
        })
      } else {
        toast('2FA allowed again. Customer must re-enable.', 'ok')
        await log2faActivity('Admin allowed 2FA', customerId, {
          event: 'mfa_admin_enabled'
        })
      }

      setDisabled(next)
    } catch (error: any) {
      toast(error.message || 'Failed to update', 'bad')
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head"><h3 className="card-title">2FA Security</h3></div>
      <div className="card-body">
        <div className="flex col gap-3">
          <div className="flex center between">
            <div>
              <div className="fw-6 text-sm">Require 2FA</div>
              <div className="text-xs text-mute">Customer must enable 2FA</div>
            </div>
            <span
              className={`toggle ${required ? 'on' : ''}`}
              onClick={toggleRequired}
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="flex center between">
            <div>
              <div className="fw-6 text-sm">Disable 2FA</div>
              <div className="text-xs text-mute">Block customer 2FA and remove factors</div>
            </div>
            <span
              className={`toggle ${disabled ? 'on' : ''}`}
              onClick={toggleDisabled}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
