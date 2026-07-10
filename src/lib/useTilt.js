import { useRef, useCallback } from 'react'

/**
 * Pointer-tracked 3D tilt. Attach the returned handlers + ref to a card; it
 * writes CSS custom properties the stylesheet turns into a perspective tilt
 * and a moving glare highlight:
 *   --tilt-x / --tilt-y  (deg)   --glare-x / --glare-y  (%)
 *
 * Pure rAF + CSS variables — no dependency, GPU-composited, and inert when
 * prefers-reduced-motion is set or on touch devices (no hover).
 */
export default function useTilt(maxDeg = 7) {
  const ref = useRef(null)
  const frame = useRef(0)

  const onPointerMove = useCallback(
    (e) => {
      const el = ref.current
      if (!el || e.pointerType === 'touch') return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      cancelAnimationFrame(frame.current)
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width // 0..1
      const py = (e.clientY - rect.top) / rect.height
      frame.current = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-x', `${((py - 0.5) * -2 * maxDeg).toFixed(2)}deg`)
        el.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * maxDeg).toFixed(2)}deg`)
        el.style.setProperty('--glare-x', `${(px * 100).toFixed(1)}%`)
        el.style.setProperty('--glare-y', `${(py * 100).toFixed(1)}%`)
      })
    },
    [maxDeg],
  )

  const onPointerLeave = useCallback(() => {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(frame.current)
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
  }, [])

  return { ref, onPointerMove, onPointerLeave }
}
