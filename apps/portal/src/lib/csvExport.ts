export const exportToCSV = <T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) => {
  // If no columns specified, use all keys from first item
  const headers = columns || 
    (data.length > 0 ? Object.keys(data[0]).map(key => ({ key, label: key as string })) : [])
  
  // Create CSV header
  const csvHeader = headers.map(h => h.label).join(',')
  
  // Create CSV rows
  const csvRows = data.map(row => 
    headers.map(h => {
      const value = row[h.key]
      // Handle nested objects, arrays, and special characters
      const stringValue = typeof value === 'object' 
        ? JSON.stringify(value) 
        : String(value ?? '')
      // Escape quotes and wrap in quotes if contains comma
      return stringValue.includes(',') || stringValue.includes('"')
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue
    }).join(',')
  )
  
  // Combine header and rows
  const csvContent = [csvHeader, ...csvRows].join('\n')
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}