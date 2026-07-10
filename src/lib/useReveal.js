import { useEffect } from 'react'

/**
 * Scroll-reveal driver. Watches every `.reveal` element currently in the DOM
 * and adds `.is-revealed` the first time it enters the viewport; CSS does the
 * actual animation. Call it from a page component, passing deps that change
 * when the page's content (re)renders, e.g. useReveal([products]).
 *
 * Respects prefers-reduced-motion: elements are revealed immediately (the CSS
 * also forces the final state, so this is belt-and-braces).
 */
export default function useReveal(deps = []) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal:not(.is-revealed)'))
    if (els.length === 0) return undefined

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-revealed'))
      return undefined
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
