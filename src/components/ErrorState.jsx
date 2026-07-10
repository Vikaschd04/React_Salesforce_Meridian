/** Friendly error state used by every data-fetching screen. */
export default function ErrorState({ message, onRetry }) {
  return (
    <div className="state-block" role="alert">
      <p className="state-block__title">Something went wrong</p>
      <p className="state-block__text">
        {message || 'We couldn’t load this right now. Please try again.'}
      </p>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
