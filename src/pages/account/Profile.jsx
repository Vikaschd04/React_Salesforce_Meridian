import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { updateProfile } from '../../api/store.js'

/** Profile tab: view + inline-edit the shopper's name (email is the login key). */
export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({ firstName: user.firstName, lastName: user.lastName })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const profile = await updateProfile(values)
      refreshUser(profile)
      setEditing(false)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="profile-heading" className="profile">
      <h2 id="profile-heading" className="account-section-title">
        Your details
      </h2>

      {!editing ? (
        <div className="profile-card">
          <dl className="profile-card__rows">
            <div className="profile-card__row">
              <dt>Name</dt>
              <dd>
                {user.firstName} {user.lastName}
              </dd>
            </div>
            <div className="profile-card__row">
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <div className="profile-card__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setValues({ firstName: user.firstName, lastName: user.lastName })
                setEditing(true)
              }}
            >
              Edit name
            </button>
            {saved && (
              <span className="profile-card__saved" role="status">
                Saved ✓
              </span>
            )}
          </div>
        </div>
      ) : (
        <form className="auth-form profile-card" onSubmit={onSubmit}>
          {error && (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-form__row">
            <label className="field">
              <span className="field__label">First name</span>
              <input
                type="text"
                required
                value={values.firstName}
                onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field__label">Last name</span>
              <input
                type="text"
                required
                value={values.lastName}
                onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
              />
            </label>
          </div>
          <p className="field__hint">Email can’t be changed — it’s how you sign in.</p>
          <div className="profile-card__actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
