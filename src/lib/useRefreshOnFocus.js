import { useEffect } from 'react'

/**
 * Re-run `onRefresh` whenever the tab regains focus or becomes visible again.
 * Used on the account pages so a change made in Salesforce (e.g. the merchant
 * marking an order Shipped) shows up when the shopper switches back — without a
 * manual reload. Throttled so focus + visibilitychange don't double-fire.
 */
export default function useRefreshOnFocus(onRefresh) {
  useEffect(() => {
    let last = Date.now()
    const maybe = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - last < 800) return
      last = Date.now()
      onRefresh()
    }
    window.addEventListener('focus', maybe)
    document.addEventListener('visibilitychange', maybe)
    return () => {
      window.removeEventListener('focus', maybe)
      document.removeEventListener('visibilitychange', maybe)
    }
  }, [onRefresh])
}
