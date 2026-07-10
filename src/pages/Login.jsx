import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/account'

  const [values, setValues] = useState({ email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const onChange = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(values)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not log in. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <span className="meridian-rule">Welcome back</span>
        <h1 className="auth-card__title">Log in</h1>
        <p className="auth-card__sub">
          Sign in to see your order history and check out faster.
        </p>
        <AuthForm
          mode="login"
          values={values}
          onChange={onChange}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
        />
        <p className="auth-card__alt">
          New to Meridian?{' '}
          <Link to="/signup" state={{ from: redirectTo }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
