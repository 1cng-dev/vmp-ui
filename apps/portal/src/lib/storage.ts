import { supabase } from './supabase'

export const TICKET_ATTACHMENT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
export const TICKET_ATTACHMENT_MAX_FILE_SIZE = 10_000_000

export const KYC_DOCUMENT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
export const KYC_DOCUMENT_MAX_FILE_SIZE = 5_000_000

export const getKYCDocumentValidationError = (file: File) => {
  if (!KYC_DOCUMENT_ALLOWED_TYPES.includes(file.type)) {
    return `${file.name} is not allowed. Only PNG, JPG, and PDF files are accepted.`
  }

  if (file.size > KYC_DOCUMENT_MAX_FILE_SIZE) {
    return `${file.name} is too large. Maximum file size is 5MB.`
  }

  return null
}

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
    .upload(fileName, file, { upsert: true })

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

export const uploadInvoicePDF = async (
  pdfBase64: string,
  invoiceId: string
): Promise<string> => {
  // Convert base64 to blob
  const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const file = new File([blob], `invoice-${invoiceId}.pdf`, { type: 'application/pdf' })

  const fileName = `${invoiceId}.pdf`
  
  const { error } = await supabase.storage
    .from('invoices')
    .upload(fileName, file, { upsert: true })

  if (error) {
    throw error
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('invoices')
    .getPublicUrl(fileName)

  return publicUrl
}

export const getInvoicePDFUrl = (invoiceId: string): string => {
  const fileName = `${invoiceId}.pdf`
  const { data: { publicUrl } } = supabase.storage
    .from('invoices')
    .getPublicUrl(fileName)
  return publicUrl
}

export const fetchPDFAsBase64 = async (pdfUrl: string): Promise<string | undefined> => {
  try {
    const response = await fetch(pdfUrl)
    if (!response.ok) return undefined
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        resolve(dataUrl.replace(/^data:application\/pdf;base64,/, ''))
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.error('Failed to fetch PDF as base64:', err)
    return undefined
  }
}