import { createContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export const AuthContext = createContext(null)

// Captured once at module load — stable reference so the effect
// doesn't need `token` in its dependency array.
const initialToken = localStorage.getItem('auth_token')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(initialToken)
  // loading is true only when there's a stored token that needs to be
  // verified via /me. No token = already done, start false.
  const [loading, setLoading] = useState(!!initialToken)

  // On mount: restore the session if a stored token exists.
  // If /me returns 401 the token is invalid — clear it so the user goes to login.
  useEffect(() => {
    if (!initialToken) return // nothing to restore

    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('auth_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, []) // runs once on mount — initialToken is a stable module-level const

  // Login: get token → store → fetch user → return user so caller can redirect.
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const newToken = data.token

    localStorage.setItem('auth_token', newToken)
    setToken(newToken)

    const meRes = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${newToken}` },
    })
    const newUser = meRes.data.user
    setUser(newUser)

    return newUser // caller uses role to decide where to navigate
  }, [])

  // Logout: revoke server token then clear local state.
  // State is cleared even if the server call fails.
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore — clear state regardless
    } finally {
      localStorage.removeItem('auth_token')
      setToken(null)
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
