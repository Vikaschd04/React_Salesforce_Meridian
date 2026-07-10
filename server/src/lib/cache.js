/**
 * Tiny in-memory TTL cache. Used for product reads so we don't hammer the
 * (eventual) Salesforce API on every request — Salesforce enforces per-org API
 * call limits. Not a distributed cache; fine for a single BFF instance.
 */
export function createCache(ttlMs) {
  const store = new Map() // key -> { value, expires }

  return {
    get(key) {
      const hit = store.get(key)
      if (!hit) return undefined
      if (hit.expires < Date.now()) {
        store.delete(key)
        return undefined
      }
      return hit.value
    },
    set(key, value) {
      store.set(key, { value, expires: Date.now() + ttlMs })
      return value
    },
    clear() {
      store.clear()
    },
    /** Get from cache or compute+cache via the async loader. */
    async wrap(key, loader) {
      const cached = this.get(key)
      if (cached !== undefined) return cached
      const value = await loader()
      return this.set(key, value)
    },
  }
}
