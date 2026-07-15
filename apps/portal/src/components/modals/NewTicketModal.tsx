import React, { useMemo, useState, useRef } from 'react'
import Icon from '../../lib/icons'
import { useTickets } from '../../store/ticketStore'
import { useCustomers } from '../../store/customerStore'
import useUIStore from '../../store/uiStore'
import useActivityStore from '../../store/activityStore'
import { uploadTicketAttachment } from '../../lib/storage'
import { supabase } from '../../lib/supabase'

interface NewTicketModalProps {
  onClose: () => void
  onCreated?: () => void
}

const NewTicketModal: React.FC<NewTicketModalProps> = ({ onClose, onCreated }) => {
  const { addTicket } = useTickets()
  const { customers } = useCustomers()
  const { toast } = useUIStore()
  const { logActivity } = useActivityStore()
  const [query, setQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'Low' | 'Normal' | 'High' | 'Urgent'>('Normal')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || [])
    setFiles(list)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers.slice(0, 8)
    return customers.filter((c: any) => (
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || c.org_name || '').toLowerCase().includes(q)
    )).slice(0, 8)
  }, [query, customers])

  const pickCustomer = (id: string, display: string) => {
    setSelectedCustomerId(id)
    setQuery(display)
  }

  const submit = async () => {
    if (!selectedCustomerId || !category.trim() || !subject.trim() || !body.trim()) return
    setSubmitting(true)
    try {
      // Create ticket first
      const ticketId = await addTicket({
        customer_id: selectedCustomerId,
        category,
        subject,
        body,
        priority,
        attachments: []
      })

      console.log('Ticket created with ID:', ticketId)

      // Upload files after ticket is created
      const attachmentUrls: string[] = []
      if (files.length > 0) {
        for (const file of files) {
          try {
            console.log('Uploading file:', file.name)
            const url = await uploadTicketAttachment(file, ticketId)
            console.log('File uploaded:', url)
            attachmentUrls.push(url)
          } catch (err) {
            console.error('Failed to upload file:', file.name, err)
            toast(`Failed to upload ${file.name}`, 'bad')
          }
        }
      }

      // Update ticket with attachment URLs
      if (attachmentUrls.length > 0) {
        console.log('Updating ticket with attachments:', attachmentUrls)
        const { error } = await supabase
          .from('tickets')
          .update({ attachments: attachmentUrls })
          .eq('id', ticketId)

        if (error) {
          console.error('Failed to update ticket with attachments:', error)
          toast('Failed to save attachments', 'bad')
        } else {
          console.log('Ticket updated with attachments successfully')
        }
      }

      toast('Ticket created', 'ok')
      await logActivity(
        `Created ticket: ${subject}`,
        'task',
        'Staff',
        { ticketId, customerId: selectedCustomerId, priority }
      )
      onCreated?.()
      onClose()
    } catch (e) {
      console.error('Failed to create ticket:', e)
      toast('Failed to create ticket', 'bad')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <div>
            <div className="fw-7" style={{ fontSize: 18 }}>Create New Ticket</div>
            <div className="text-xs text-mute" style={{ marginTop: 4 }}>Submit a new customer support request</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
            <div className="card-body" style={{ paddingTop: 18 }}>
              <div className="flex col" style={{ gap: 14 }}>
                <div className="field">
                  <label>Customer<span style={{ color: 'var(--bad)' }}>*</span></label>
                  <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelectedCustomerId(null) }}
                    placeholder="Enter customer name or company" />
                  {filtered.length > 0 && (
                    <div style={{ marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', maxHeight: 180, overflow: 'auto' }}>
                      {filtered.map((c: any) => {
                        const name = c.name || c.org_name || c.company || 'Unnamed'
                        return (
                          <button key={c.id}
                            className="flex center between"
                            style={{ width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
                            onClick={() => pickCustomer(c.id, name)}>
                            <span className="text-sm">{name}</span>
                            <span className="mono text-xs text-mute">{(c.legacy_id || c.id).slice(0, 8)}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Category<span style={{ color: 'var(--bad)' }}>*</span></label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">Select category</option>
                    <option value="Technical">Technical</option>
                    <option value="Billing">Billing</option>
                    <option value="Account">Account</option>
                    <option value="General">General</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Bug Report">Bug Report</option>
                  </select>
                </div>

                <div className="field">
                  <label>Subject<span style={{ color: 'var(--bad)' }}>*</span></label>
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of the issue" />
                </div>

                <div className="field">
                  <label>Priority<span style={{ color: 'var(--bad)' }}>*</span></label>
                  <select value={priority} onChange={e => setPriority(e.target.value as any)}>
                    <option value="Low">Low</option>
                    <option value="Normal">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div className="field">
                  <label>Describe the issue<span style={{ color: 'var(--bad)' }}>*</span></label>
                  <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="Provide detailed information about the issue..." />
                </div>

                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 6 }}>Attachment (optional)</label>
                  <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={onFileChange} style={{ display: 'none' }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '14px 16px',
                      border: '1.5px dashed var(--line-strong)',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                      display: 'flex', alignItems: 'center', gap: 12,
                      cursor: 'pointer', width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-3)', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="attach" size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="fw-6 text-sm">{files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Click to upload or drag and drop'}</div>
                      <div className="text-xs text-mute">PNG, JPG, PDF up to 10MB</div>
                    </div>
                  </button>
                  {files.length > 0 && (
                    <div className="text-xs" style={{ marginTop: 8 }}>
                      {files.map((f, i) => (
                        <div key={i} className="mono" style={{ marginTop: 2 }}>{f.name} ({Math.ceil(f.size/1024)} KB)</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn accent" disabled={!selectedCustomerId || !subject.trim() || !body.trim() || submitting} onClick={submit}>
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NewTicketModal
