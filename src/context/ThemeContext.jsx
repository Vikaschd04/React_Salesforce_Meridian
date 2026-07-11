import { createContext, useContext, useCallback, useEffect, useState } from 'react'

/**
 * Light/dark theme state. The actual attribute is set on <html> before paint by
 * the inline script in index.html (no flash); this context reads that initial
 * value, then keeps <html data-theme>, the theme-color meta, and localStorage in
 * sync whenever the shopper toggles.
 */
const ThemeContext = createContext(null)

const STORAGE_KEY = 'meridian-theme'
const THEME_COLORS = { light: '#f2ece0', dark: '#0d0b08' }

function initialTheme() {
  if (typeof document === 'undefined') return 'dark'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme)

  // Reflect the theme onto the document + meta + storage on every change.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    const meta = document.getElementById('theme-color-meta')
    if (meta) meta.setAttribute('content', THEME_COLORS[theme])
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark')
  }, [])
  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
