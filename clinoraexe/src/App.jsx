import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import AppRoutes from './routes'
import LicenseGate from './components/LicenseGate'

export default function App() {
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
