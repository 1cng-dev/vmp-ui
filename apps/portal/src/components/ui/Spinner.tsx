import React from 'react'

interface SpinnerProps {
  size?: number
  className?: string
}

const Spinner: React.FC<SpinnerProps> = ({ size = 96, className = '' }) => {
  return (
    <div className={className} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12
    }}>
      <div>
        <img 
          src="/assets/logo.png" 
          alt="Loading..." 
          style={{
            width: size,
            height: 'auto',
            opacity: 0.6
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div className="loading-dot" style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'oklch(0.6 0.13 250)',
          animation: 'loadingDot 1.4s ease-in-out infinite'
        }} />
        <div className="loading-dot" style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'oklch(0.6 0.13 250)',
          animation: 'loadingDot 1.4s ease-in-out infinite 0.2s'
        }} />
        <div className="loading-dot" style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'oklch(0.6 0.13 250)',
          animation: 'loadingDot 1.4s ease-in-out infinite 0.4s'
        }} />
        <div className="loading-dot" style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'oklch(0.6 0.13 250)',
          animation: 'loadingDot 1.4s ease-in-out infinite 0.6s'
        }} />
        <div className="loading-dot" style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'oklch(0.6 0.13 250)',
          animation: 'loadingDot 1.4s ease-in-out infinite 0.8s'
        }} />
      </div>
      <style>{`
        @keyframes loadingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default Spinner
