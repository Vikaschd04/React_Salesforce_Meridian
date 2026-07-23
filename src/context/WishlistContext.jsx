import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { getWishlist, addToWishlist, removeFromWishlist } from '../api/store.js'
import { useAuth } from './AuthContext.jsx'

/**
 * Wishlist state for the whole app — a Set of saved product ids, so the heart
 * on any product card/detail can reflect state instantly (has()) without a
 * per-card fetch. Loaded when a shopper logs in, cleared on logout. Saving
 * requires login; the heart button routes guests to /login.
 *
 * Mirrors CartContext, but keyed to the logged-in shopper (server-persisted,
 * so it follows them across devices) rather than localStorage.
 */
const WishlistContext = createContext(null)

export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const [ids, setIds] = useState(() => new Set())

  // Load on login; clear on logout.
  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return undefined
    }
    let alive = true
    getWishlist()
      .then((list) => alive && setIds(new Set(list)))
      .catch(() => {
        /* non-fatal: an empty wishlist until it loads */
      })
    return () => {
      alive = false
    }
  }, [user])

  const has = useCallback((id) => ids.has(id), [ids])

  /**
   * Toggle a product in the wishlist. Optimistic — flips the local set first,
   * then calls the API, reverting on failure. Returns false if not logged in
   * (the caller sends the shopper to /login).
   */
  const toggle = useCallback(
    async (id) => {
      if (!user) return false
      const saved = ids.has(id)
      // optimistic
      setIds((prev) => {
        const next = new Set(prev)
        if (saved) next.delete(id)
        else next.add(id)
        return next
      })
      try {
        const list = saved ? await removeFromWishlist(id) : await addToWishlist(id)
        setIds(new Set(list))
      } catch {
        // revert
        setIds((prev) => {
          const next = new Set(prev)
          if (saved) next.add(id)
          else next.delete(id)
          return next
        })
      }
      return true
    },
    [ids, user],
  )

  const value = useMemo(
    () => ({ ids, count: ids.size, has, toggle }),
    [ids, has, toggle],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider')
  return ctx
}
