import React from 'react'

interface SpinnerProps {
  size?: number
  className?: string
}

const Spinner: React.FC<SpinnerProps> = ({ size = 32, className = '' }) => {
  return (
    <div className={className} style={{
      width: size,
      height: size,
      border: '3px solid ' + 'var(--surface-3)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default Spinner
