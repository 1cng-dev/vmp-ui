// Email service using Resend API
// This requires RESEND_API_KEY and RESEND_FROM_EMAIL environment variables

interface VMRequestEmailParams {
  to: string
  customerName: string
  requestId: string
  requestType: string
  hostname: string
  details: string
  vmLegacyId?: string
  vcpu?: number
  ram?: number
  storage?: number
  osName?: string
  currentPlan?: string
  requestedPlan?: string
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

interface AddonRequestEmailParams {
  to: string
  customerName: string
  requestId: string
  vmHostname: string
  services: string
  duration: string
  vmLegacyId?: string
  startDate?: string
  specification?: string
}

interface SignupEmailParams {
  to: string
  customerName: string
  accountType: string
  email: string
}

interface KYCApprovalEmailParams {
  to: string
  customerName: string
  approvalDate: string
}

interface KYCRejectionEmailParams {
  to: string
  customerName: string
  rejectionReason?: string
}

interface KYCReopenEmailParams {
  to: string
  customerName: string
  reopenDate: string
}

interface ProvisioningCompletedEmailParams {
  to: string
  customerName: string
  requestType: string
  hostname: string
  requestId: string
  completionDate: string
  details?: string
  vmLegacyId?: string
  vmName?: string
  serviceId?: string
  ipAddress?: string
}

interface VMTerminatedEmailParams {
  to: string
  customerName: string
  hostname: string
  vmId: string
  terminationDate: string
  serviceType: string
}

interface VMActivatedEmailParams {
  to: string
  customerName: string
  hostname: string
  vmId: string
  activationDate: string
}

interface VMDeletedEmailParams {
  to: string
  customerName: string
  hostname: string
  vmId: string
  deletionDate: string
}

interface AddonServiceTerminatedEmailParams {
  to: string
  customerName: string
  serviceId: string
  vmId: string
  vmHostname: string
  services: string
  terminationDate: string
}

interface AddonServiceActivatedEmailParams {
  to: string
  customerName: string
  serviceId: string
  vmHostname: string
  services: string
  activationDate: string
}

interface AddonServiceDeletedEmailParams {
  to: string
  customerName: string
  serviceId: string
  vmHostname: string
  services: string
  deletionDate: string
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
  const isNewVMRequest = params.vcpu !== undefined
  const isChangePlanRequest = params.currentPlan !== undefined

  const changePlanContent = `
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin-bottom: 24px;">We have received your VM Plan Change Request.</p>
          <p style="margin-bottom: 24px;">VM Details:</p>
          <div class="info-box">
            <p><strong>VM ID:</strong> ${params.vmLegacyId}</p>
            <p><strong>Current Plan:</strong> ${params.currentPlan}</p>
            <p><strong>Requested Plan:</strong> ${params.requestedPlan}</p>
          </div>
          <p style="margin-bottom: 24px;">Our team will review your request and confirm the applicable charges, service impact, and implementation schedule before proceeding.</p>
          <p style="margin: 0;">We will keep you updated on the status of your request.</p>
  `

  const newRequestContent = `
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin: 0;">Thank you for your request for a new Virtual Machine (VM).</p>
          <p style="margin: 0;">We have received your request with the following details:</p>
          <div class="info-box">
            <p><strong>VM Request ID:</strong> ${params.requestId}</p>
            <p><strong>Request type:</strong> ${params.requestType}</p>
            <p><strong>CPU:</strong> ${params.vcpu} vCPU</p>
            <p><strong>RAM:</strong> ${params.ram} GB</p>
            <p><strong>Storage:</strong> ${params.storage} GB</p>
            <p><strong>Operating System:</strong> ${params.osName}</p>
          </div>
          <p style="margin: 0;">Our team will review your request and proceed with the provisioning process accordingly.</p>
          <p style="margin: 0;">We will notify you once the VM has been successfully provisioned.</p>
          <p style="margin: 0;">If you have any questions or would like to make changes to your request, please feel free to contact our support team.</p>
  `

