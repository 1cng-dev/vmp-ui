import React, { useRef, useState } from 'react'
import Icon from '../../lib/icons'
import useTicketStore from '../../store/ticketStore'
import useUIStore from '../../store/uiStore'
import { uploadTicketAttachment } from '../../lib/storage'
import { supabase } from '../../lib/supabase'

interface NewCustomerTicketModalProps {
  me: any
  onClose: () => void
  onCreated?: () => void
}

const NewCustomerTicketModal: React.FC<NewCustomerTicketModalProps> = ({ me, onClose, onCreated }) => {
  const { addTicket } = useTicketStore()
  const { toast } = useUIStore()
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'Low' | 'Normal' | 'High' | 'Urgent'>('Normal')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || [])
    const valid: File[] = []
    for (const file of list) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast(`${file.name} is not allowed. Only PNG, JPG, and PDF files are accepted.`, 'bad')
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast(`${file.name} is too large. Maximum file size is 10MB.`, 'bad')
        continue
      }
      valid.push(file)
    }
    setFiles(prev => [...prev, ...valid])
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const list = Array.from(e.dataTransfer.files || [])
    const valid: File[] = []
    for (const file of list) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast(`${file.name} is not allowed. Only PNG, JPG, and PDF files are accepted.`, 'bad')
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast(`${file.name} is too large. Maximum file size is 10MB.`, 'bad')
        continue
      }
      valid.push(file)
    }
    if (valid.length > 0) setFiles(prev => [...prev, ...valid])
  }

  const submit = async () => {
    if (!category.trim() || !subject.trim() || !body.trim()) return
    setSubmitting(true)
    try {
      // Create ticket first
      const ticketId = await addTicket({
        customer_id: me.id,
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
                  <div
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
                    onDrop={handleDrop}
                    style={{ position: 'relative' }}
                  >
                    <textarea
                      rows={6}
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      placeholder="Provide detailed information about the issue..."
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5, resize: 'vertical', background: 'var(--surface)', outline: 'none' }}
                    />
                    {dragOver && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(2px)',
                        pointerEvents: 'none',
                        animation: 'fadeIn 0.12s ease-out',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 16px',
                          borderRadius: 999,
                          background: 'var(--accent)',
                          color: 'white',
                          fontSize: 12.5,
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        }}>
                          <Icon name="attach" size={14} />
                          Drop to attach
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm" style={{ display: 'block', marginBottom: 6 }}>Attachment (optional)</label>
                  <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={onFileChange} style={{ display: 'none' }} />
                  <div className="flex center gap-2">
                    <button type="button" className="btn sm" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="attach" size={11}/> Attach files
                    </button>
                    <span className="text-xs text-mute">or drag & drop onto the text area above (PNG, JPG, PDF — 10MB max)</span>
                  </div>
                  {files.length > 0 && (
                    <div className="text-xs" style={{ marginTop: 8 }}>
                      {files.map((f, i) => (
                        <div key={i} className="flex center gap-2" style={{ marginTop: 2 }}>
                          <span className="mono" style={{ flex: 1 }}>{f.name} ({Math.ceil(f.size/1024)} KB)</span>
                          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)) }}><Icon name="x" size={12}/></button>
                        </div>
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
          <button className="btn accent" disabled={!subject.trim() || !body.trim() || submitting} onClick={submit}>
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}

export default NewCustomerTicketModal
