import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPharmacyPrescription } from '../../services/pharmacyService'
import { getSettings } from '../../services/settingsService'
import Spinner from '../../components/ui/Spinner'
import '../../styles/print-prescription.css'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function MedicineList({ items }) {
  if (!items?.length) {
    return <p className="print-no-medicines">No medicines on this prescription.</p>
  }
  return (
    <ol className="print-med-list">
      {items.map((item, idx) => (
        <li key={item.id ?? idx} className="print-med-item">
          <div className="print-med-body">
            <div className="print-med-name">{item.medicine_name}</div>
            {(item.dosage || item.frequency || item.duration) && (
              <div className="print-med-meta">
                {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
              </div>
            )}
            {item.instructions && (
              <div className="print-med-instructions">{item.instructions}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function PharmacyPrescriptionPrintPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState(null)
  const [settings,     setSettings]     = useState(null)
  const [status,       setStatus]       = useState('loading')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPharmacyPrescription(prescriptionId),
      getSettings(),
    ])
      .then(([rxRes, stgRes]) => {
        if (!cancelled) {
          setPrescription(rxRes.data)
          setSettings(stgRes.data)
          setStatus('done')
        }
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [prescriptionId])

  if (status === 'loading') {
    return (
      <div className="print-page" style={{ justifyContent: 'center' }}>
        <Spinner size={28} />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="print-page" style={{ justifyContent: 'center', padding: 60, color: '#64748b', textAlign: 'center' }}>
        Could not load prescription.
      </div>
    )
  }

  const clinic = settings.clinic
  const ps     = settings
  const p      = prescription.patient

  const drName = prescription.doctor?.name
    ? (/^dr\.?\s/i.test(prescription.doctor.name) ? prescription.doctor.name : `Dr. ${prescription.doctor.name}`)
    : (clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : 'Doctor')

  const patientMeta = [
    p.age != null && `${p.age} yrs`,
    p.gender,
  ].filter(Boolean).join(', ')

  return (
    <div className="print-page">

      {/* Toolbar — hidden on print */}
      <div className="print-toolbar print-hide">
        <button
          className="print-toolbar-back"
          onClick={() => navigate(-1)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close
        </button>
        <span className="print-toolbar-title">
          Prescription — {p.name} · {fmtDate(prescription.prescribed_at)}
        </span>
        <button className="print-toolbar-btn" onClick={() => window.print()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print
        </button>
      </div>

      {/* Paper */}
      <div className="print-paper print-paper--standalone">

        {/* Clinic + Patient header */}
        <div className="print-standalone-header">
          <div className="print-clinic-col">
            <div className="print-clinic-name">{clinic.name || 'Clinic'}</div>
            {drName && <div className="print-doctor-name">{drName}</div>}
            {ps.show_doctor_contact && clinic.qualification && (
              <div className="print-qualification">{clinic.qualification}</div>
            )}
            {ps.show_clinic_contact && clinic.address && (
              <div className="print-address">{clinic.address}</div>
            )}
            {ps.show_clinic_contact && clinic.contact && (
              <div className="print-clinic-contact">{clinic.contact}</div>
            )}
          </div>

          <div className="print-patient-col">
            <div className="print-patient-row">
              <span className="print-patient-label">Date</span>
              <span className="print-patient-value">{fmtDateTime(prescription.prescribed_at)}</span>
            </div>
            <div className="print-patient-row">
              <span className="print-patient-label">Patient</span>
              <span className="print-patient-value">{p.name}</span>
            </div>
            {patientMeta && (
              <div className="print-patient-row">
                <span className="print-patient-label">Age / Sex</span>
                <span className="print-patient-value">{patientMeta}</span>
              </div>
            )}
            {p.mobile && (
              <div className="print-patient-row">
                <span className="print-patient-label">Contact</span>
                <span className="print-patient-value">{p.mobile}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rx + medicines */}
        <div className="print-rx-symbol">&#8478;</div>
        <MedicineList items={prescription.items} />

        {/* Doctor notes */}
        {prescription.doctor_notes && (
          <div className="print-notes-section" style={{ marginTop: 14 }}>
            <hr className="print-rule" />
            <div className="print-notes-label">Doctor Notes</div>
            <div className="print-notes-text">{prescription.doctor_notes}</div>
          </div>
        )}

        {/* Pharmacist notes */}
        {prescription.pharmacist_notes && (
          <div className="print-notes-section" style={{ marginTop: 10 }}>
            <div className="print-notes-label">Pharmacist Notes</div>
            <div className="print-notes-text">{prescription.pharmacist_notes}</div>
          </div>
        )}

        {/* Signature */}
        <div className="print-signature-section">
          <div className="print-signature-block">
            <div className="print-signature-line" />
            <div className="print-signature-name">{drName}</div>
            {clinic.qualification && (
              <div className="print-signature-qual">{clinic.qualification}</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
