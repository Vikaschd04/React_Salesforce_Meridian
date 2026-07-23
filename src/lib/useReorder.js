import { useState } from 'react'
import { useCart } from '../context/CartContext.jsx'

/**
 * Re-add a past order's line items to the current cart. Skips any item
 * whose product is no longer active (discontinued since the order was
 * placed) and reports how many were added vs. skipped so the UI can tell
 * the shopper. Current price/stock always apply — the cart never uses the
 * order's historical snapshot.
 */
export default function useReorder() {
  const { catalog, addItems } = useCart()
  const [result, setResult] = useState(null) // { added, skipped } | null

  function reorder(items) {
    const available = items.filter((it) => catalog[it.id])
    if (available.length > 0) {
      addItems(available.map((it) => ({ id: it.id, qty: it.qty })))
    }
    setResult({ added: available.length, skipped: items.length - available.length })
  }

  return { reorder, result }
}
