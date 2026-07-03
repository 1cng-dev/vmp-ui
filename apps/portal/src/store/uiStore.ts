import { useState, useCallback, useEffect } from 'react'
import type { Toast } from '../types'

// Module-level state to share across all components
let globalToasts: Toast[] = []
let globalToastId = 1
const listeners: Set<() => void> = new Set()

export interface UIStoreValue {
  toast: (msg: string, kind?: string, action?: any) => void
  toasts: Toast[]
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>
}

const useUIStore = (): UIStoreValue => {
  const [toasts, setToastsState] = useState<Toast[]>(globalToasts)

  useEffect(() => {
    const listener = () => setToastsState(globalToasts)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const toast = useCallback((msg: string, kind = 'info', action?: any) => {
    const id = globalToastId++
    globalToasts = [...globalToasts, { id, msg, kind, action }]
    listeners.forEach(l => l())
    setTimeout(() => {
      globalToasts = globalToasts.filter(x => x.id !== id)
      listeners.forEach(l => l())
    }, 4200)
  }, [])

  const setToasts = useCallback((toasts: Toast[] | ((prev: Toast[]) => Toast[])) => {
    globalToasts = typeof toasts === 'function' ? (toasts as (prev: Toast[]) => Toast[])(globalToasts) : toasts
    listeners.forEach(l => l())
  }, [])

  return {
    toast,
    toasts,
    setToasts,
  }
}

export default useUIStore
