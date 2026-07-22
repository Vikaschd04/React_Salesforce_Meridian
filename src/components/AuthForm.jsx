/**
 * Presentational auth form used by Login and Signup. The parent owns state and
 * submission; this just renders fields + error + submit with proper labels and
 * accessible error wiring.
 */
export default function AuthForm({
  mode, // 'login' | 'signup'
  values,
  onChange,
  onSubmit,
  submitting,
  error,
}) {
  const isSignup = mode === 'signup'

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {error && (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      )}

      {isSignup && (
        <div className="auth-form__row">
          <label className="field">
            <span className="field__label">First name</span>
            <input
              type="text"
              autoComplete="given-name"
              required
              value={values.firstName}
              onChange={(e) => onChange('firstName', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Last name</span>
            <input
              type="text"
              autoComplete="family-name"
              required
              value={values.lastName}
              onChange={(e) => onChange('lastName', e.target.value)}
            />
          </label>
        </div>
      )}

      <label className="field">
        <span className="field__label">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={values.email}
          onChange={(e) => onChange('email', e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Password</span>
        <input
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={8}
          value={values.password}
          onChange={(e) => onChange('password', e.target.value)}
        />
        {isSignup && <span className="field__hint">At least 8 characters.</span>}
      </label>

      {isSignup && (
        <div className="auth-form__company">
          <label className="auth-form__checkbox">
            <input
              type="checkbox"
              checked={values.isCompany}
              onChange={(e) => onChange('isCompany', e.target.checked)}
            />
            <span>I’m buying for a company</span>
          </label>
          {values.isCompany && (
            <label className="field">
              <span className="field__label">Company name</span>
              <input
                type="text"
                autoComplete="organization"
                required
                placeholder="Acme Roasters"
                value={values.companyName}
                onChange={(e) => onChange('companyName', e.target.value)}
              />
              <span className="field__hint">
                Use your work email above — teammates with the same email domain
                automatically share this account’s order history.
              </span>
            </label>
          )}
        </div>
      )}

      <button type="submit" className="btn btn--block" disabled={submitting}>
        {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
      </button>
    </form>
  )
}
