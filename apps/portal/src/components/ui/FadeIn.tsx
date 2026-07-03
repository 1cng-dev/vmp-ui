import React, { useState, useEffect } from 'react'

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
}

const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, duration = 0.4 }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div style={{
      opacity: isVisible ? 1 : 0,
      transition: `opacity ${duration}s ease-in`,
    }}>
      {children}
    </div>
  )
}

export default FadeIn
