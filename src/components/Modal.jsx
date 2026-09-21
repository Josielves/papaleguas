import { useEffect } from 'react'
import { ArrowLeft, X } from 'lucide-react'

export default function Modal({ title, onClose, children, footer, variant = '', navigation = 'close' }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal-panel ${variant ? `modal-panel--${variant}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-panel__header">
          {navigation === 'back' ? (
            <button className="modal-panel__back" type="button" onClick={onClose} aria-label={`Voltar de ${title}`}>
              <ArrowLeft size={20} aria-hidden="true" />
              <strong>{title}</strong>
            </button>
          ) : (
            <>
              <h3>{title}</h3>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar">
                <X size={19} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        <div className="modal-panel__body">{children}</div>
        {footer && (
          <div className="modal-panel__body" style={{ paddingTop: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
