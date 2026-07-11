import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import Breadcrumbs from '../../components/Breadcrumbs.jsx'
import Spinner from '../../components/Spinner.jsx'

/**
 * Shared shell for the account area: auth guard, header, and the
 * Profile / Orders tab bar. Child routes render into the Outlet:
 *   /account            → Profile
 *   /account/orders     → Orders (history)
 *   /account/orders/:id → OrderDetail
 */
export default function AccountLayout() {
  const { user, loading, logout } = useAuth()

  if (loading) return <Spinner label="Loading your account…" />
  if (!user) return <Navigate to="/login" replace state={{ from: '/account' }} />

  return (
    <div className="container account-page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Account' }]} />

      <header className="account-head">
        <div>
          <h1 className="page-head__title">Hi, {user.firstName || 'there'}</h1>
          <p className="account-head__email">{user.email}</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <nav className="account-tabs" aria-label="Account sections">
        <NavLink to="/account" end className="account-tab">
          Profile
        </NavLink>
        <NavLink to="/account/orders" className="account-tab">
          Order history
        </NavLink>
      </nav>

      <div className="account-body">
        <Outlet />
      </div>
    </div>
  )
}
