import { createContext, useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading] = useState(false)

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
