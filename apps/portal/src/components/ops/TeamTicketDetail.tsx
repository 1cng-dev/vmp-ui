import React, { useState, useRef } from 'react'
import { useTickets } from '../../store/ticketStore'
import { useCustomers } from '../../store/customerStore'
import useUIStore from '../../store/uiStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill } from '../ui/ui'
import { uploadTicketAttachment } from '../../lib/storage'

interface TeamTicketDetailProps {
  ticket: any
  onClose: () => void
  openModal?: (kind: string, props?: any) => void
}

export const TeamTicketDetail: React.FC<TeamTicketDetailProps> = ({ ticket: initial, onClose, openModal }) => {
  const { tickets, setTicketStatus, replyTicket } = useTickets()
  const { customers } = useCustomers()
  const { toast } = useUIStore()
  const ticket = tickets.find((t: any) => t.id === initial.id) || initial
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico|heic|heif)$/i.test(url)
  }

  const AttachmentThumbs = ({ urls }: { urls: string[] }) => (
    <div className="flex gap-2 wrap" style={{ marginTop: 8 }}>
      {urls.map((url: string, j: number) => (
        isImageUrl(url) ? (
          <img
            key={j}
            src={url}
            alt={`Attachment ${j + 1}`}
            onClick={() => setPreviewImage(url)}
            style={{
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: 8,
              cursor: 'pointer',
              border: '1px solid var(--line)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.target as HTMLImageElement).style.opacity = '0.8'}
            onMouseLeave={e => (e.target as HTMLImageElement).style.opacity = '1'}
          />
        ) : (
          <button key={j} className="btn sm" onClick={() => window.open(url, '_blank')}>
            <Icon name="attach" size={11}/> Attachment {j + 1}
          </button>
        )
      ))}
    </div>
  )

  const customer = customers.find((c: any) => c.id === ticket.customer_id)

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  const validateFiles = (files: File[]): File[] => {
    const valid: File[] = []
    for (const file of files) {
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
    return valid
  }

  const onReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || [])
    const validFiles = validateFiles(list)
    setReplyFiles(prev => [...prev, ...validFiles])
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const validFiles = validateFiles(files)
    if (validFiles.length > 0) setReplyFiles(prev => [...prev, ...validFiles])
  }

  const sendReply = async () => {
    if (!reply.trim() && replyFiles.length === 0) return
    try {
      // Upload files first
      const attachmentUrls: string[] = []
      if (replyFiles.length > 0) {
        for (const file of replyFiles) {
          try {
            console.log('Uploading reply file:', file.name)
            const url = await uploadTicketAttachment(file)
            console.log('Reply file uploaded:', url)
            attachmentUrls.push(url)
          } catch (err) {
            console.error('Failed to upload reply file:', file.name, err)
            toast(`Failed to upload ${file.name}`, 'bad')
          }
        }
      }

      await replyTicket({ id: ticket.id, who: 'Support Team', body: reply, attachments: attachmentUrls })
      toast('Reply sent', 'ok')
      setReply('')
      setReplyFiles([])
    } catch (error) {
      toast('Error sending reply', 'bad')
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      await setTicketStatus({ id: ticket.id, status })
      toast(`Ticket marked as ${status}`, 'ok')
    } catch (error) {
      toast('Error updating status', 'bad')
    }
  }

  const handleReopen = () => {
    if (openModal) {
      openModal('confirm', {
        title: 'Reopen ticket',
        message: 'Are you sure you want to reopen this ticket?',
        onConfirm: () => handleStatusChange('Open')
      })
    } else {
      if (confirm('Are you sure you want to reopen this ticket?')) {
        handleStatusChange('Open')
      }
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="flex center gap-2 mb-1">
            <button className="btn ghost sm" onClick={onClose}><Icon name="chevron-left" size={12}/>Back to tickets</button>
            <span className="mono text-xs text-mute">{ticket.legacy_id || ticket.id}</span>
          </div>
          <h1 className="page-title">{ticket.subject}</h1>
          <div className="flex gap-2 mt-2">
            <StatusPill status={ticket.status}/>
            <span className={`pill ${ticket.priority === 'Urgent' ? 'bad' : ticket.priority === 'Low' ? 'subtle' : 'warn'}`}><span className="dot"/>{ticket.priority}</span>
            <span className="pill subtle">Opened {new Date(ticket.created_at).toLocaleDateString()}</span>
            {ticket.assignee !== '—' && <span className="pill subtle">Assigned: {ticket.assignee}</span>}
          </div>
        </div>
        <div className="page-actions">
          {ticket.status === 'Closed' && <button className="btn" onClick={handleReopen}>Reopen ticket</button>}
        </div>
      </div>

      <div>
        {/* Conversation */}
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Conversation</h3>
            <span className="text-xs text-mute">{(ticket.replies || []).length + 1} message{(ticket.replies || []).length === 0 ? '' : 's'}</span>
          </div>
          <div className="card-body">
            {/* Original */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div className="flex center gap-2 mb-1">
                  <Avatar name={customer?.name || customer?.org_name || 'Customer'} size={28}/>
                  <div className="fw-6 text-sm">{customer?.name && customer?.org_name ? `${customer?.name} (${customer?.org_name})` : customer?.name || customer?.org_name || 'Customer'}</div>
                  <div className="text-xs text-mute">{new Date(ticket.created_at).toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 12, borderBottomLeftRadius: 4 }}>
                  <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.body}</div>
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <AttachmentThumbs urls={ticket.attachments} />
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            {(ticket.replies || []).map((r: any, i: number) => (
              <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: r.who === 'Support Team' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: r.who === 'Support Team' ? 'flex-end' : 'flex-start' }}>
                  <div className="flex center gap-2 mb-1">
                    {r.who === 'Customer' && <Avatar name={customer?.name && customer?.org_name ? `${customer?.name} (${customer?.org_name})` : customer?.name || customer?.org_name || 'Customer'} size={24}/>}
                    {r.who === 'Support Team' && <Avatar name={r.who} size={24}/>}
                    <div className="fw-6 text-sm">{r.who === 'Customer' ? (customer?.name && customer?.org_name ? `${customer?.name} (${customer?.org_name})` : customer?.name || customer?.org_name || 'Customer') : r.who}</div>
                    <div className="text-xs text-mute">{new Date(r.when).toLocaleString()}</div>
                  </div>
                  <div style={{ 
                    background: 'var(--surface-2)', 
                    color: 'var(--ink-1)',
                    padding: '12px 16px', 
                    borderRadius: 12, 
                    borderBottomRightRadius: r.who === 'Support Team' ? 4 : 12,
                    borderBottomLeftRadius: r.who === 'Customer' ? 4 : 12,
                    minHeight: 'auto'
                  }}>
                    <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.body || ''}</div>
                    {r.attachments && r.attachments.length > 0 && (
                      <AttachmentThumbs urls={r.attachments} />
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Reply box */}
            {ticket.status === 'Open' && (
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                {replyFiles.length > 0 && (
                  <div className="flex col gap-1" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                    {replyFiles.map((f, i) => (
                      <div key={i} className="flex center gap-2" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6 }}>
                        <span className="text-xs text-mute" style={{ flex: 1 }}>{f.name}</span>
                        <button className="icon-btn" onClick={() => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))}><Icon name="x" size={12}/></button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
                  onDrop={handleDrop}
                  style={{ position: 'relative', marginBottom: 8 }}
                >
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply…"
                    rows={3}
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
                <div className="flex between">
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={onReplyFileChange} style={{ display: 'none' }} />
                    <button className="btn sm" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="attach" size={11}/> Attach files
                    </button>
                    <span className="text-xs text-mute" style={{ alignSelf: 'center' }}>or drag & drop onto the text area (PNG, JPG, PDF — 10MB max)</span>
                  </div>
                  <button className="btn primary" disabled={!reply.trim()} onClick={sendReply}><Icon name="mail" size={12}/>Send reply</button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {previewImage && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewImage(null)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -14,
                right: -14,
                zIndex: 1,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--surface)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: 18,
                lineHeight: 1,
                color: 'var(--ink-2)',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
            <img
              src={previewImage}
              alt="Attachment preview"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}

export default TeamTicketDetail
