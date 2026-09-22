import { createContext, useState, useCallback, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const pingRef = useRef(null)

  // Restore session on mount
  useEffect(() => {
    invoke('get_me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  function expireSession() {
    sessionStorage.setItem('session_expired', 'true')
    setUser(null)
  }

  // Periodic session ping every 5 minutes
  useEffect(() => {
    pingRef.current = setInterval(() => {
      if (!user) return
      invoke('get_me').catch((err) => {
        const msg = typeof err === 'string' ? err : ''
        if (msg.includes('Not authenticated')) expireSession()
      })
    }, 2 * 60 * 1000)
    return () => clearInterval(pingRef.current)
  }, [user])

  // Global auth-expired event (from safeInvoke wrapper in invokeAuth.js)
  useEffect(() => {
    window.addEventListener('clinora:auth-expired', expireSession)
    return () => window.removeEventListener('clinora:auth-expired', expireSession)
  }, [])

  const login = useCallback(async (email, password, role = 'doctor') => {
    const newUser = await invoke('login', { payload: { email, password, role } })
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(async () => {
    try { await invoke('logout') } catch { /* ignore */ }
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token: null, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
