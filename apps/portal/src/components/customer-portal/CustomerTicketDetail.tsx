import React, { useState } from 'react'
import useTicketStore from '../../store/ticketStore'
import useCustomerStore from '../../store/customerStore'
import Icon from '../../lib/icons'
import { Avatar, StatusPill } from '../ui/ui'
import { supabase } from '../../lib/supabase'

interface CustomerTicketDetailProps {
  ticket: any
  onClose: () => void
  openModal?: (kind: string, props?: any) => void
}

export const CustomerTicketDetail: React.FC<CustomerTicketDetailProps> = ({ ticket: initial, onClose, openModal }) => {
  const { tickets, deleteTicket, setTicketStatus, replyTicket } = useTicketStore()
  const { customers } = useCustomerStore()
  const ticket = tickets.find((t: any) => t.id === initial.id) || initial
  const [replyBody, setReplyBody] = useState('')
  const [replyAttachments, setReplyAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

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

  const handleClose = () => {
    if (openModal) {
      openModal('confirm', {
        title: 'Close ticket',
        message: 'Are you sure you want to close this ticket? You can create a new ticket if you need more help.',
        onConfirm: () => setTicketStatus(ticket.id, 'Closed')
      })
    } else {
      setShowCloseConfirm(true)
    }
  }

  const handleDelete = () => {
    if (openModal) {
      openModal('confirm', {
        title: 'Delete ticket',
        message: 'Are you sure you want to delete this ticket? This action cannot be undone.',
        onConfirm: () => {
          deleteTicket(ticket.id)
          onClose()
        }
      })
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  const validateFiles = (files: File[]): File[] => {
    const valid: File[] = []
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`${file.name} is not allowed. Only PNG, JPG, and PDF files are accepted.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`)
        continue
      }
      valid.push(file)
    }
    return valid
  }

  const uploadFiles = async (fileList: File[]) => {
    const validFiles = validateFiles(fileList)
    if (validFiles.length === 0) return

    setUploading(true)
    try {
      const uploadPromises = validFiles.map(async (file) => {
        const fileName = `ticket-reply-${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('ticket-attachments').upload(fileName, file)
        
        if (error) throw error
        
        const { data: { publicUrl } } = supabase.storage.from('ticket-attachments').getPublicUrl(fileName)
        return publicUrl
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setReplyAttachments([...replyAttachments, ...uploadedUrls])
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await uploadFiles(Array.from(files))
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) uploadFiles(files)
  }

  const handleReply = async () => {
    if (!replyBody.trim() && replyAttachments.length === 0) return
    try {
      await replyTicket(ticket.id, 'Customer', replyBody, replyAttachments)
      setReplyBody('')
      setReplyAttachments([])
    } catch (error) {
      console.error('Error replying to ticket:', error)
    }
  }

  const removeAttachment = (url: string) => {
    setReplyAttachments(replyAttachments.filter(a => a !== url))
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
            {ticket.category && <span className="pill subtle">{ticket.category}</span>}
          </div>
        </div>
        <div className="page-actions">
          {ticket.status === 'Open' && <button className="btn" onClick={handleClose}>Close ticket</button>}
          <button className="btn danger" onClick={handleDelete}><Icon name="trash" size={12}/></button>
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
                  <Avatar name={customers.find((c: any) => c.id === ticket.customer_id)?.name || 'Customer'} size={28}/>
                  <div className="fw-6 text-sm">Me</div>
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
                    {r.who === 'Customer' && <Avatar name="Me" size={24}/>}
                    {r.who === 'Support Team' && <Avatar name={r.who} size={24}/>}
                    <div className="fw-6 text-sm">{r.who === 'Customer' ? 'Me' : r.who}</div>
                    <div className="text-xs text-mute">{new Date(r.when).toLocaleString()}</div>
                  </div>
                  <div style={{ 
                    background: 'var(--surface-2)', 
                    color: 'var(--ink-1)',
                    padding: '12px 16px', 
                    borderRadius: 12, 
                    borderBottomRightRadius: r.who === 'Support Team' ? 4 : 12,
                    borderBottomLeftRadius: r.who === 'Customer' ? 4 : 12
                  }}>
                    <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.body}</div>
                    {r.attachments && r.attachments.length > 0 && (
                      <AttachmentThumbs urls={r.attachments} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {ticket.status === 'Open' && (
            <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
              {replyAttachments.length > 0 && (
                <div className="flex col gap-1" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                  {replyAttachments.map((url, i) => (
                    <div key={i} className="flex center gap-2" style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 6 }}>
                      <span className="text-xs text-mute" style={{ flex: 1 }}>Attachment {i + 1}</span>
                      <button className="icon-btn" onClick={() => removeAttachment(url)}><Icon name="x" size={12}/></button>
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
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Type your reply here…"
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
                  <input type="file" multiple accept="image/png,image/jpeg,application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} id="reply-file-upload" />
                  <label htmlFor="reply-file-upload" className="btn sm" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                    <Icon name="attach" size={11}/> {uploading ? 'Uploading...' : 'Attach files'}
                  </label>
                  <span className="text-xs text-mute" style={{ alignSelf: 'center' }}>or drag & drop onto the text area (PNG, JPG, PDF — 10MB max)</span>
                </div>
                <button className="btn primary" onClick={handleReply} disabled={!replyBody.trim() && replyAttachments.length === 0}><Icon name="send" size={12}/>Send reply</button>
              </div>
            </div>
          )}
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

      {showCloseConfirm && (
        <div className="modal-overlay" onClick={() => setShowCloseConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Close ticket</h3>
              <button className="icon-btn" onClick={() => setShowCloseConfirm(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="text-sm">Are you sure you want to close this ticket? You can create a new ticket if you need more help.</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowCloseConfirm(false)}>Cancel</button>
              <button className="btn accent" onClick={() => {
                setTicketStatus(ticket.id, 'Closed')
                setShowCloseConfirm(false)
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Delete ticket</h3>
              <button className="icon-btn" onClick={() => setShowDeleteConfirm(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="text-sm">Are you sure you want to delete this ticket? This action cannot be undone.</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn danger" onClick={() => {
                deleteTicket(ticket.id)
                onClose()
                setShowDeleteConfirm(false)
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  )
}
