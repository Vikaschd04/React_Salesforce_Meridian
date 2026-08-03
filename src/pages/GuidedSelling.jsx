import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGuidedQuiz, getGuidedRecommendations } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'
import ErrorPopup from '../components/ErrorPopup.jsx'
import useSeo from '../lib/useSeo.js'

export default function GuidedSelling() {
  useSeo({
    title: 'Find your coffee',
    description:
      'Answer four quick questions and we’ll match you to single-origin coffees from our catalog — roast, flavour, body, and brew.',
  })

  const [quiz, setQuiz] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [phase, setPhase] = useState('quiz') // 'quiz' | 'loading' | 'results'
  const [recs, setRecs] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setQuiz(null)
    setLoadError(null)
    getGuidedQuiz()
      .then((q) => alive && setQuiz(q))
      .catch((e) => alive && setLoadError(e))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const total = quiz?.length || 0
  const current = quiz?.[step]

  async function choose(question, value) {
    const next = { ...answers, [question.id]: value }
    setAnswers(next)
    if (step < total - 1) {
      setStep(step + 1)
      return
    }
    // Last question → score against the (Salesforce) catalog.
    setPhase('loading')
    setError(null)
    try {
      const results = await getGuidedRecommendations(next)
      setRecs(results)
      setPhase('results')
    } catch (e) {
      setError(e)
      setPhase('quiz')
    }
  }

  function restart() {
    setAnswers({})
    setStep(0)
    setRecs([])
    setError(null)
    setPhase('quiz')
  }

  // Labels for the preferences the shopper actually expressed (skip "no preference").
  const chosen = quiz
    ? quiz
        .filter((q) => answers[q.id])
        .map((q) => q.options.find((o) => o.value === answers[q.id])?.label)
        .filter(Boolean)
    : []

  return (
    <div className="container guided">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Find your coffee' }]} />

      <header className="page-head guided__head">
        <p className="hero__eyebrow">Guided selling</p>
        <h1 className="page-head__title">
          Find <span className="hero__accent">your</span> coffee.
        </h1>
        <p className="page-head__lede">
          Four quick questions — roast, flavour, body, and brew. We’ll plot them against every
          single-origin lot in the catalog and hand you your closest matches.
        </p>
      </header>

      {loadError ? (
        <ErrorState message={loadError.message} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !quiz ? (
        <Spinner label="Warming up the quiz…" />
      ) : phase === 'loading' ? (
        <Spinner label="Plotting your matches…" />
      ) : phase === 'results' ? (
        <section className="guided-results">
          <div className="guided-results__head">
            <p className="hero__eyebrow">Your matches</p>
            <h2 className="guided-results__title">Brewed to your taste.</h2>
            {chosen.length > 0 && (
              <ul className="guided-results__chips" aria-label="Your preferences">
                {chosen.map((c) => (
                  <li key={c} className="guided-chip">
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="grid guided-matches">
            {recs.map((rec, i) => (
              <li key={rec.id} style={{ '--n': i }}>
                <div className="match-card">
                  <div className="match-card__head">
                    {rec.matchPct > 0 && <span className="match-card__pct">{rec.matchPct}% match</span>}
                    {rec.reasons?.length > 0 && (
                      <ul className="match-card__reasons">
                        {rec.reasons.map((r) => (
                          <li key={r} className="match-reason">
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <ProductCard product={rec} />
                </div>
              </li>
            ))}
          </ul>

          <div className="guided-results__cta">
            <button type="button" className="btn btn--ghost" onClick={restart}>
              Retake the quiz
            </button>
            <Link to="/shop" className="btn">
              Browse all coffees
            </Link>
          </div>
        </section>
      ) : (
        <section className="guided-quiz" aria-live="polite">
          <div className="guided-quiz__progress" role="group" aria-label={`Question ${step + 1} of ${total}`}>
            <div className="guided-quiz__bar">
              <span style={{ width: `${((step + 1) / total) * 100}%` }} />
            </div>
            <span className="guided-quiz__step">
              Question {step + 1} <span aria-hidden="true">/</span> {total}
            </span>
          </div>

          <h2 className="guided-quiz__q">{current.label}</h2>
          {current.help && <p className="guided-quiz__help">{current.help}</p>}

          <div className="guided-options">
            {current.options.map((opt) => {
              const active = answers[current.id] === opt.value
              return (
                <button
                  key={opt.value || 'any'}
                  type="button"
                  className={`guided-option${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => choose(current, opt.value)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div className="guided-quiz__nav">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ‹ Back
            </button>
          </div>
        </section>
      )}

      <ErrorPopup
        message={error ? error.message || 'Couldn’t find matches. Please try again.' : null}
        onClose={() => setError(null)}
      />
    </div>
  )
}
