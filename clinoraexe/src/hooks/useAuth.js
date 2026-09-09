import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

/**
 * useAuth — access auth state from any component.
 * Must be used inside <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}
