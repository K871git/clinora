import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import AppRoutes from './routes'
import LicenseGate from './components/LicenseGate'
import SetupWizard from './components/SetupWizard'
import ConsentScreen from './components/ConsentScreen'
import NetworkGuard from './components/NetworkGuard'

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
    <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  </div>
)

export default function App() {
  // null = checking, false = not done, true = done
  const [configured, setConfigured] = useState(null)
  const [consented,  setConsented]  = useState(null)

  useEffect(() => {
    invoke('get_setup_status')
      .then(res => {
        setConfigured(res.configured)
        if (res.configured) {
          invoke('check_consent')
            .then(r => setConsented(r.consented))
            .catch(() => setConsented(false))
        }
      })
      .catch(() => setConfigured(false))
  }, [])

  if (configured === null || (configured && consented === null)) return <Spinner />

  if (!configured) return <SetupWizard />

  if (!consented) return <ConsentScreen onAccepted={() => setConsented(true)} />

  /* DEV MODE — re-wrap with <LicenseGate> before production build */
  return (
    <NetworkGuard>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </NetworkGuard>
  )
}
