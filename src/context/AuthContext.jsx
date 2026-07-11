import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as store from '../api/store.js'

/**
 * Shopper auth state. The session lives in an httpOnly cookie managed by the
 * BFF; this context just mirrors "who am I" for the UI and exposes the auth
 * actions. On mount it asks the BFF via getMe() (null = logged out).
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    store
      .getMe()
      .then((profile) => alive && setUser(profile))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  async function login(credentials) {
    const profile = await store.login(credentials)
    setUser(profile)
    return profile
  }

  async function signup(details) {
    const profile = await store.signup(details)
    setUser(profile)
    return profile
  }

  async function logout() {
    try {
      await store.logout()
    } finally {
      setUser(null)
    }
  }

  /** Replace the cached profile (e.g. after a profile edit). */
  function refreshUser(profile) {
    setUser(profile)
  }

  const value = useMemo(
    () => ({ user, loading, isAuthed: !!user, login, signup, logout, refreshUser }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
