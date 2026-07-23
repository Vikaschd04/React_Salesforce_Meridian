import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProductReviews, submitProductReview } from '../api/store.js'
import { useAuth } from '../context/AuthContext.jsx'
import { formatOrderDate } from '../pages/account/Orders.jsx'
import StarRating from './StarRating.jsx'
import Spinner from './Spinner.jsx'
import ErrorState from './ErrorState.jsx'

/** Star-picker + title/body review form. Only rendered when eligible to submit. */
function ReviewForm({ productId, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (!rating) {
      setError('Pick a rating.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const review = await submitProductReview(productId, { rating, title: title.trim(), body: body.trim() })
      onSubmitted(review)
      setRating(0)
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err.message || 'Couldn’t submit your review. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="review-form" onSubmit={onSubmit} noValidate>
      <h3 className="review-form__title">Write a review</h3>
      {error && (
        <p className="review-form__error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        <span className="field__label">Your rating</span>
        <StarRating value={rating} onChange={setRating} size="lg" label="Your rating" />
      </label>
      <label className="field">
        <span className="field__label">Title</span>
        <input
          type="text"
          maxLength={120}
          required
          placeholder="Sum it up in a few words"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Review</span>
        <textarea
          rows={4}
          maxLength={2000}
          required
          placeholder="What did you think of this coffee?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn--ghost" disabled={busy}>
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  )
}

function ReviewCard({ review }) {
  return (
    <li className="review-card">
      <div className="review-card__head">
        <StarRating value={review.rating} size="sm" />
        <span className="review-card__date">{formatOrderDate(review.createdAt)}</span>
      </div>
      <p className="review-card__title">{review.title}</p>
      <p className="review-card__body">{review.body}</p>
      <p className="review-card__by">{review.reviewerName}</p>
    </li>
  )
}

/** Reviews section for a product detail page: summary, list, and (if eligible) the form. */
export default function ProductReviews({ productId }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setData(null)
    setError(null)
    getProductReviews(productId)
      .then(setData)
      .catch(setError)
  }, [productId])

  useEffect(() => {
    load()
  }, [load])

  function handleSubmitted(review) {
    setData((prev) => {
      const reviews = [review, ...prev.reviews]
      const count = prev.count + 1
      const average = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      return { reviews, average, count, myReview: review }
    })
  }

  return (
    <section className="product-reviews">
      <div className="product-reviews__head">
        <h2 className="account-section-title">Reviews</h2>
        {data && data.count > 0 && (
          <span className="product-reviews__summary">
            <StarRating value={data.average} />
            <span>
              {data.average} out of 5 · {data.count} review{data.count === 1 ? '' : 's'}
            </span>
          </span>
        )}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={load} />
      ) : !data ? (
        <Spinner label="Loading reviews…" />
      ) : (
        <>
          {data.reviews.length === 0 ? (
            <p className="product-reviews__empty">No reviews yet — be the first to review this coffee.</p>
          ) : (
            <ul className="review-list">
              {data.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </ul>
          )}

          {!user ? (
            <p className="product-reviews__prompt">
              <Link to="/login">Log in</Link> to write a review.
            </p>
          ) : data.myReview ? (
            <p className="product-reviews__prompt">You’ve already reviewed this coffee — thanks!</p>
          ) : (
            <ReviewForm productId={productId} onSubmitted={handleSubmitted} />
          )}
        </>
      )}
    </section>
  )
}
