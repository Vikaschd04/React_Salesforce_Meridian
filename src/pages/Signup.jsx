import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AuthForm from '../components/AuthForm.jsx'
import AuthLayout from '../components/AuthLayout.jsx'

const BENEFITS = [
  'Track every order from roast to doorstep',
  'Reorder your favourites in one click',
  'Your coordinates, saved for next time',
]

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/account'

  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    isCompany: false,
    companyName: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const onChange = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    if (values.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (values.isCompany && !values.companyName.trim()) {
      setError('Enter your company name, or uncheck "buying for a company".')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { firstName, lastName, email, password, isCompany, companyName } = values
      await signup({
        firstName,
        lastName,
        email,
        password,
        companyName: isCompany ? companyName.trim() : undefined,
      })
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="container auth-page">
      <AuthLayout
        eyebrow="Join Meridian"
        title="Create your account"
        subtitle="Track orders and reorder your favourites. It takes a few seconds."
        benefits={BENEFITS}
        footer={
          <p className="auth-card__alt">
            Already have an account?{' '}
            <Link to="/login" state={{ from: redirectTo }}>
              Log in
            </Link>
          </p>
        }
      >
        <AuthForm
          mode="signup"
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
