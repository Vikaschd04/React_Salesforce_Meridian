const STARS = [1, 2, 3, 4, 5]

/**
 * Five-star rating. Read-only display (round `value` to the nearest star) when
 * `onChange` is omitted; an accessible interactive picker when it's given.
 */
export default function StarRating({ value = 0, onChange, size = 'md', label = 'Rating' }) {
  const filled = Math.round(value)
  const interactive = typeof onChange === 'function'

  if (!interactive) {
    return (
      <span className={`star-rating star-rating--${size}`} role="img" aria-label={`${value} out of 5 stars`}>
        {STARS.map((n) => (
          <span key={n} className={n <= filled ? 'star star--filled' : 'star'} aria-hidden="true">
            ★
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={`star-rating star-rating--${size} star-rating--input`} role="group" aria-label={label}>
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'star star--filled star--btn' : 'star star--btn'}
          aria-label={`Rate ${n} out of 5`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </span>
  )
}
