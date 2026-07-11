import { useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Search box with a typeahead dropdown over the loaded catalog. Suggests
 * matching coffees (→ navigate to the product) and tasting notes (→ fill the
 * search term). Implements the ARIA combobox pattern with full keyboard support
 * (↑/↓ to move, Enter to choose, Esc to close).
 */
export default function SearchSuggest({ value, onChange, products = [] }) {
  const navigate = useNavigate()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const blurTimer = useRef(null)

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (q.length < 1) return []
    const out = []
    for (const p of products) {
      if (p.name.toLowerCase().includes(q) || p.origin.toLowerCase().includes(q)) {
        out.push({ type: 'product', id: p.id, label: p.name, hint: p.origin })
      }
      if (out.length >= 6) break
    }
    const notes = new Set()
    for (const p of products) {
      for (const note of p.tastingNotes) {
        if (note.toLowerCase().includes(q)) notes.add(note)
      }
    }
    for (const note of [...notes].slice(0, 4)) {
      out.push({ type: 'note', id: `note-${note}`, label: note, hint: 'Tasting note' })
    }
    return out.slice(0, 8)
  }, [value, products])

  const showList = open && suggestions.length > 0

  function choose(s) {
    if (!s) return
    if (s.type === 'product') {
      navigate(`/product/${s.id}`)
    } else {
      onChange(s.label)
    }
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e) {
    if (!showList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (active >= 0) {
        e.preventDefault()
        choose(suggestions[active])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const activeId = active >= 0 && showList ? `${listId}-opt-${active}` : undefined

  return (
    <div className="shop-controls__search searchsuggest">
      <label className="sr-only" htmlFor="shop-search">
        Search coffees
      </label>
      <svg className="shop-controls__icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        id="shop-search"
        type="text"
        className="shop-controls__input"
        placeholder="Search by name, origin, or tasting note…"
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
      />
      {showList && (
        <ul className="searchsuggest__list" id={listId} role="listbox" aria-label="Suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`searchsuggest__opt${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // Prevent the input blur from firing before the click.
                e.preventDefault()
                if (blurTimer.current) clearTimeout(blurTimer.current)
              }}
              onClick={() => choose(s)}
            >
              <span className="searchsuggest__label">{s.label}</span>
              <span className="searchsuggest__hint">{s.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
