/** Loading state used by every data-fetching screen — a radar sweep. */
export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="radar" aria-hidden="true">
        <span className="radar__ring" />
        <span className="radar__sweep" />
        <span className="radar__dot" />
      </span>
      <p className="state-block__text">{label}</p>
    </div>
  )
}
