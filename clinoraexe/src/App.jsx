import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import AppRoutes from './routes'
import LicenseGate from './components/LicenseGate'
import SetupWizard from './components/SetupWizard'

export default function App() {
  const [configured, setConfigured] = useState(null) // null=checking, false=setup, true=ready

  useEffect(() => {
    invoke('get_setup_status')
      .then(res => setConfigured(res.configured))
      .catch(() => setConfigured(false))
  }, [])

  if (configured === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  if (!configured) return <SetupWizard />

  return (
    <LicenseGate>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </LicenseGate>
  )
}
