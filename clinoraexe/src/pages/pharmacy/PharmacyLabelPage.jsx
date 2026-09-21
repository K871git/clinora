import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPharmacyPrescription } from '../../services/pharmacyService'
import { fmtDate } from '../../lib/dateUtils'
import Spinner from '../../components/ui/Spinner'
import '../../styles/pharmacy-invoice.css'

export default function PharmacyLabelPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getPharmacyPrescription(prescriptionId)
      .then(({ data }) => { setPrescription(data); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [prescriptionId])

  if (status === 'loading') return <div className="inv-loading"><Spinner size={24} /></div>
  if (status === 'error')   return <div className="inv-loading">Could not load prescription.</div>
  if (!prescription)        return null

  const items      = prescription.items ?? []
  const patient    = prescription.patient
  const doctor     = prescription.doctor
  const rxDate     = fmtDate(prescription.prescribed_at)
  const clinicName = prescription.clinic?.name ?? 'Clinora Clinic'
  const doctorLabel = doctor?.name
    ? (/^dr\.?\s/i.test(doctor.name) ? doctor.name : `Dr. ${doctor.name}`)
    : ''

  return (
    <div style={{ minHeight: '100vh', background: '#d1d5db', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Toolbar ── */}
      <div className="inv-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="inv-toolbar-btn inv-toolbar-btn--back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <span className="inv-toolbar-title">
          Labels — {patient?.name}
          {items.length > 0 && (
            <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>
              ({items.length} {items.length === 1 ? 'medicine' : 'medicines'})
            </span>
          )}
        </span>
        <button
          className="inv-toolbar-btn inv-toolbar-btn--print"
          onClick={() => window.print()}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print Labels
        </button>
      </div>

      {/* ── Label grid ── */}
      <div style={{ padding: '24px 32px', flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#fff', borderRadius: 10, maxWidth: 400, margin: '40px auto' }}>
            No medicines in this prescription.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {items.map((item, idx) => (
              <div key={item.id ?? idx} style={{
                width: 290,
                background: '#fff',
                border: '1.5px solid #000',
                borderRadius: 8,
                padding: '12px 14px',
                boxSizing: 'border-box',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                pageBreakInside: 'avoid',
              }}>
                {/* Clinic name */}
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#4b5563', marginBottom: 5 }}>
                  {clinicName}
                </div>
                <div style={{ borderTop: '1px solid #d1d5db', marginBottom: 8 }} />

                {/* Patient */}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 1 }}>
                  {patient?.name}
                </div>
                {(patient?.age != null || patient?.gender) && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                    {[patient.age != null && `${patient.age} yrs`, patient.gender].filter(Boolean).join(' · ')}
                  </div>
                )}

                {/* Medicine */}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1d4ed8', marginBottom: 3 }}>
                  {item.medicine_name}
                </div>

                {/* Dosage / frequency / duration */}
                {(item.dosage || item.frequency || item.duration) && (
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: item.instructions ? 3 : 8, lineHeight: 1.5 }}>
                    {[item.dosage, item.frequency, item.duration && `for ${item.duration}`].filter(Boolean).join(' · ')}
                  </div>
                )}

                {/* Instructions */}
                {item.instructions && (
                  <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
                    {item.instructions}
                  </div>
                )}

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 7, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>Date: {rxDate}</span>
                  {doctorLabel && <span style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>{doctorLabel}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .inv-toolbar { display: none !important; }
          body { background: white !important; margin: 0; }
        }
      `}</style>
    </div>
  )
}