  const oldRequestContent = `
          <p>Dear Valued Customer,</p>
          <div class="info-box">
            <p><strong>Request Type:</strong> ${params.requestType}</p>
            <p><strong>Request ID:</strong> ${params.requestId}</p>
            <p><strong>VM Hostname:</strong> ${params.hostname}</p>
            ${params.vmLegacyId ? `<p><strong>VM ID:</strong> ${params.vmLegacyId}</p>` : ''}
          </div>
          <p>${params.details}</p>
          <p>Our Portal: <a href="https://vmp.1cloudng.com">https://vmp.1cloudng.com</a></p>
  `

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
        .info-box p { margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          ${isChangePlanRequest ? changePlanContent : isNewVMRequest ? newRequestContent : oldRequestContent}
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

// Addon Request Email
export async function sendAddonRequestEmail(params: AddonRequestEmailParams) {
  const html = buildAddonRequestEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Add-on Service Request Received - ${params.requestId}`,
    html
  })
}

function buildAddonRequestEmailTemplate(params: AddonRequestEmailParams): string {
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
        .info-box p { margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin-bottom: 24px;">We have received your request for a new Add-on Service.</p>
          <p style="margin-bottom: 24px;">Request Details:</p>
          <div class="info-box">
            <p><strong>VM ID:</strong> ${params.vmLegacyId}</p>
            <p><strong>Add-on Service:</strong> ${params.services}</p>
            <p><strong>Specification:</strong> ${params.specification}</p>
            <p><strong>Requested Start Date:</strong> ${params.startDate}</p>
            <p><strong>Service Period:</strong> ${params.duration}</p>
          </div>
          <p style="margin-bottom: 24px;">Our team will review your request and proceed with the necessary arrangements.</p>
          <p style="margin: 0;">We will notify you once the requested Add-on Service has been successfully activated.</p>
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildAnnouncementEmailTemplate(params: AnnouncementEmailParams): string {
  const escapedBody = escapeHtml(params.body)
  const formattedBody = escapedBody
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left; }
        .container { margin: 0; padding: 20px; text-align: left; }
        .content { padding: 20px; text-align: left; }
        .footer { padding: 20px; text-align: left; font-size: 12px; color: #666; }
        .announcement-box { margin: 20px 0; text-align: left; }
        .announcement-body { margin: 0; line-height: 1.8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <div class="announcement-box">
            <h2 style="margin-top: 0;">${params.title}</h2>
            <div class="announcement-body">${formattedBody}</div>
          </div>
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


// Signup Success Email
export async function sendSignupEmail(params: SignupEmailParams) {
  const html = buildSignupEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: 'Account Created Successfully - KYC Review in Progress',
    html
  })
}

function buildSignupEmailTemplate(params: SignupEmailParams): string {
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
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin-bottom: 24px;">Thank you for signing up with our portal.</p>
          <p style="margin: 0;">We have successfully received your registration. Your account is now ready, and you can proceed with using our services.</p>
          <p style="margin: 0;">If you have any questions or need assistance, please contact our support team.</p>
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

// KYC Approval Email
export async function sendKYCApprovalEmail(params: KYCApprovalEmailParams) {
  const html = buildKYCApprovalEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: 'KYC Approved - Account Fully Activated',
    html
  })
}

function buildKYCApprovalEmailTemplate(params: KYCApprovalEmailParams): string {
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
          <p>Your KYC verification has been approved. Your account is now fully activated!</p>
          <div class="info-box">
            <p><strong>Customer Name:</strong> ${params.customerName}</p>
            <p><strong>Approval Date:</strong> ${params.approvalDate}</p>
          </div>
          <p>You now have full access to all features including:</p>
          <ul>
            <li>Deploy Virtual Machines</li>
            <li>Request Add-on Services</li>
            <li>View Invoices and Make Payments</li>
            <li>Access Customer Portal</li>
          </ul>
          <p>Log in to your account to start deploying your cloud infrastructure.</p>
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

// KYC Rejection Email (Optional)
export async function sendKYCRejectionEmail(params: KYCRejectionEmailParams) {
  const html = buildKYCRejectionEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: 'KYC Verification - Action Required',
    html
  })
}

function buildKYCRejectionEmailTemplate(params: KYCRejectionEmailParams): string {
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
          <p>Your KYC documents could not be verified at this time. Please review the details below.</p>
          <div class="info-box">
            <p><strong>Customer Name:</strong> ${params.customerName}</p>
            ${params.rejectionReason ? `<p><strong>Reason:</strong> ${params.rejectionReason}</p>` : ''}
          </div>
          <p>Please review your submitted documents and ensure they are clear and valid. You may need to resubmit your KYC documents with corrections.</p>
          <p>If you have any questions or need assistance, please contact our support team.</p>
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

// KYC Reopen Email
export async function sendKYCReopenEmail(params: KYCReopenEmailParams) {
  const html = buildKYCReopenEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: 'KYC Review Reopened',
    html
  })
}

function buildKYCReopenEmailTemplate(params: KYCReopenEmailParams): string {
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
          <p>Your KYC review has been reopened for further review.</p>
          <div class="info-box">
            <p><strong>Customer Name:</strong> ${params.customerName}</p>
            <p><strong>Reopen Date:</strong> ${params.reopenDate}</p>
          </div>
          <p>Our team is reviewing your KYC documents again. You will receive another email notification once the review is complete.</p>
          <p>If you have any questions or need assistance, please contact our support team.</p>
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

// Provisioning Completed Email
export async function sendProvisioningCompletedEmail(params: ProvisioningCompletedEmailParams) {
  const html = buildProvisioningCompletedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Provisioning Completed - ${params.requestType}`,
    html
  })
}

function buildProvisioningCompletedEmailTemplate(params: ProvisioningCompletedEmailParams): string {
  const isVMProvisioning = params.vmName !== undefined

  const vmContent = `
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin-bottom: 24px;">We are pleased to inform you that the provisioning of your VM has been successfully completed.</p>
          <p style="margin-bottom: 24px;">VM Information:</p>
          <div class="info-box">
            <p><strong>VM Name:</strong> ${params.vmName}</p>
            <p><strong>Service ID:</strong> ${params.serviceId || '-'}</p>
            <p><strong>IP Address:</strong> ${params.ipAddress || '-'}</p>
            <p><strong>Provisioning Date:</strong> ${new Date(params.completionDate).toLocaleDateString()}</p>
          </div>
          <p style="margin-bottom: 24px;">The VM is now ready for use.</p>
          <p style="margin: 0;">If you require any assistance, please contact our support team.</p>
  `

  const addonContent = `
          <p>Dear Valued Customer,</p>
          <div class="info-box">
            <p><strong>Request Type:</strong> ${params.requestType}</p>
            <p><strong>Request ID:</strong> ${params.requestId}</p>
            <p><strong>VM Hostname:</strong> ${params.hostname}</p>
            ${params.vmLegacyId ? `<p><strong>VM ID:</strong> ${params.vmLegacyId}</p>` : ''}
            <p><strong>Completion Date:</strong> ${new Date(params.completionDate).toLocaleDateString()}</p>
          </div>
          <p>Your ${params.requestType} provisioning has been completed successfully. ${params.details || ''}</p>
          <p>Our Portal: <a href="https://vmp.1cloudng.com">https://vmp.1cloudng.com</a></p>
  `

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
        .info-box p { margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          ${isVMProvisioning ? vmContent : addonContent}
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

// VM Terminated Email
export async function sendVMTerminatedEmail(params: VMTerminatedEmailParams) {
  const html = buildVMTerminatedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `VM Terminated - ${params.hostname}`,
    html
  })
}

function buildVMTerminatedEmailTemplate(params: VMTerminatedEmailParams): string {
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
        .info-box p { margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin-bottom: 24px;">This is to confirm that the following VM has been successfully terminated.</p>
          <p style="margin-bottom: 24px;">VM Details:</p>
          <div class="info-box">
            <p><strong>Service Type:</strong> ${params.serviceType}</p>
            <p><strong>VM ID:</strong> ${params.vmId}</p>
            <p><strong>Termination Date:</strong> ${new Date(params.terminationDate).toLocaleDateString()}</p>
          </div>
          <p style="margin-bottom: 24px;">Please note that the terminated VM is no longer available for use.</p>
          <p style="margin: 0;">If you have any questions regarding the termination or would like to activate a new service, please contact our support team.</p>
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

// VM Activated Email
export async function sendVMActivatedEmail(params: VMActivatedEmailParams) {
  const html = buildVMActivatedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `VM Activated - ${params.hostname}`,
    html
  })
}

function buildVMActivatedEmailTemplate(params: VMActivatedEmailParams): string {
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
            <p><strong>VM Hostname:</strong> ${params.hostname}</p>
            <p><strong>VM ID:</strong> ${params.vmId}</p>
            <p><strong>Activation Date:</strong> ${new Date(params.activationDate).toLocaleDateString()}</p>
          </div>
          <p>Your VM <strong>${params.hostname}</strong> has been successfully activated. The VM status has been changed to Active and its power state has been set to Running.</p>
          <p>You can now access and use your VM through our portal.</p>
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

// VM Deleted Email
export async function sendVMDeletedEmail(params: VMDeletedEmailParams) {
  const html = buildVMDeletedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `VM Deleted - ${params.hostname}`,
    html
  })
}

