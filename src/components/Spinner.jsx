/** Loading state used by every data-fetching screen. */
export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="state-block__text">{label}</p>
    </div>
  )
}
