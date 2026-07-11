/**
 * Row of removable chips summarizing the Shop's active filters. Each chip clears
 * just its own filter; "Clear all" resets everything. Renders nothing when no
 * filters are applied.
 */
export default function ActiveFilters({ chips, onClearAll }) {
  if (!chips.length) return null
  return (
    <div className="active-filters" aria-label="Active filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="active-filter"
          onClick={chip.clear}
          aria-label={`Remove filter ${chip.label}`}
        >
          <span className="active-filter__label">{chip.label}</span>
          <span className="active-filter__x" aria-hidden="true">
            ×
          </span>
        </button>
      ))}
      <button type="button" className="active-filters__clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  )
}
