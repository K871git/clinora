import { createContext, useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true until session check completes

  // On every mount (including Ctrl+R reload) restore session from Rust backend
  useEffect(() => {
    invoke('get_me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
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
