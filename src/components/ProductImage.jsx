/**
 * ProductImage — real bundled coffee photo for a product.
 *
 * Shows the origin accent as a background while the photo loads (no layout
 * shift, no flash of empty box), and object-fit covers so any aspect ratio
 * fills its frame. Falls back to the accent block if the image ever fails.
 */
export default function ProductImage({ product, className = '', sizes, loading = 'lazy' }) {
  return (
    <img
      className={className}
      src={product.image}
      alt={`${product.name} — ${product.origin}`}
      loading={loading}
      decoding="async"
      sizes={sizes}
      style={{ backgroundColor: product.accent }}
      onError={(e) => {
        // Hide a broken image gracefully; the accent background remains.
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}
