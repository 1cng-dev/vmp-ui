// Email service using Resend API
// This requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables

interface VMRequestEmailParams {
  to: string
  customerName: string
  requestId: string
  requestType: string
  hostname: string
  details: string
}

interface InvoiceEmailParams {
  to: string
  customerName: string
  invoiceId: string
  amount: number
  dueDate: string
  pdfAttachment?: Buffer
}

interface ReceiptEmailParams {
  to: string
  customerName: string
  invoiceId: string
  receiptNumber: string
  amount: number
  paidDate: string
}

interface AnnouncementEmailParams {
  to: string
  customerName: string
  title: string
  body: string
  announcementId: string
}

// Helper function to call Resend API
async function callResendAPI(params: {
  to: string
  subject: string
  html: string
  attachments?: any[]
}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      ...params,
      from: 'One Cloud Net-Gen <notification@mail.1cloudng.com>'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Email API error:', error)
    return { success: false, error }
  }

  const result = await response.json()
  return result
}

// VM Request Email
export async function sendVMRequestEmail(params: VMRequestEmailParams) {
  const html = buildVMRequestEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `VM Request Received - ${params.requestType}`,
    html
  })
}

function buildVMRequestEmailTemplate(params: VMRequestEmailParams): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { max-width: 600px; margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
        .info-box { margin: 20px 0; text-align: left; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p>Dear Valued Customer,</p>
          <div class="info-box">
            <p><strong>Request Type:</strong> ${params.requestType}</p>
            <p><strong>Request ID:</strong> ${params.requestId}</p>
            <p><strong>VM Hostname:</strong> ${params.hostname}</p>
          </div>
          <p>${params.details}</p>
          <p>Our Portal: <a href="https://vmp.1cloudng.com">https://vmp.1cloudng.com</a></p>
        </div>
        <div class="footer">
          <p>Best Regards,<br>
          One Cloud Next-Gen Co., Ltd<br>
          support@system.1cloudng.com<br>
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;"></p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Invoice Email
export async function sendInvoiceEmail(params: InvoiceEmailParams) {
  const html = buildInvoiceEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Invoice ${params.invoiceId}`,
    html,
    attachments: params.pdfAttachment ? [{
      filename: `invoice-${params.invoiceId}.pdf`,
      content: params.pdfAttachment.toString('base64')
    }] : undefined
  })
}

function buildInvoiceEmailTemplate(params: InvoiceEmailParams): string {
  const formattedAmount = new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK'
  }).format(params.amount)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { max-width: 600px; margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
        .info-box { margin: 20px 0; text-align: left; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p>Dear Valued Customer,</p>
          <div class="info-box">
            <p><strong>Invoice ID:</strong> ${params.invoiceId}</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Due Date:</strong> ${new Date(params.dueDate).toLocaleDateString()}</p>
          </div>
          <p>Your invoice is now available. Please find the PDF attached to this email.</p>
          <p>Our Portal: <a href="https://vmp.1cloudng.com">https://vmp.1cloudng.com</a></p>
        </div>
        <div class="footer">
          <p>Best Regards,<br>
          One Cloud Next-Gen Co., Ltd<br>
          support@system.1cloudng.com<br>
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;"></p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Receipt Email
export async function sendReceiptEmail(params: ReceiptEmailParams) {
  const html = buildReceiptEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Payment Receipt - ${params.receiptNumber}`,
    html
  })
}

function buildReceiptEmailTemplate(params: ReceiptEmailParams): string {
  const formattedAmount = new Intl.NumberFormat('en-MM', {
    style: 'currency',
    currency: 'MMK'
  }).format(params.amount)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { max-width: 600px; margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
        .info-box { margin: 0; text-align: left; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p>Dear Valued Customer,</p>
          <p>This is to notify you that your Payment has been successfully processed. Please find the transaction details below for your reference.</p>
          <div class="info-box">
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Invoice Number:</strong> ${params.invoiceId}</p>
          </div>
          <p>If you have any questions, please don't hesitate to contact us at finance@1cloudng.com</p>
        </div>
        <div class="footer">
          <p>Best Regards,<br>
          One Cloud Next-Gen Co., Ltd<br>
          support@system.1cloudng.com<br>
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;"></p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Announcement Email
export async function sendAnnouncementEmail(params: AnnouncementEmailParams) {
  const html = buildAnnouncementEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: params.title,
    html
  })
}

function buildAnnouncementEmailTemplate(params: AnnouncementEmailParams): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { max-width: 600px; margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
        .announcement-box { margin: 20px 0; text-align: left; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p>Dear Valued Customer,</p>
          <div class="announcement-box">
            <h2 style="margin-top: 0;">${params.title}</h2>
            <p>${params.body}</p>
          </div>
          <p>Our Portal: <a href="https://vmp.1cloudng.com">https://vmp.1cloudng.com</a></p>
        </div>
        <div class="footer">
          <p>Best Regards,<br>
          One Cloud Next-Gen Co., Ltd<br>
          support@system.1cloudng.com<br>
          <img src="https://i.ibb.co/3mxXtQ8d/logo.png" alt="Company Logo" style="width: 150px; height: auto; margin-top: 10px;"></p>
        </div>
      </div>
    </body>
    </html>
  `
}