function buildVMDeletedEmailTemplate(params: VMDeletedEmailParams): string {
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
            <p><strong>VM Hostname:</strong> ${params.hostname}</p>
            <p><strong>VM ID:</strong> ${params.vmId}</p>
            <p><strong>Deletion Date:</strong> ${new Date(params.deletionDate).toLocaleDateString()}</p>
          </div>
          <p>Your VM <strong>${params.hostname}</strong> has been permanently deleted. All data associated with this VM has been removed and cannot be recovered.</p>
          <p>If you have any questions or need assistance, please contact our support team.</p>
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

// Add-on Service Terminated Email
export async function sendAddonServiceTerminatedEmail(params: AddonServiceTerminatedEmailParams) {
  const html = buildAddonServiceTerminatedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Add-on Service Terminated - ${params.serviceId}`,
    html
  })
}

function buildAddonServiceTerminatedEmailTemplate(params: AddonServiceTerminatedEmailParams): string {
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
        .info-box p { margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <p style="margin-bottom: 24px;">Dear Valued Customer,</p>
          <p style="margin-bottom: 24px;">This is to confirm that the following service has been successfully terminated.</p>
          <p style="margin-bottom: 24px;">VM Details:</p>
          <div class="info-box">
            <p><strong>VM ID:</strong> ${params.vmId}</p>
            <p><strong>Service Name:</strong> ${params.services}</p>
            <p><strong>Termination Date:</strong> ${new Date(params.terminationDate).toLocaleDateString()}</p>
          </div>
          <p style="margin-bottom: 24px;">Please note that the terminated service is no longer available for use.</p>
          <p style="margin: 0;">If you have any questions regarding the termination or would like to activate a new service, please contact our support team.</p>
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

// Add-on Service Activated Email
export async function sendAddonServiceActivatedEmail(params: AddonServiceActivatedEmailParams) {
  const html = buildAddonServiceActivatedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Add-on Service Activated - ${params.serviceId}`,
    html
  })
}

