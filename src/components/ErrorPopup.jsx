import { useEffect, useRef } from 'react'

/**
 * Dismissible error popup — a centred modal over a dimmed backdrop. Renders
 * nothing when `message` is falsy. Closes on the × button, the backdrop, Escape,
 * or automatically after `autoDismissMs` (pass 0 to disable auto-dismiss). The
 * parent owns the message state and clears it via `onClose`.
 */
export default function ErrorPopup({ message, onClose, autoDismissMs = 7000 }) {
  // Keep the latest onClose without re-arming the timer every render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!message) return undefined
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.()
    window.addEventListener('keydown', onKey)
    const timer = autoDismissMs ? setTimeout(() => onCloseRef.current?.(), autoDismissMs) : null
    return () => {
      window.removeEventListener('keydown', onKey)
      if (timer) clearTimeout(timer)
    }
  }, [message, autoDismissMs])

  if (!message) return null

  return (
    <div className="error-popup-overlay" onClick={onClose}>
      <div
        className="error-popup"
        role="alert"
        aria-live="assertive"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="error-popup__close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
        <span className="error-popup__icon" aria-hidden="true">!</span>
        <p className="error-popup__msg">{message}</p>
      </div>
    </div>
  )
}
