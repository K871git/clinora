import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getPharmacyPrescription } from '../../services/pharmacyService'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PharmacyLabelPage() {
  const { prescriptionId } = useParams()
  const [prescription, setPrescription] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getPharmacyPrescription(prescriptionId)
      .then(({ data }) => { setPrescription(data); setStatus('done') })
      .catch(() => setStatus('error'))
  }, [prescriptionId])

  if (status === 'loading') return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>
  if (status === 'error')   return <div style={{ padding: 40, textAlign: 'center' }}>Could not load prescription.</div>
  if (!prescription)        return null

  const items   = prescription.items ?? []
  const patient = prescription.patient
  const doctor  = prescription.doctor
  const rxDate  = fmtDate(prescription.prescribed_at)
  const clinicName = prescription.clinic?.name ?? 'Clinora Clinic'
  const doctorLabel = doctor?.name
    ? (/^dr\.?\s/i.test(doctor.name) ? doctor.name : `Dr. ${doctor.name}`)
    : ''

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#fff', padding: 16 }}>
      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 10 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '8px 20px', background: '#6366f1', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          🖨 Print Labels
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db',
            borderRadius: 6, cursor: 'pointer', fontSize: 14,
          }}
        >
          Close
        </button>
      </div>

      {/* One label per medicine item */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {items.map((item, idx) => (
          <div key={item.id ?? idx} style={{
            width: 280, border: '1px solid #000', borderRadius: 6,
            padding: '10px 12px', pageBreakInside: 'avoid', boxSizing: 'border-box',
          }}>
            {/* Clinic */}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#374151', marginBottom: 4 }}>
              {clinicName}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #d1d5db', marginBottom: 6 }} />

            {/* Patient */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
              {patient.name}
            </div>
            {(patient.age != null || patient.gender) && (
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                {[patient.age != null && `${patient.age} yrs`, patient.gender].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Medicine */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 2 }}>
              {item.medicine_name}
            </div>

            {/* Dosage line */}
            {(item.dosage || item.frequency || item.duration) && (
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                {[item.dosage, item.frequency, item.duration && `for ${item.duration}`].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Instructions */}
            {item.instructions && (
              <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginBottom: 6, lineHeight: 1.4 }}>
                {item.instructions}
              </div>
            )}

            <div style={{ borderTop: '1px solid #d1d5db', marginTop: 4, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: '#6b7280' }}>Date: {rxDate}</span>
              {doctorLabel && <span style={{ fontSize: 10, color: '#6b7280' }}>{doctorLabel}</span>}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>
    </div>
  )
}
