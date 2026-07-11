import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProducts } from '../api/store.js'
import ProductCard from './ProductCard.jsx'
import useReveal from '../lib/useReveal.js'

const countryOf = (origin) => origin.split(',').pop().trim()

/**
 * "You might also like" — up to 3 coffees related to the one on screen, scored
 * client-side over the full catalog: same roast (+3), same country (+2), and
 * each shared tasting note (+1). Renders nothing until there's a match.
 */
export default function RelatedProducts({ product }) {
  const [related, setRelated] = useState([])

  useEffect(() => {
    let alive = true
    getProducts()
      .then((all) => {
        if (!alive) return
        const country = countryOf(product.origin)
        const notes = new Set(product.tastingNotes)
        const scored = all
          .filter((p) => p.id !== product.id)
          .map((p) => {
            let score = 0
            if (p.roast === product.roast) score += 3
            if (countryOf(p.origin) === country) score += 2
            for (const n of p.tastingNotes) if (notes.has(n)) score += 1
            return { p, score }
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((x) => x.p)
        setRelated(scored)
      })
      .catch(() => {
        /* non-fatal: just hide the section */
      })
    return () => {
      alive = false
    }
  }, [product])

  useReveal([related])

  if (related.length === 0) return null

  return (
    <section className="related" aria-labelledby="related-heading">
      <div className="section-head reveal">
        <h2 id="related-heading" className="section-head__title">
          You might also like
        </h2>
        <Link to="/shop" className="section-head__link">
          All coffees →
        </Link>
      </div>
      <ul className="grid">
        {related.map((p, i) => (
          <li key={p.id} className="reveal" style={{ '--reveal-delay': `${i * 0.1}s` }}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  )
}
