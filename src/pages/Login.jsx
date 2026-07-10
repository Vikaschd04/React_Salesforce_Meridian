import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'
import AuthLayout from '../components/AuthLayout.jsx'

const BENEFITS = [
  'Pick up where you left off',
  'See your full order history',
  'Reorder in a couple of clicks',
]

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
      <AuthLayout
        eyebrow="Welcome back"
        title="Log in"
        subtitle="Sign in to see your order history and check out faster."
        benefits={BENEFITS}
        footer={
          <p className="auth-card__alt">
            New to Meridian?{' '}
            <Link to="/signup" state={{ from: redirectTo }}>
              Create an account
            </Link>
          </p>
        }
      >
        <AuthForm
          mode="login"
          values={values}
          onChange={onChange}
          onSubmit={onSubmit}
          submitting={submitting}
          error={error}
        />
      </AuthLayout>
    </div>
  )
}
