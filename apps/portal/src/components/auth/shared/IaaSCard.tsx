import React from 'react'

interface IaaSCardProps {
  selected: boolean
  onClick: () => void
  padding?: number
  children: React.ReactNode
}

const IaaSCard: React.FC<IaaSCardProps> = ({ selected, onClick, padding = 14, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: `${padding}px`,
      textAlign: 'left',
      background: selected ? 'var(--accent-soft)' : 'var(--surface)',
      border: '1.5px solid',
      borderColor: selected ? 'var(--accent)' : 'var(--line)',
      borderRadius: 10,
      cursor: 'pointer',
      fontFamily: 'inherit',
      color: 'var(--ink)',
      boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'none',
      transition: 'all 0.15s',
    }}
  >
    {children}
  </button>
)

export { IaaSCard }
