import { supabase } from './supabase'

export const TICKET_ATTACHMENT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
export const TICKET_ATTACHMENT_MAX_FILE_SIZE = 10_000_000

export const getTicketAttachmentValidationError = (file: File) => {
  if (!TICKET_ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
    return `${file.name} is not allowed. Only PNG, JPG, and PDF files are accepted.`
  }

  if (file.size > TICKET_ATTACHMENT_MAX_FILE_SIZE) {
    return `${file.name} is too large. Maximum file size is 10MB.`
  }

  return null
}

export const uploadKYCDocument = async (
  file: File,
  userId: string,
  documentType: 'nrc_front' | 'nrc_back' | 'org_cert' | 'org_tax_id' | 'director_id'
) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${documentType}.${fileExt}`
  
  const { error } = await supabase.storage
    .from('kyc-documents')
    .upload(fileName, file)

  if (error) {
    throw error
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(fileName)

  return publicUrl
}

export const deleteKYCDocument = async (fileName: string) => {
  const { error } = await supabase.storage
    .from('kyc-documents')
    .remove([fileName])

  if (error) {
    throw error
  }
}

export const uploadTicketAttachment = async (
  file: File,
  ticketId?: string
) => {
  const validationError = getTicketAttachmentValidationError(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const fileName = ticketId 
    ? `${ticketId}/${Date.now()}-${file.name}`
    : `ticket-reply-${Date.now()}-${file.name}`
  
  const { error } = await supabase.storage
    .from('ticket-attachments')
    .upload(fileName, file)

  if (error) {
    throw error
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('ticket-attachments')
    .getPublicUrl(fileName)

  return publicUrl
}

export const deleteTicketAttachment = async (fileName: string) => {
  const { error } = await supabase.storage
    .from('ticket-attachments')
    .remove([fileName])

  if (error) {
    throw error
  }
}