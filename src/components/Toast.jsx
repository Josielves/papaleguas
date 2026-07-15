import { useCallback, useRef, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const showToast = useCallback((message, type = 'default') => {
    clearTimeout(timerRef.current)
    setToast({ message, type })
    timerRef.current = setTimeout(() => setToast(null), 3200)
  }, [])

  return { toast, showToast }
}

export default function Toast({ toast }) {
  if (!toast) return null
  const cls = toast.type === 'error' ? 'toast toast--error' : toast.type === 'success' ? 'toast toast--success' : 'toast'
  return (
    <div className={cls} role="status">
      {toast.message}
    </div>
  )
}
