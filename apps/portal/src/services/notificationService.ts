import { supabase } from '../lib/supabase'

export interface CreateAlertInput {
  sev: 'urgent' | 'warn' | 'info'
  title: string
  body: string
  type: 'expiry' | 'kyc' | 'finance' | 'task' | 'system' | 'vm'
  related_entity_id?: string
  related_entity_type?: string
  actor_id?: string
  actor_name?: string
  customer_id?: string | null
  metadata?: any
}

export const createAlert = async (input: CreateAlertInput) => {
  try {
    const { error } = await supabase.from('alerts').insert({
      sev: input.sev,
      title: input.title,
      body: input.body,
      type: input.type,
      related_entity_id: input.related_entity_id,
      related_entity_type: input.related_entity_type,
      actor_id: input.actor_id,
      actor_name: input.actor_name,
      customer_id: input.customer_id,
      metadata: input.metadata || {}
    })
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error creating alert:', error)
    return { success: false, error }
  }
}