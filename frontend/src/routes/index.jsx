import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import AppLayout from '../layouts/AppLayout'
import LoginPage from '../pages/auth/LoginPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import PatientsPage from '../pages/patients/PatientsPage'
import PatientDetailPage from '../pages/patients/PatientDetailPage'
import NewVisitPage from '../pages/visits/NewVisitPage'
import VisitDetailPage from '../pages/visits/VisitDetailPage'
import NewPrescriptionPage from '../pages/prescriptions/NewPrescriptionPage'
import PrescriptionDetailPage from '../pages/prescriptions/PrescriptionDetailPage'
import PrintPrescriptionPage from '../pages/prescriptions/PrintPrescriptionPage'
import PrescriptionsPage from '../pages/prescriptions/PrescriptionsPage'
import VisitInvoicePage from '../pages/visits/VisitInvoicePage'
import PharmacyPage from '../pages/pharmacy/PharmacyPage'
import PharmacyPrescriptionPage from '../pages/pharmacy/PharmacyPrescriptionPage'
import PharmacyHistoryPage from '../pages/pharmacy/PharmacyHistoryPage'
import PharmacyHelpPage from '../pages/pharmacy/help/PharmacyHelpPage'
import PharmacyInvoicePage from '../pages/pharmacy/PharmacyInvoicePage'
import PharmacySettingsPage from '../pages/pharmacy/PharmacySettingsPage'
import SettingsPage from '../pages/settings/SettingsPage'
import ProfilePage from '../pages/profile/ProfilePage'
import MedicinesPage from '../pages/medicines/MedicinesPage'
import PharmacyStockPage from '../pages/pharmacy/PharmacyStockPage'

/* Forces PatientDetailPage to fully remount when :id changes, resetting all state */
function KeyedPatientDetail() {
  const { id } = useParams()
  return <PatientDetailPage key={id} />
}

/**
 * AppRoutes — central route registry.
 *
 * Structure:
 *   /login            — public
 *   ProtectedRoute    — requires auth (handles loading + 401)
 *     AppLayout       — sidebar + header + <Outlet />
 *       ProtectedRoute role="doctor"   — doctor-only pages
 *       ProtectedRoute role="pharmacy" — pharmacy-only pages
 *
 * Add new pages inside the appropriate role group below.
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated shell — auth check + session restore */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          {/* Shared — any authenticated user */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Doctor */}
          <Route element={<ProtectedRoute role="doctor" />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:id" element={<KeyedPatientDetail />} />
            <Route path="/patients/:id/visits/new" element={<NewVisitPage />} />
            <Route path="/visits/:visitId" element={<VisitDetailPage />} />
            <Route path="/visits/:visitId/prescriptions/new" element={<NewPrescriptionPage />} />
            <Route path="/prescriptions/:prescriptionId" element={<PrescriptionDetailPage />} />
            <Route path="/prescriptions" element={<PrescriptionsPage />} />
            <Route path="/medicines" element={<MedicinesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Pharmacy */}
          <Route element={<ProtectedRoute role="pharmacy" />}>
            <Route path="/pharmacy" element={<PharmacyPage />} />
            <Route path="/pharmacy/history" element={<PharmacyHistoryPage />} />
            <Route path="/pharmacy/settings" element={<PharmacySettingsPage />} />
            <Route path="/pharmacy/stock" element={<PharmacyStockPage />} />
            <Route path="/pharmacy/help" element={<PharmacyHelpPage />} />
            <Route path="/pharmacy/prescriptions/:prescriptionId" element={<PharmacyPrescriptionPage />} />
          </Route>

        </Route>
      </Route>

      {/* Print / invoice routes — standalone pages, no AppLayout sidebar/header */}
      <Route element={<ProtectedRoute role="doctor" />}>
        <Route path="/prescriptions/:prescriptionId/print" element={<PrintPrescriptionPage />} />
        <Route path="/visits/:visitId/invoice" element={<VisitInvoicePage />} />
      </Route>

      {/* Pharmacy standalone pages */}
      <Route element={<ProtectedRoute role="pharmacy" />}>
        <Route path="/pharmacy/prescriptions/:prescriptionId/invoice" element={<PharmacyInvoicePage />} />
      </Route>

      {/* Unknown paths go to root; ProtectedRoute redirects from there */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
