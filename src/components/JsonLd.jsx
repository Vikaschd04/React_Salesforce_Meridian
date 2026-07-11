import { useEffect } from 'react'

/**
 * Injects a <script type="application/ld+json"> for structured data (Product,
 * Organization, …) and removes it on unmount. `data` may be an object or array.
 * Re-runs only when the serialized JSON changes, so an inline literal is fine.
 */
export default function JsonLd({ data }) {
  const json = JSON.stringify(data)
  useEffect(() => {
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.textContent = json
    document.head.appendChild(el)
    return () => el.remove()
  }, [json])
  return null
}
