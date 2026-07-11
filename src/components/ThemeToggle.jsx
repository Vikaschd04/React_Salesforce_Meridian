import { useTheme } from '../context/ThemeContext.jsx'

/**
 * Sun/moon theme switch. One button that swaps the whole site between the dark
 * "Observatory" and light "Day" palettes. The two glyphs cross-fade/rotate so
 * the toggle feels physical rather than a hard cut.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      data-theme-state={theme}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <svg className="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="21.5" y2="12" />
            <line x1="5.2" y1="5.2" x2="7" y2="7" />
            <line x1="17" y1="17" x2="18.8" y2="18.8" />
            <line x1="18.8" y1="5.2" x2="17" y2="7" />
            <line x1="7" y1="17" x2="5.2" y2="18.8" />
          </g>
        </svg>
        <svg className="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24">
          <path
            d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}
