import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/* Reusable modal dialog — closes on Escape or backdrop click */
export default function Modal({ title, onClose, footer, children }) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
  }

  function handleAnimEnd(e) {
    if (e.animationName === 'dlg-out') onClose()
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div
      className={`dlg-overlay${closing ? ' dlg-overlay--closing' : ''}`}
      onMouseDown={handleClose}
    >
      <div
        className={`dlg${closing ? ' dlg--closing' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onAnimationEnd={handleAnimEnd}
        role="dialog"
        aria-modal="true"
      >
        <div className="dlg-header">
          <span className="dlg-title">{title}</span>
          <button className="icon-btn" onClick={handleClose} aria-label="Close"><IconX /></button>
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
