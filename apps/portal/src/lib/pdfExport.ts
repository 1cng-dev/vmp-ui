import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

 const triggerPDFDownload = (pdf: jsPDF, filename: string) => {
   const pdfBuffer = pdf.output('arraybuffer')
   const blob = new Blob([pdfBuffer], { type: 'application/octet-stream' })
   const url = URL.createObjectURL(blob)
   const link = document.createElement('a')
   link.href = url
   link.download = filename
   link.target = '_self'
   link.rel = 'noopener noreferrer'
   link.style.display = 'none'
   document.body.appendChild(link)
   link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
   document.body.removeChild(link)
   setTimeout(() => URL.revokeObjectURL(url), 1000)
 }

export const exportToPDF = <T extends Record<string, any>>(
  data: T[],
  filename: string,
  title: string,
  columns?: { key: keyof T; label: string }[]
) => {
  // If no columns specified, use all keys from first item
  const headers = columns ||
    (data.length > 0 ? Object.keys(data[0]).map(key => ({ key, label: key as string })) : [])

  // Create HTML table
  const tableHtml = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h2 style="margin-bottom: 5px;">${title}</h2>
      <p style="color: #666; font-size: 12px; margin-bottom: 20px;">
        Generated: ${new Date().toLocaleDateString()}
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f5f5f5;">
            ${headers.map(h => `<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(h => {
    const value = row[h.key]
    const stringValue = typeof value === 'object'
      ? JSON.stringify(value)
      : String(value ?? '')
    return `<td style="padding: 8px; border: 1px solid #ddd;">${stringValue}</td>`
  }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  // Open new window with print dialog
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>${filename}</title>
          <style>
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>${tableHtml}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }
}

export const exportToPDFAuto = async <T extends Record<string, any>>(
  data: T[],
  filename: string,
  title: string,
  columns?: { key: keyof T; label: string }[]
) => {
  // If no columns specified, use all keys from first item
  const headers = columns ||
    (data.length > 0 ? Object.keys(data[0]).map(key => ({ key, label: key as string })) : [])

  // Create HTML table
  const tableHtml = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h2 style="margin-bottom: 5px;">${title}</h2>
      <p style="color: #666; font-size: 12px; margin-bottom: 20px;">
        Generated: ${new Date().toLocaleDateString()}
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f5f5f5;">
            ${headers.map(h => `<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(h => {
    const value = row[h.key]
    const stringValue = typeof value === 'object'
      ? JSON.stringify(value)
      : String(value ?? '')
    return `<td style="padding: 8px; border: 1px solid #ddd;">${stringValue}</td>`
  }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  // Create a temporary container
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.width = '210mm'
  container.innerHTML = tableHtml
  document.body.appendChild(container)

  try {
    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false
    })

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const pageMargin = 10
    const imgWidth = pageWidth - pageMargin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const maxPageHeight = pageHeight - pageMargin * 2

    // Calculate how many pages we need
    const totalPages = Math.ceil(imgHeight / maxPageHeight)

    // Split content across multiple pages if needed
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage()
      }
      const yOffset = i * maxPageHeight
      const remainingHeight = Math.min(maxPageHeight, imgHeight - yOffset)
      
      // Create a temporary canvas for this page
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = (remainingHeight * canvas.width) / imgWidth
      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          (yOffset * canvas.height) / imgHeight,
          canvas.width,
          (remainingHeight * canvas.height) / imgHeight,
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        )
      }
      
      const pageImgData = pageCanvas.toDataURL('image/png')
      pdf.addImage(pageImgData, 'PNG', pageMargin, pageMargin, imgWidth, remainingHeight)
    }
    
    triggerPDFDownload(pdf, `${filename}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

export const exportQuoteToPDF = async (quote: any, customer: any) => {
  const logoUrl = '/src/public/assets/logo.png'
  const signatureUrl = '/src/public/assets/sign1.png'
  const lineItems = quote.line_items || []

  const formatDate = (date: string) => {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear().toString().slice(-2)
  return `${day}-${month}-${year}`
}
  const formatMMK = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // Helper: fetch image and convert to data URL
  const toDataUrl = async (path: string): Promise<string | null> => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const firstAvailable = async (paths: string[]) => {
    for (const p of paths) {
      const url = await toDataUrl(p)
      if (url) return url
    }
    return null
  }

  // Try multiple paths to be resilient to asset placement and spacing
  const logoDataUrl = await firstAvailable([
    '/assets/logo.png',
    '/logo.png',
    '/src/public/assets/logo.png',
    '/src/public/assets/OC_DS2-removebg-preview (1).png',
    '/src/public/assets/OC_DS2-removebg-preview%20(1).png',
    '/assets/OC_DS2-removebg-preview (1).png',
    '/assets/OC_DS2-removebg-preview%20(1).png',
    '/OC_DS2-removebg-preview (1).png',
    '/OC_DS2-removebg-preview%20(1).png',
  ])

  const signatureDataUrl = await firstAvailable([
    '/assets/sign1.png',
    '/sign1.png',
    '/src/public/assets/sign1.png',
  ])

  const getTermMultiplier = (term: string) => {
    switch (term) {
      case 'Monthly': return 1
      case 'Quarterly': return 3
      case 'Half Yearly': return 6
      case 'Yearly': return 12
      default:
        const monthsMatch = term.match(/(\d+)\s*months/)
        if (monthsMatch) return parseInt(monthsMatch[1], 10)
        return 1
    }
  }

  const instanceItems = lineItems.filter((item: any) => item.kind === 'instance')
  const backupItems = lineItems.filter((item: any) => item.kind === 'backup')
  const publicIPItems = lineItems.filter((item: any) => item.kind === 'publicIP')

  // Use raw values from database directly without any rounding
  const instanceTotal = parseFloat(quote.instance_total) || 0
  const backupTotal = parseFloat(quote.backup_total) || 0
  const publicIPTotal = parseFloat(quote.public_ip_total) || 0
  const subtotal = instanceTotal + backupTotal + publicIPTotal
  const discount = parseFloat(quote.discount_amount) || 0
  const tax = parseFloat(quote.tax_amount) || 0
  const grandTotal = parseFloat(quote.grand_total) || 0

  const html = `
    <html>
      <head>
        <title>Quote ${quote.legacy_id || quote.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 18mm; }
          body { font-family: Arial, sans-serif; padding: 50px; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .logo { max-width: 120px; }
          .quote-title { text-align: right; }
          .quote-title h2 { font-size: 20px; font-weight: bold; color: #1a365d; margin-bottom: 4px; letter-spacing: 0.04em; }
          .quote-title h3 { font-size: 28px; font-weight: bold; color: #1a365d; margin: 0; letter-spacing: 0.06em; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 24px; }
          .info-section h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.06em; text-transform: uppercase; }
          .info-section p { font-size: 12px; line-height: 1.6; margin-bottom: 4px; }
          .table-container { width: 100%; margin-bottom: 16px; }
          .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .table th { background: #1a365d; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table td { padding: 10px 12px; border-bottom: 1px dotted #94a3b8; font-size: 12px; }
          .table .subtotal-row td { background: #f7fafc; font-weight: 700; border-bottom: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table th.num, .table td.num { text-align: right; }
          .table th.term, .table td.term { text-align: right; }
          .totals { margin-left: auto; width: 360px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
          .total-row.grand-total { font-weight: 800; font-size: 14px; border-top: 2px solid #1a365d; padding-top: 10px; margin-top: 6px; }
          .notes { margin-top: 22px; padding: 16px; background: #f7fafc; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .notes h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.04em; }
          .notes p { font-size: 12px; line-height: 1.6; color: #555; }
          .signature-block { display: flex; gap: 28px; align-items: flex-end; margin-top: 28px; }
          .sig-col { flex: 1; }
          .sig-label { font-size: 12px; color: #666; margin-bottom: 6px; }
          .sig-image { height: 64px; }
          .sig-line { margin-top: 8px; width: 240px; border-top: 1px solid #1a365d; }
          .sig-name { font-size: 12px; font-weight: 700; color: #1a365d; margin-top: 6px; }
          .sig-title { font-size: 11px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoDataUrl || logoUrl}" alt="One Cloud Logo" class="logo" onerror="this.style.display='none'">
          <div class="quote-title info-section">
            <h2>ONE CLOUD NEXT-GEN CO., LTD</h2>
           <h3>QUOTATION</h3>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>QUOTATION TO</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.org_name ? `<p>${customer.org_name}</p>` : ''}
            <p>${customer.email}</p>
          </div>
          <div class="info-section" style="text-align: right;">
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Number</strong></p>
            <p style="margin-bottom: 12px;font-weight: bold;">${quote.legacy_id || quote.id}</p>
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Date</strong></p>
            <p style="font-weight: bold;">${formatDate(quote.created_at)}</p>
          </div>
        </div>

        ${instanceItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Instance Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:28%">
              <col style="width:7%">
              <col style="width:10%">
              <col style="width:10%">
              <col style="width:6%">
              <col style="width:14%">
              <col style="width:11%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Specification</th>
                <th>vCPU</th>
                <th>RAM (GB)</th>
                <th>Storage (GB)</th>
                <th>Qty</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="term">Billing Term</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${instanceItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * item.qty * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'VM Instance'}</td>
                  <td>${item.vcpu || '-'}</td>
                  <td>${item.ram_gb || item.ram || '-'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td>${item.qty || 1}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="7" style="text-align: right;">Instance Cost Total:</td>
                <td>MMK ${formatMMK(instanceTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${backupItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Backup Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:45%">
              <col style="width:16%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Backup Type</th>
                <th>Storage (GB)</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${backupItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Backup'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="4" style="text-align: right;">Backup Cost Total:</td>
                <td>MMK ${formatMMK(backupTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${publicIPItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Public IP Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:61%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Service</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${publicIPItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Public IP'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="3" style="text-align: right;">Public IP Cost Total:</td>
                <td>MMK ${formatMMK(publicIPTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        <div class="totals">
          ${instanceTotal > 0 ? `
            <div class="total-row">
              <span>Instance Cost Total:</span>
              <span>MMK ${formatMMK(instanceTotal)}</span>
            </div>
          ` : ''}
          ${backupTotal > 0 ? `
            <div class="total-row">
              <span>Backup Cost Total:</span>
              <span>MMK ${formatMMK(backupTotal)}</span>
            </div>
          ` : ''}
          ${publicIPTotal > 0 ? `
            <div class="total-row">
              <span>Public IP Cost Total:</span>
              <span>MMK ${formatMMK(publicIPTotal)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Sub Total:</span>
            <span>MMK ${formatMMK(subtotal)}</span>
          </div>
          ${discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-MMK ${formatMMK(discount)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Tax (${quote.tax_pct || 5}%):</span>
            <span>MMK ${formatMMK(tax)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Grand Total:</span>
            <span>MMK ${formatMMK(grandTotal)}</span>
          </div>
        </div>

        <div class="notes">
          <h3>Remark : </h3>
          <p>There is no limitation on bandwidth speed.</p>
          <p>Monthly data transfer up to 100 GB is included free of charge.</p>
          <p>Additional usage beyond 100 GB will be charged at 99 MMK per GB </p>
          <p>Please note that public IP addresses will incur additional charges. The unit price is 6,570 MMK per public IP per month.</p>
          <p>SLA : 99.95% uptime commitment </p>
        </div>

        <div class="signature-block">
          <div class="sig-col">
            <div class="sig-label">Signed On Behalf of : </div>
            <img src="${signatureDataUrl || signatureUrl}" alt="Signature" class="sig-image" onerror="this.style.display='none'"/>
            <p>Hnin Yadana Htwe</p>
            <p>Business Development Manager </p> 
            <p>09-256215664</p>
            <p>hninyadanahtwe@1cloudng.com</p>
          </div>

        </div>

       
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    const waitForImages = async () => {
      try {
        const imgs = Array.from(printWindow.document.images)
        if (imgs.length === 0) return
        await new Promise<void>(resolve => {
          let remaining = imgs.length
          const done = () => { remaining -= 1; if (remaining <= 0) resolve() }
          imgs.forEach(img => {
            if (img.complete) done()
            else {
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
            }
          })
          setTimeout(resolve, 800) // fallback timeout
        })
      } catch { }
    }
    await waitForImages()
    printWindow.print()
  }
}

export const exportQuoteToPDFAuto = async (quote: any, customer: any) => {
  const logoUrl = '/src/public/assets/logo.png'
  const signatureUrl = '/src/public/assets/sign1.png'
  const lineItems = quote.line_items || []

  const formatDate = (date: string) => {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear().toString().slice(-2)
  return `${day}-${month}-${year}`
}
  const formatMMK = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // Helper: fetch image and convert to data URL
  const toDataUrl = async (path: string): Promise<string | null> => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const firstAvailable = async (paths: string[]) => {
    for (const p of paths) {
      const url = await toDataUrl(p)
      if (url) return url
    }
    return null
  }

  // Try multiple paths to be resilient to asset placement and spacing
  const logoDataUrl = await firstAvailable([
    '/assets/logo.png',
    '/logo.png',
    '/src/public/assets/logo.png',
    '/src/public/assets/OC_DS2-removebg-preview (1).png',
    '/src/public/assets/OC_DS2-removebg-preview%20(1).png',
    '/assets/OC_DS2-removebg-preview (1).png',
    '/assets/OC_DS2-removebg-preview%20(1).png',
    '/OC_DS2-removebg-preview (1).png',
    '/OC_DS2-removebg-preview%20(1).png',
  ])

  const signatureDataUrl = await firstAvailable([
    '/assets/sign1.png',
    '/sign1.png',
    '/src/public/assets/sign1.png',
  ])

  const getTermMultiplier = (term: string) => {
    switch (term) {
      case 'Monthly': return 1
      case 'Quarterly': return 3
      case 'Half Yearly': return 6
      case 'Yearly': return 12
      default:
        const monthsMatch = term.match(/(\d+)\s*months/)
        if (monthsMatch) return parseInt(monthsMatch[1], 10)
        return 1
    }
  }

  const instanceItems = lineItems.filter((item: any) => item.kind === 'instance')
  const backupItems = lineItems.filter((item: any) => item.kind === 'backup')
  const publicIPItems = lineItems.filter((item: any) => item.kind === 'publicIP')

  // Use raw values from database directly without any rounding
  const instanceTotal = parseFloat(quote.instance_total) || 0
  const backupTotal = parseFloat(quote.backup_total) || 0
  const publicIPTotal = parseFloat(quote.public_ip_total) || 0
  const subtotal = instanceTotal + backupTotal + publicIPTotal
  const discount = parseFloat(quote.discount_amount) || 0
  const tax = parseFloat(quote.tax_amount) || 0
  const grandTotal = parseFloat(quote.grand_total) || 0

  const html = `
    <html>
      <head>
        <title>Quote ${quote.legacy_id || quote.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 18mm; }
          body { font-family: Arial, sans-serif; padding: 50px; color: #333; }
          :root {
            --accent: #4f46e5;
            --accent-soft: #e0e7ff;
            --ok: #10b981;
            --ok-soft: #d1fae5;
            --warn: #f59e0b;
            --warn-soft: #fef3c7;
            --bad: #ef4444;
            --bad-soft: #fee2e2;
            --info: #3b82f6;
            --info-soft: #dbeafe;
            --bg: #ffffff;
            --surface: #ffffff;
            --surface-2: #f8fafc;
            --surface-3: #f1f5f9;
            --line: #e2e8f0;
            --ink: #0f172a;
            --ink-2: #334155;
            --ink-3: #64748b;
            --ink-4: #94a3b8;
          }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .logo { max-width: 120px; }
          .quote-title { text-align: right; }
          .quote-title h2 { font-size: 20px; font-weight: bold; color: #1a365d; margin-bottom: 4px; letter-spacing: 0.04em; }
          .quote-title h3 { font-size: 28px; font-weight: bold; color: #1a365d; margin: 0; letter-spacing: 0.06em; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 24px; }
          .info-section h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.06em; text-transform: uppercase; }
          .info-section p { font-size: 12px; line-height: 1.6; margin-bottom: 4px; }
          .table-container { width: 100%; margin-bottom: 16px; }
          .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .table th { background: #1a365d; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table td { padding: 10px 12px; border-bottom: 1px dotted #94a3b8; font-size: 12px; }
          .table .subtotal-row td { background: #f7fafc; font-weight: 700; border-bottom: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table th.num, .table td.num { text-align: right; }
          .table th.term, .table td.term { text-align: right; }
          .totals { margin-left: auto; width: 360px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
          .total-row.grand-total { font-weight: 800; font-size: 14px; border-top: 2px solid #1a365d; padding-top: 10px; margin-top: 6px; }
          .notes { margin-top: 22px; padding: 16px; background: #f7fafc; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .notes h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.06em; }
          .notes p { font-size: 12px; line-height: 1.6; color: #555; }
          .signature-block { display: flex; gap: 28px; align-items: flex-end; margin-top: 28px; }
          .sig-col { flex: 1; }
          .sig-label { font-size: 12px; color: #666; margin-bottom: 6px; }
          .sig-image { height: 64px; }
          .sig-line { margin-top: 8px; width: 240px; border-top: 1px solid #1a365d; }
          .sig-name { font-size: 12px; font-weight: 700; color: #1a365d; margin-top: 6px; }
          .sig-title { font-size: 11px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoDataUrl || logoUrl}" alt="One Cloud Logo" class="logo" onerror="this.style.display='none'">
          <div class="quote-title info-section">
            <h2>ONE CLOUD NEXT-GEN CO., LTD</h2>
           <h3>QUOTATION</h3>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>QUOTATION TO</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.org_name ? `<p>${customer.org_name}</p>` : ''}
            <p>${customer.email}</p>
          </div>
          <div class="info-section" style="text-align: right;">
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Number</strong></p>
            <p style="margin-bottom: 12px;font-weight: bold;">${quote.legacy_id || quote.id}</p>
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Date</strong></p>
            <p style="font-weight: bold;">${formatDate(quote.created_at)}</p>
          </div>
        </div>

        ${instanceItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Instance Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:28%">
              <col style="width:7%">
              <col style="width:10%">
              <col style="width:10%">
              <col style="width:6%">
              <col style="width:14%">
              <col style="width:11%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Specification</th>
                <th>vCPU</th>
                <th>RAM (GB)</th>
                <th>Storage (GB)</th>
                <th>Qty</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="term">Billing Term</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${instanceItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * item.qty * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'VM Instance'}</td>
                  <td>${item.vcpu || '-'}</td>
                  <td>${item.ram_gb || item.ram || '-'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td>${item.qty || 1}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="7" style="text-align: right;">Instance Cost Total:</td>
                <td>MMK ${formatMMK(instanceTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${backupItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Backup Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:45%">
              <col style="width:16%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Backup Type</th>
                <th>Storage (GB)</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${backupItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Backup'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="4" style="text-align: right;">Backup Cost Total:</td>
                <td>MMK ${formatMMK(backupTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${publicIPItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Public IP Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:61%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Service</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${publicIPItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Public IP'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="3" style="text-align: right;">Public IP Cost Total:</td>
                <td>MMK ${formatMMK(publicIPTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        <div class="totals">
          ${instanceTotal > 0 ? `
            <div class="total-row">
              <span>Instance Cost Total:</span>
              <span>MMK ${formatMMK(instanceTotal)}</span>
            </div>
          ` : ''}
          ${backupTotal > 0 ? `
            <div class="total-row">
              <span>Backup Cost Total:</span>
              <span>MMK ${formatMMK(backupTotal)}</span>
            </div>
          ` : ''}
          ${publicIPTotal > 0 ? `
            <div class="total-row">
              <span>Public IP Cost Total:</span>
              <span>MMK ${formatMMK(publicIPTotal)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Sub Total:</span>
            <span>MMK ${formatMMK(subtotal)}</span>
          </div>
          ${discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-MMK ${formatMMK(discount)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Tax (${quote.tax_pct || 5}%):</span>
            <span>MMK ${formatMMK(tax)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Grand Total:</span>
            <span>MMK ${formatMMK(grandTotal)}</span>
          </div>
        </div>

        <div class="notes">
          <h3>Remark : </h3>
          <p>There is no limitation on bandwidth speed.</p>
          <p>Monthly data transfer up to 100 GB is included free of charge.</p>
          <p>Additional usage beyond 100 GB will be charged at 99 MMK per GB </p>
          <p>Please note that public IP addresses will incur additional charges. The unit price is 6,570 MMK per public IP per month.</p>
          <p>SLA : 99.95% uptime commitment </p>
        </div>

        <div class="signature-block">
          <div class="sig-col">
            <div class="sig-label">Signed On Behalf of : </div>
            <img src="${signatureDataUrl || signatureUrl}" alt="Signature" class="sig-image" onerror="this.style.display='none'"/>
            <p>Hnin Yadana Htwe</p>
            <p>Business Development Manager </p> 
            <p>09-256215664</p>
            <p>hninyadanahtwe@1cloudng.com</p>
          </div>

        </div>

       
      </body>
    </html>
  `

  // Create a temporary container
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.width = '210mm'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    // Wait for images to load
    const waitForImages = async () => {
      try {
        const imgs = Array.from(container.querySelectorAll('img'))
        if (imgs.length === 0) return
        await new Promise<void>(resolve => {
          let remaining = imgs.length
          const done = () => { remaining -= 1; if (remaining <= 0) resolve() }
          imgs.forEach(img => {
            if ((img as HTMLImageElement).complete) done()
            else {
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
            }
          })
          setTimeout(resolve, 800)
        })
      } catch { }
    }
    await waitForImages()

    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false
    })

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const pageMargin = 10
    const imgWidth = pageWidth - pageMargin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const maxPageHeight = pageHeight - pageMargin * 2

    // Calculate how many pages we need
    const totalPages = Math.ceil(imgHeight / maxPageHeight)

    // Split content across multiple pages if needed
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage()
      }
      const yOffset = i * maxPageHeight
      const remainingHeight = Math.min(maxPageHeight, imgHeight - yOffset)
      
      // Create a temporary canvas for this page
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = (remainingHeight * canvas.width) / imgWidth
      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          (yOffset * canvas.height) / imgHeight,
          canvas.width,
          (remainingHeight * canvas.height) / imgHeight,
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        )
      }
      
      const pageImgData = pageCanvas.toDataURL('image/png')
      pdf.addImage(pageImgData, 'PNG', pageMargin, pageMargin, imgWidth, remainingHeight)
    }
    
    triggerPDFDownload(pdf, `Quote-${quote.legacy_id || quote.id}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

export const exportInvoiceToPDF = async (invoice: any, customer: any) => {
  const logoUrl = '/src/public/assets/logo.png'
  const lineItems = invoice.line_items || []

  const formatDate = (date: string) => {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear().toString().slice(-2)
  return `${day}-${month}-${year}`
}
  const formatMMK = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // Helper: fetch image and convert to data URL
  const toDataUrl = async (path: string): Promise<string | null> => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const firstAvailable = async (paths: string[]) => {
    for (const p of paths) {
      const url = await toDataUrl(p)
      if (url) return url
    }
    return null
  }

  // Try multiple paths to be resilient to asset placement and spacing
  const logoDataUrl = await firstAvailable([
    '/assets/logo.png',
    '/logo.png',
    '/src/public/assets/logo.png',
    '/src/public/assets/OC_DS2-removebg-preview (1).png',
    '/src/public/assets/OC_DS2-removebg-preview%20(1).png',
    '/assets/OC_DS2-removebg-preview (1).png',
    '/assets/OC_DS2-removebg-preview%20(1).png',
    '/OC_DS2-removebg-preview (1).png',
    '/OC_DS2-removebg-preview%20(1).png',
  ])

  const getTermMultiplier = (term: string) => {
    switch (term) {
      case 'Monthly': return 1
      case 'Quarterly': return 3
      case 'Half Yearly': return 6
      case 'Yearly': return 12
      default:
        const monthsMatch = term.match(/(\d+)\s*months/)
        if (monthsMatch) return parseInt(monthsMatch[1], 10)
        return 1
    }
  }

  const instanceItems = lineItems.filter((item: any) => item.kind === 'instance')
  const backupItems = lineItems.filter((item: any) => item.kind === 'backup')
  const publicIPItems = lineItems.filter((item: any) => item.kind === 'publicIP')

  // Use raw values from database directly without any rounding
  const subtotal = parseFloat(invoice.amount) || 0
  const discount = parseFloat(invoice.discount) || 0
  const tax = parseFloat(invoice.vat) || 0
  const grandTotal = parseFloat(invoice.gross_amount) || 0

  // Calculate component totals from line_items for display only (no rounding)
  const instanceTotal = instanceItems.reduce((sum: number, item: any) => {
    const extended = item.extended_price || (item.unit * item.qty * getTermMultiplier(item.term))
    return sum + extended
  }, 0)
  const backupTotal = backupItems.reduce((sum: number, item: any) => {
    const extended = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return sum + extended
  }, 0)
  const publicIPTotal = publicIPItems.reduce((sum: number, item: any) => {
    const extended = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return sum + extended
  }, 0)

  const html = `
    <html>
      <head>
        <title>Invoice ${invoice.legacy_id || invoice.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 18mm; }
          body { font-family: Arial, sans-serif; padding: 50px; color: #333; min-height: 100vh; display: flex; flex-direction: column; }
          .content { flex: 1; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .logo { max-width: 120px; }
          .quote-title { text-align: right; }
          .quote-title h2 { font-size: 20px; font-weight: bold; color: #1a365d; margin-bottom: 4px; letter-spacing: 0.04em; }
          .quote-title h3 { font-size: 28px; font-weight: bold; color: #1a365d; margin: 0; letter-spacing: 0.06em; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 24px; }
          .info-section h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.06em; text-transform: uppercase; }
          .info-section p { font-size: 12px; line-height: 1.6; margin-bottom: 4px; }
          .table-container { width: 100%; margin-bottom: 16px; }
          .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .table th { background: #1a365d; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table td { padding: 10px 12px; border-bottom: 1px dotted #94a3b8; font-size: 12px; }
          .table .subtotal-row td { background: #f7fafc; font-weight: 700; border-bottom: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table th.num, .table td.num { text-align: right; }
          .table th.term, .table td.term { text-align: right; }
          .totals { margin-left: auto; width: 360px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
          .total-row.grand-total { font-weight: 800; font-size: 14px; border-top: 2px solid #1a365d; padding-top: 10px; margin-top: 6px; }
          .notes { margin-top: 22px; padding: 16px; background: #f7fafc; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .notes h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.04em; }
          .notes p { font-size: 12px; line-height: 1.6; color: #555; }
          .signature-block { display: flex; gap: 28px; align-items: flex-end; margin-top: 28px; }
          .sig-col { flex: 1; }
          .sig-label { font-size: 12px; color: #666; margin-bottom: 6px; }
          .sig-image { height: 64px; }
          .sig-line { margin-top: 8px; width: 240px; border-top: 1px solid #1a365d; }
          .sig-name { font-size: 12px; font-weight: 700; color: #1a365d; margin-top: 6px; }
          .sig-title { font-size: 11px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="content">
        <div class="header">
          <img src="${logoDataUrl || logoUrl}" alt="One Cloud Logo" class="logo" onerror="this.style.display='none'">
          <div class="quote-title info-section">
            <h2>ONE CLOUD NEXT-GEN CO., LTD</h2>
           <h3>INVOICE</h3>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>INVOICE TO</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.org_name ? `<p>${customer.org_name}</p>` : ''}
            <p>${customer.email}</p>
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
          </div>
          <div class="info-section" style="text-align: right;">
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Number</strong></p>
            <p style="margin-bottom: 12px;font-weight: bold;">${invoice.legacy_id || invoice.id}</p>
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Date</strong></p>
            <p style="font-weight: bold;">${formatDate(invoice.invoice_date || invoice.created_at)}</p>
          </div>
        </div>

        ${instanceItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Instance Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:28%">
              <col style="width:7%">
              <col style="width:10%">
              <col style="width:10%">
              <col style="width:6%">
              <col style="width:14%">
              <col style="width:11%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Specification</th>
                <th>vCPU</th>
                <th>RAM (GB)</th>
                <th>Storage (GB)</th>
                <th>Qty</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="term">Billing Term</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${instanceItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * item.qty * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'VM Instance'}</td>
                  <td>${item.vcpu || '-'}</td>
                  <td>${item.ram_gb || item.ram || '-'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td>${item.qty || 1}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="7" style="text-align: right;">Instance Cost Total:</td>
                <td>MMK ${formatMMK(instanceTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${backupItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Backup Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:45%">
              <col style="width:16%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Backup Type</th>
                <th>Storage (GB)</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${backupItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Backup'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="4" style="text-align: right;">Backup Cost Total:</td>
                <td>MMK ${formatMMK(backupTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${publicIPItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Public IP Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:61%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Service</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${publicIPItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Public IP'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="3" style="text-align: right;">Public IP Cost Total:</td>
                <td>MMK ${formatMMK(publicIPTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        <div class="totals">
          ${instanceTotal > 0 ? `
            <div class="total-row">
              <span>Instance Cost Total:</span>
              <span>MMK ${formatMMK(instanceTotal)}</span>
            </div>
          ` : ''}
          ${backupTotal > 0 ? `
            <div class="total-row">
              <span>Backup Cost Total:</span>
              <span>MMK ${formatMMK(backupTotal)}</span>
            </div>
          ` : ''}
          ${publicIPTotal > 0 ? `
            <div class="total-row">
              <span>Public IP Cost Total:</span>
              <span>MMK ${formatMMK(publicIPTotal)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Sub Total:</span>
            <span>MMK ${formatMMK(subtotal)}</span>
          </div>
          ${discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-MMK ${formatMMK(discount)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Tax (${invoice.tax_pct || 5}%):</span>
            <span>MMK ${formatMMK(tax)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Grand Total:</span>
            <span>MMK ${formatMMK(grandTotal)}</span>
          </div>
        </div>

        <div class="notes">
          <h3>Bank Information</h3>
          <p><strong>Bank Account Name:</strong> ONE CLOUD NEXT-GEN CO LTD</p>
          <p><strong>Bank Account Number:</strong> 40040679888 (AYA Special)</p>
          <p><strong>Bank Account Number:</strong> 25151325100391501 (KBZ Special)</p>
          <p><strong>Bank Account Number:</strong> 25150325100391501 (KBZ Ordinary)</p>
        </div>
        </div>

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #555; font-size: 11px; line-height: 1.6;">
          <p style="font-weight: bold; font-size: 13px; margin-bottom: 8px;">Thank you for your business!</p>
          <p>Tower-A, Room No.(304/4FL), Shwe Zabu Deik Condo, Strand Road, Ahlone Township, Yangon.</p>
          <p>(+95) 9 400 635 977</p>
          <p>sales@1cloudng.com</p>
        </div>

      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    const waitForImages = async () => {
      try {
        const imgs = Array.from(printWindow.document.images)
        if (imgs.length === 0) return
        await new Promise<void>(resolve => {
          let remaining = imgs.length
          const done = () => { remaining -= 1; if (remaining <= 0) resolve() }
          imgs.forEach(img => {
            if (img.complete) done()
            else {
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
            }
          })
          setTimeout(resolve, 800) // fallback timeout
        })
      } catch { }
    }
    await waitForImages()
    printWindow.print()
  }
}

export const exportInvoiceToPDFAuto = async (invoice: any, customer: any) => {
  const logoUrl = '/src/public/assets/logo.png'
  const lineItems = invoice.line_items || []

  const formatDate = (date: string) => {
  const d = new Date(date)
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'short' })
  const year = d.getFullYear().toString().slice(-2)
  return `${day}-${month}-${year}`
}
  const formatMMK = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)

  // Helper: fetch image and convert to data URL
  const toDataUrl = async (path: string): Promise<string | null> => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      const blob = await res.blob()
      return await new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch {
      return null
    }
  }

  const firstAvailable = async (paths: string[]) => {
    for (const p of paths) {
      const url = await toDataUrl(p)
      if (url) return url
    }
    return null
  }

  // Try multiple paths to be resilient to asset placement and spacing
  const logoDataUrl = await firstAvailable([
    '/assets/logo.png',
    '/logo.png',
    '/src/public/assets/logo.png',
    '/src/public/assets/OC_DS2-removebg-preview (1).png',
    '/src/public/assets/OC_DS2-removebg-preview%20(1).png',
    '/assets/OC_DS2-removebg-preview (1).png',
    '/assets/OC_DS2-removebg-preview%20(1).png',
    '/OC_DS2-removebg-preview (1).png',
    '/OC_DS2-removebg-preview%20(1).png',
  ])

  const getTermMultiplier = (term: string) => {
    switch (term) {
      case 'Monthly': return 1
      case 'Quarterly': return 3
      case 'Half Yearly': return 6
      case 'Yearly': return 12
      default:
        const monthsMatch = term.match(/(\d+)\s*months/)
        if (monthsMatch) return parseInt(monthsMatch[1], 10)
        return 1
    }
  }

  const instanceItems = lineItems.filter((item: any) => item.kind === 'instance')
  const backupItems = lineItems.filter((item: any) => item.kind === 'backup')
  const publicIPItems = lineItems.filter((item: any) => item.kind === 'publicIP')

  // Use raw values from database directly without any rounding
  const subtotal = parseFloat(invoice.amount) || 0
  const discount = parseFloat(invoice.discount) || 0
  const tax = parseFloat(invoice.vat) || 0
  const grandTotal = parseFloat(invoice.gross_amount) || 0

  // Calculate component totals from line_items for display only (no rounding)
  const instanceTotal = instanceItems.reduce((sum: number, item: any) => {
    const extended = item.extended_price || (item.unit * item.qty * getTermMultiplier(item.term))
    return sum + extended
  }, 0)
  const backupTotal = backupItems.reduce((sum: number, item: any) => {
    const extended = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return sum + extended
  }, 0)
  const publicIPTotal = publicIPItems.reduce((sum: number, item: any) => {
    const extended = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return sum + extended
  }, 0)

  const html = `
    <html>
      <head>
        <title>Invoice ${invoice.legacy_id || invoice.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 18mm; }
          body { font-family: Arial, sans-serif; padding: 50px; color: #333; min-height: 100vh; display: flex; flex-direction: column; }
          :root {
            --accent: #4f46e5;
            --accent-soft: #e0e7ff;
            --ok: #10b981;
            --ok-soft: #d1fae5;
            --warn: #f59e0b;
            --warn-soft: #fef3c7;
            --bad: #ef4444;
            --bad-soft: #fee2e2;
            --info: #3b82f6;
            --info-soft: #dbeafe;
            --bg: #ffffff;
            --surface: #ffffff;
            --surface-2: #f8fafc;
            --surface-3: #f1f5f9;
            --line: #e2e8f0;
            --ink: #0f172a;
            --ink-2: #334155;
            --ink-3: #64748b;
            --ink-4: #94a3b8;
          }
          .content { flex: 1; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
          .logo { max-width: 120px; }
          .quote-title { text-align: right; }
          .quote-title h2 { font-size: 20px; font-weight: bold; color: #1a365d; margin-bottom: 4px; letter-spacing: 0.04em; }
          .quote-title h3 { font-size: 28px; font-weight: bold; color: #1a365d; margin: 0; letter-spacing: 0.06em; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 24px; }
          .info-section h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.06em; text-transform: uppercase; }
          .info-section p { font-size: 12px; line-height: 1.6; margin-bottom: 4px; }
          .table-container { width: 100%; margin-bottom: 16px; }
          .table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .table th { background: #1a365d; color: white; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table td { padding: 10px 12px; border-bottom: 1px dotted #94a3b8; font-size: 12px; }
          .table .subtotal-row td { background: #f7fafc; font-weight: 700; border-bottom: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .table th.num, .table td.num { text-align: right; }
          .table th.term, .table td.term { text-align: right; }
          .totals { margin-left: auto; width: 360px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
          .total-row.grand-total { font-weight: 800; font-size: 14px; border-top: 2px solid #1a365d; padding-top: 10px; margin-top: 6px; }
          .notes { margin-top: 22px; padding: 16px; background: #f7fafc; border-radius: 6px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .notes h3 { font-size: 13px; font-weight: bold; color: #1a365d; margin-bottom: 8px; letter-spacing: 0.06em; }
          .notes p { font-size: 12px; line-height: 1.6; color: #555; }
          .signature-block { display: flex; gap: 28px; align-items: flex-end; margin-top: 28px; }
          .sig-col { flex: 1; }
          .sig-label { font-size: 12px; color: #666; margin-bottom: 6px; }
          .sig-image { height: 64px; }
          .sig-line { margin-top: 8px; width: 240px; border-top: 1px solid #1a365d; }
          .sig-name { font-size: 12px; font-weight: 700; color: #1a365d; margin-top: 6px; }
          .sig-title { font-size: 11px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="content">
        <div class="header">
          <img src="${logoDataUrl || logoUrl}" alt="One Cloud Logo" class="logo" onerror="this.style.display='none'">
          <div class="quote-title info-section">
            <h2>ONE CLOUD NEXT-GEN CO., LTD</h2>
           <h3>INVOICE</h3>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-section">
            <h3>INVOICE TO</h3>
            <p><strong>${customer.name}</strong></p>
            ${customer.org_name ? `<p>${customer.org_name}</p>` : ''}
            <p>${customer.email}</p>
            ${customer.phone ? `<p>${customer.phone}</p>` : ''}
          </div>
          <div class="info-section" style="text-align: right;">
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Number</strong></p>
            <p style="margin-bottom: 12px;font-weight: bold;">${invoice.legacy_id || invoice.id}</p>
            <p style="margin-bottom: 4px; color: #1a365d;"><strong>Date</strong></p>
            <p style="font-weight: bold;">${formatDate(invoice.invoice_date || invoice.created_at)}</p>
          </div>
        </div>

        ${instanceItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Instance Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:28%">
              <col style="width:7%">
              <col style="width:10%">
              <col style="width:10%">
              <col style="width:6%">
              <col style="width:14%">
              <col style="width:11%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Specification</th>
                <th>vCPU</th>
                <th>RAM (GB)</th>
                <th>Storage (GB)</th>
                <th>Qty</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="term">Billing Term</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${instanceItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * item.qty * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'VM Instance'}</td>
                  <td>${item.vcpu || '-'}</td>
                  <td>${item.ram_gb || item.ram || '-'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td>${item.qty || 1}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="7" style="text-align: right;">Instance Cost Total:</td>
                <td>MMK ${formatMMK(instanceTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${backupItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Backup Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:45%">
              <col style="width:16%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Backup Type</th>
                <th>Storage (GB)</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${backupItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Backup'}</td>
                  <td>${item.storage_gb || item.storage || '-'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="4" style="text-align: right;">Backup Cost Total:</td>
                <td>MMK ${formatMMK(backupTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        ${publicIPItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: bold; color: #1a365d; margin-bottom: 10px;">Public IP Cost</h3>
          <div class="table-container">
          <table class="table">
            <colgroup>
              <col style="width:61%">
              <col style="width:11%">
              <col style="width:14%">
              <col style="width:14%">
            </colgroup>
            <thead>
              <tr>
                <th>Service</th>
                <th class="term">Billing Term</th>
                <th class="num">Unit Price (MMK)</th>
                <th class="num">Extended Price (MMK)</th>
              </tr>
            </thead>
            <tbody>
              ${publicIPItems.map((item: any) => {
    const extendedPrice = item.extended_price || (item.unit * getTermMultiplier(item.term))
    return `
                <tr>
                  <td>${item.spec || 'Public IP'}</td>
                  <td class="term">${item.term || 'Monthly'}</td>
                  <td class="num">MMK ${formatMMK(item.unit || 0)}</td>
                  <td class="num">MMK ${formatMMK(extendedPrice)}</td>
                </tr>
              `
  }).join('')}
              <tr class="subtotal-row">
                <td colspan="3" style="text-align: right;">Public IP Cost Total:</td>
                <td>MMK ${formatMMK(publicIPTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        ` : ''}

        <div class="totals">
          ${instanceTotal > 0 ? `
            <div class="total-row">
              <span>Instance Cost Total:</span>
              <span>MMK ${formatMMK(instanceTotal)}</span>
            </div>
          ` : ''}
          ${backupTotal > 0 ? `
            <div class="total-row">
              <span>Backup Cost Total:</span>
              <span>MMK ${formatMMK(backupTotal)}</span>
            </div>
          ` : ''}
          ${publicIPTotal > 0 ? `
            <div class="total-row">
              <span>Public IP Cost Total:</span>
              <span>MMK ${formatMMK(publicIPTotal)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Sub Total:</span>
            <span>MMK ${formatMMK(subtotal)}</span>
          </div>
          ${discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-MMK ${formatMMK(discount)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Tax (${invoice.tax_pct || 5}%):</span>
            <span>MMK ${formatMMK(tax)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Grand Total:</span>
            <span>MMK ${formatMMK(grandTotal)}</span>
          </div>
        </div>

        <div class="notes">
          <h3>Bank Information</h3>
          <p><strong>Bank Account Name:</strong> ONE CLOUD NEXT-GEN CO LTD</p>
          <p><strong>Bank Account Number:</strong> 40040679888 (AYA Special)</p>
          <p><strong>Bank Account Number:</strong> 25151325100391501 (KBZ Special)</p>
          <p><strong>Bank Account Number:</strong> 25150325100391501 (KBZ Ordinary)</p>
        </div>
        </div>

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #555; font-size: 11px; line-height: 1.6;">
          <p style="font-weight: bold; font-size: 13px; margin-bottom: 8px;">Thank you for your business!</p>
          <p>Tower-A, Room No.(304/4FL), Shwe Zabu Deik Condo, Strand Road, Ahlone Township, Yangon.</p>
          <p>(+95) 9 400 635 977</p>
          <p>sales@1cloudng.com</p>
        </div>

      </body>
    </html>
  `

  // Create a temporary container
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.width = '210mm'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    // Wait for images to load
    const waitForImages = async () => {
      try {
        const imgs = Array.from(container.querySelectorAll('img'))
        if (imgs.length === 0) return
        await new Promise<void>(resolve => {
          let remaining = imgs.length
          const done = () => { remaining -= 1; if (remaining <= 0) resolve() }
          imgs.forEach(img => {
            if ((img as HTMLImageElement).complete) done()
            else {
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
            }
          })
          setTimeout(resolve, 800)
        })
      } catch { }
    }
    await waitForImages()

    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false
    })

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const pageMargin = 10
    const imgWidth = pageWidth - pageMargin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const maxPageHeight = pageHeight - pageMargin * 2

    // Calculate how many pages we need
    const totalPages = Math.ceil(imgHeight / maxPageHeight)

    // Split content across multiple pages if needed
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage()
      }
      const yOffset = i * maxPageHeight
      const remainingHeight = Math.min(maxPageHeight, imgHeight - yOffset)
      
      // Create a temporary canvas for this page
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = (remainingHeight * canvas.width) / imgWidth
      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          (yOffset * canvas.height) / imgHeight,
          canvas.width,
          (remainingHeight * canvas.height) / imgHeight,
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        )
      }
      
      const pageImgData = pageCanvas.toDataURL('image/png')
      pdf.addImage(pageImgData, 'PNG', pageMargin, pageMargin, imgWidth, remainingHeight)
    }
    
    triggerPDFDownload(pdf, `Invoice-${invoice.legacy_id || invoice.id}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}