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