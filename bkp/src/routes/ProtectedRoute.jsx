import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/ui/Spinner'

/**
 * ProtectedRoute — guards authenticated and role-specific routes.
 *
 * Renders <Outlet /> on success so it composes with layout routes.
 * Without a role prop: requires authentication only.
 * With a role prop:    also requires that specific role, redirecting
 *                      the user to their own home if mismatched.
 */
export default function ProtectedRoute({ role }) {
  const { token, user, loading } = useAuth()

  // Still restoring session from /me — show a full-screen spinner
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--clr-bg)',
          color: 'var(--clr-text-muted)',
        }}
      >
        <Spinner size={28} />
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Wrong role — redirect to the user's actual home
  if (role && user.role !== role) {
    const home = user.role === 'pharmacy' ? '/pharmacy' : '/'
    return <Navigate to={home} replace />
  }

  return <Outlet />
}
