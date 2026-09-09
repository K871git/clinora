import axios from 'axios'

/**
 * api — the single Axios instance used by the entire app.
 *
 * Base URL comes from VITE_API_URL so it never needs to be
 * changed in application code — only in .env.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Attach the Sanctum token on every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global response error handling.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url ?? ''

    // Expired or revoked token during an active session.
    // Skip login and me — those handle 401 themselves.
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/me')) {
      localStorage.removeItem('auth_token')
      // Flag for LoginPage to show "session expired" instead of a blank form.
      const isInactivity = error.response?.data?.expired === true
      sessionStorage.setItem('session_expired', isInactivity ? 'inactivity' : '1')
      window.location.href = '/login'
    }

    // Backend unreachable — common on LAN if server isn't running.
    if (!error.response) {
      console.error('[API] Network error — is the Laravel backend running?', error.message)
    }

    return Promise.reject(error)
  }
)

export default api
