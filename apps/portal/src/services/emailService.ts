// Email service using Resend API
// This requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables

import axios from 'axios';

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

const resendApi = axios.create({
  baseURL: 'https://api.resend.com',
  timeout: 10000,
})

// Helper function to call Resend API
async function callResendAPI(params: {
  to: string
  subject: string
  html: string
  attachments?: any[]
}) {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...params,
      from: '1CNG <onboarding@resend.dev>'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Email API error:', error)
    return { success: false, error }
  }

  return { success: true }
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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .info-box { border-left: 4px solid #3b82f6; padding: 15px; background: white; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>VM Request Received</h1>
        </div>
        <div class="content">
          <p>Dear ${params.customerName},</p>
          <div class="info-box">
            <p><strong>Request Type:</strong> ${params.requestType}</p>
            <p><strong>Request ID:</strong> ${params.requestId}</p>
            <p><strong>VM Hostname:</strong> ${params.hostname}</p>
          </div>
          <p>${params.details}</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}/customer-portal" class="button">View in Portal</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .info-box { border-left: 4px solid #f59e0b; padding: 15px; background: white; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice Available</h1>
        </div>
        <div class="content">
          <p>Dear ${params.customerName},</p>
          <div class="info-box">
            <p><strong>Invoice ID:</strong> ${params.invoiceId}</p>
            <p><strong>Amount:</strong> ${formattedAmount}</p>
            <p><strong>Due Date:</strong> ${new Date(params.dueDate).toLocaleDateString()}</p>
          </div>
          <p>Your invoice is now available. Please find the PDF attached to this email.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}/customer-portal/invoices" class="button">View in Portal</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .info-box { border-left: 4px solid #10b981; padding: 15px; background: white; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Received</h1>
        </div>
        <div class="content">
          <p>Dear ${params.customerName},</p>
          <div class="info-box">
            <p><strong>Receipt Number:</strong> ${params.receiptNumber}</p>
            <p><strong>Invoice ID:</strong> ${params.invoiceId}</p>
            <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
            <p><strong>Payment Date:</strong> ${params.paidDate}</p>
          </div>
          <p>Thank you for your payment. Your transaction has been successfully processed.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}/customer-portal/invoices" class="button">View in Portal</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
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
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .announcement-box { border-left: 4px solid #8b5cf6; padding: 15px; background: white; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📢 Announcement</h1>
        </div>
        <div class="content">
          <p>Dear ${params.customerName},</p>
          <div class="announcement-box">
            <h2 style="margin-top: 0;">${params.title}</h2>
            <p>${params.body}</p>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${window.location.origin}/customer-portal" class="button">View in Portal</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
