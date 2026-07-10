import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/account'

  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const onChange = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    if (values.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signup(values)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <span className="meridian-rule">Join Meridian</span>
        <h1 className="auth-card__title">Create your account</h1>
        <p className="auth-card__sub">
          Track orders and reorder your favourites. It takes a few seconds.
        </p>
        <AuthForm
          mode="signup"
          values={values}
          onChange={onChange}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
        />
        <p className="auth-card__alt">
          Already have an account?{' '}
          <Link to="/login" state={{ from: redirectTo }}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
