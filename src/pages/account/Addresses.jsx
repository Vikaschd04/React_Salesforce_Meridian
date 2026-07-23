import { useCallback, useEffect, useState } from 'react'
import { getAddresses, addAddress, updateAddress, deleteAddress } from '../../api/store.js'
import AddressForm from '../../components/AddressForm.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'

/** One saved address, formatted for display. */
function formatAddress(a) {
  const region = [a.stateCode, a.postalCode].filter(Boolean).join(' ')
  return [a.street, [a.city, region].filter(Boolean).join(', '), a.countryCode].filter(Boolean)
}

/**
 * Addresses tab: manage the shopper's saved shipping addresses — add, edit,
 * delete, and set a default (auto-filled at checkout). One default at a time,
 * enforced server-side. Login is guaranteed by AccountLayout's guard.
 */
export default function Addresses() {
  const [addresses, setAddresses] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('none') // 'none' | 'new' | <addressId being edited>
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setAddresses(await getAddresses())
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(values) {
    setBusy(true)
    try {
      const list = mode === 'new' ? await addAddress(values) : await updateAddress(mode, values)
      setAddresses(list)
      setMode('none')
    } finally {
      setBusy(false)
    }
  }

  async function makeDefault(id) {
    setAddresses(await updateAddress(id, { isDefault: true }))
  }

  async function remove(id) {
    if (!window.confirm('Remove this address?')) return
    setAddresses(await deleteAddress(id))
  }

  if (error) return <ErrorState message={error.message} onRetry={load} />
  if (!addresses) return <Spinner label="Loading your addresses…" />

  const editing = addresses.find((a) => a.id === mode)

  return (
    <div className="addresses">
      {addresses.length === 0 && mode !== 'new' ? (
        <div className="account-empty">
          <p>No saved addresses yet. Add one to check out faster next time.</p>
          <button type="button" className="btn" onClick={() => setMode('new')}>
            Add an address
          </button>
        </div>
      ) : (
        <>
          <ul className="address-list">
            {addresses.map((a) =>
              mode === a.id ? (
                <li key={a.id} className="address-card address-card--editing">
                  <AddressForm
                    initial={a}
                    onSubmit={handleSubmit}
                    onCancel={() => setMode('none')}
                    submitting={busy}
                  />
                </li>
              ) : (
                <li key={a.id} className="address-card">
                  <div className="address-card__head">
                    <span className="address-card__label">{a.label || 'Address'}</span>
                    {a.isDefault && <span className="address-card__badge">Default</span>}
                  </div>
                  <p className="address-card__name">{a.name}</p>
                  <p className="address-card__lines">
                    {formatAddress(a).map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </p>
                  <div className="address-card__actions">
                    {!a.isDefault && (
                      <button type="button" className="address-card__action" onClick={() => makeDefault(a.id)}>
                        Make default
                      </button>
                    )}
                    <button type="button" className="address-card__action" onClick={() => setMode(a.id)}>
                      Edit
                    </button>
                    <button type="button" className="address-card__action address-card__action--danger" onClick={() => remove(a.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>

          {mode === 'new' ? (
            <div className="address-card address-card--editing">
              <h3 className="account-section-title">New address</h3>
              <AddressForm onSubmit={handleSubmit} onCancel={() => setMode('none')} submitting={busy} />
            </div>
          ) : (
            !editing && (
              <button type="button" className="btn btn--ghost addresses__add" onClick={() => setMode('new')}>
                + Add another address
              </button>
            )
          )}
        </>
      )}
    </div>
  )
}
