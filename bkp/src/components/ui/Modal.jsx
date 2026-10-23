import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/* Reusable modal dialog — closes on Escape or backdrop click */
export default function Modal({ title, onClose, footer, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="dlg-overlay" onMouseDown={onClose}>
      <div
        className="dlg"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dlg-header">
          <span className="dlg-title">{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>
        <div className="dlg-body">{children}</div>
        {footer && <div className="dlg-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l10 10M14 4L4 14" />
    </svg>
  )
}
