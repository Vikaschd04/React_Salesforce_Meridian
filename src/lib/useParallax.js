import { useEffect, useRef } from 'react'

/**
 * Mouse parallax for layered scenes (the hero). Sets --par-x / --par-y
 * (-1..1) on the container; each layer multiplies them by its own depth in
 * CSS. rAF-throttled, disabled under prefers-reduced-motion.
 */
export default function useParallax() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frame = 0
    const onMove = (e) => {
      cancelAnimationFrame(frame)
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--par-x', x.toFixed(3))
        el.style.setProperty('--par-y', y.toFixed(3))
      })
    }
    const onLeave = () => {
      cancelAnimationFrame(frame)
      el.style.setProperty('--par-x', '0')
      el.style.setProperty('--par-y', '0')
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return ref
}
