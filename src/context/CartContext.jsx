import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getProducts, applyPromo } from '../api/store.js'

/**
 * Cart state for the whole app.
 *
 * The cart itself stores only { id, qty } — the minimum needed to survive a
 * reload and to send to placeOrder(). Display details (name, price, art) are
 * joined in from the catalog, which we load once through the store module so
 * this context never imports mock data directly.
 *
 * Prices shown here are for display only; the order total is recomputed from
 * trusted data inside store.placeOrder() at checkout.
 */

const CartContext = createContext(null)
const STORAGE_KEY = 'meridian.cart.v1'

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((it) => it && typeof it.id === 'string')
      .map((it) => ({ id: it.id, qty: Math.max(1, Math.floor(Number(it.qty) || 1)) }))
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitial)
  const [catalog, setCatalog] = useState({}) // id -> product

  // Load the catalog once so we can join prices/names for display.
  useEffect(() => {
    let alive = true
    getProducts()
      .then((products) => {
        if (!alive) return
        const byId = {}
        for (const p of products) byId[p.id] = p
        setCatalog(byId)
      })
      .catch(() => {
        /* Non-fatal: cart still works with a bare list until catalog loads. */
      })
    return () => {
      alive = false
    }
  }, [])

  // Persist the raw cart.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [items])

  function addItem(id, qty = 1) {
    const add = Math.max(1, Math.floor(Number(qty) || 1))
    setItems((prev) => {
      const existing = prev.find((it) => it.id === id)
      if (existing) {
        return prev.map((it) => (it.id === id ? { ...it, qty: it.qty + add } : it))
      }
      return [...prev, { id, qty: add }]
    })
  }

  function setQty(id, qty) {
    const next = Math.floor(Number(qty) || 0)
    if (next <= 0) return removeItem(id)
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty: next } : it)))
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function clear() {
    setItems([])
    setPromo(null)
  }

  // ---- Promo code ----
  // The applied promo { code, discountCents, freeShipping, label } or null.
  const [promo, setPromo] = useState(null)

  /** Apply a code; validated server-side against the current subtotal. Throws on failure. */
  async function applyPromoCode(code) {
    const res = await applyPromo(code, totalCents)
    setPromo(res)
    return res
  }
  function clearPromo() {
    setPromo(null)
  }

  // Derived line items joined with catalog data (skips items no longer sold).
  const lines = useMemo(() => {
    return items
      .map((it) => {
        const product = catalog[it.id]
        if (!product) return null
        return {
          id: it.id,
          qty: it.qty,
          product,
          lineCents: product.priceCents * it.qty,
        }
      })
      .filter(Boolean)
  }, [items, catalog])

  const count = useMemo(() => items.reduce((sum, it) => sum + it.qty, 0), [items])
  const totalCents = useMemo(
    () => lines.reduce((sum, line) => sum + line.lineCents, 0),
    [lines],
  )

  // Keep an applied promo accurate when the cart changes: re-validate against the
  // new subtotal and drop it if it no longer qualifies (e.g. dropped below a min).
  useEffect(() => {
    if (!promo) return undefined
    let alive = true
    applyPromo(promo.code, totalCents)
      .then((res) => alive && setPromo(res))
      .catch(() => alive && setPromo(null))
    return () => {
      alive = false
    }
    // Only re-run when the subtotal changes; promo.code is stable while applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents])

  const discountCents = promo?.discountCents || 0

  const value = useMemo(
    () => ({
      items,
      lines,
      count,
      totalCents,
      promo,
      discountCents,
      applyPromoCode,
      clearPromo,
      addItem,
      setQty,
      removeItem,
      clear,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, lines, count, totalCents, promo, discountCents],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
