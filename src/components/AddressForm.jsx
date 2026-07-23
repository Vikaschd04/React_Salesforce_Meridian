import { useState } from 'react'
import { COUNTRIES, regionsFor } from '../data/regions.js'

const BLANK = {
  label: '',
  name: '',
  street: '',
  city: '',
  countryCode: 'US',
  stateCode: '',
  postalCode: '',
  isDefault: false,
}

/**
 * Add / edit form for a saved address. Reuses the same country + dependent
 * state/province dropdowns as Checkout (src/data/regions.js), so only valid
 * ISO codes are ever stored. Controlled internally; the parent gets the
 * address object via onSubmit and owns persistence.
 */
export default function AddressForm({ initial, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState({ ...BLANK, ...initial })
  const [error, setError] = useState(null)
  const region = regionsFor(values.countryCode)
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))
  const setCountry = (code) => setValues((prev) => ({ ...prev, countryCode: code, stateCode: '' }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err.message || 'Couldn’t save the address. Please try again.')
    }
  }

  return (
    <form className="address-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      )}
      <div className="checkout__fields">
        <label className="field field--span-2">
          <span className="field__label">
            Label <span className="field__opt">(e.g. Home, Office)</span>
          </span>
          <input type="text" maxLength={80} value={values.label} onChange={(e) => set('label', e.target.value)} />
        </label>
        <label className="field field--span-2">
          <span className="field__label">Recipient name</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <label className="field field--span-2">
          <span className="field__label">Street address</span>
          <input
            type="text"
            autoComplete="street-address"
            required
            value={values.street}
            onChange={(e) => set('street', e.target.value)}
          />
        </label>
        <label className="field field--span-1">
          <span className="field__label">City</span>
          <input
            type="text"
            autoComplete="address-level2"
            required
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </label>
        <label className="field field--span-1">
          <span className="field__label">Postal code</span>
          <input
            type="text"
            autoComplete="postal-code"
            required
            value={values.postalCode}
            onChange={(e) => set('postalCode', e.target.value)}
          />
        </label>
        <label className="field field--span-1">
          <span className="field__label">Country</span>
          <select autoComplete="country" value={values.countryCode} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {region && (
          <label className="field field--span-1">
            <span className="field__label">{region.label}</span>
            <select
              autoComplete="address-level1"
              value={values.stateCode}
              onChange={(e) => set('stateCode', e.target.value)}
            >
              <option value="">Select {region.label.toLowerCase()}…</option>
              {region.options.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="auth-form__checkbox">
        <input
          type="checkbox"
          checked={!!values.isDefault}
          onChange={(e) => set('isDefault', e.target.checked)}
        />
        Set as my default address
      </label>

      <div className="address-form__actions">
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save address'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