function buildAddonServiceActivatedEmailTemplate(params: AddonServiceActivatedEmailParams): string {
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
            <p><strong>Add-on Service ID:</strong> ${params.serviceId}</p>
            <p><strong>VM Hostname:</strong> ${params.vmHostname}</p>
            <p><strong>Services:</strong> ${params.services}</p>
            <p><strong>Activation Date:</strong> ${new Date(params.activationDate).toLocaleDateString()}</p>
          </div>
          <p>Your add-on service <strong>${params.serviceId}</strong> has been successfully activated. The service status has been changed to Active.</p>
          <p>You can now access and use this service through our portal.</p>
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

// Add-on Service Deleted Email
export async function sendAddonServiceDeletedEmail(params: AddonServiceDeletedEmailParams) {
  const html = buildAddonServiceDeletedEmailTemplate(params)

  return await callResendAPI({
    to: params.to,
    subject: `Add-on Service Deleted - ${params.serviceId}`,
    html
  })
}

function buildAddonServiceDeletedEmailTemplate(params: AddonServiceDeletedEmailParams): string {
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
            <p><strong>Add-on Service ID:</strong> ${params.serviceId}</p>
            <p><strong>VM Hostname:</strong> ${params.vmHostname}</p>
            <p><strong>Services:</strong> ${params.services}</p>
            <p><strong>Deletion Date:</strong> ${new Date(params.deletionDate).toLocaleDateString()}</p>
          </div>
          <p>Your add-on service <strong>${params.serviceId}</strong> has been permanently deleted. All data associated with this service has been removed and cannot be recovered.</p>
          <p>If you have any questions or need assistance, please contact our support team.</p>
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