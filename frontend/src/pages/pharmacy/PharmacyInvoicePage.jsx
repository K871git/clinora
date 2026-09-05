import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getPharmacyPrescription } from '../../services/pharmacyService'
import { getSettings } from '../../services/settingsService'
import usePrintSettings from '../../hooks/usePrintSettings'
import PrintSettingsPanel from '../../components/ui/PrintSettingsPanel'
import Spinner from '../../components/ui/Spinner'
import '../../styles/pharmacy-invoice.css'

const PAPERS = [
  { value: 'a4',      label: 'A4' },
  { value: 'a5',      label: 'A5' },
  { value: 'letter',  label: 'Letter' },
  { value: 'thermal', label: 'Thermal 80mm' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtPrice(amount) {
  return parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

function IconPrint() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function PharmacyInvoicePage() {
  const { prescriptionId } = useParams()
  const [prescription, setPrescription] = useState(null)
  const [clinicName,   setClinicName]   = useState('')
  const [status,       setStatus]       = useState('loading')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const printSettings = usePrintSettings('a4')
  const { paper, docVariant } = printSettings

  useEffect(() => {
    Promise.all([
      getPharmacyPrescription(prescriptionId),
      getSettings(),
    ])
      .then(([rxRes, stgRes]) => {
        setPrescription(rxRes.data.data)
        setClinicName(stgRes.data.data.clinic.name ?? '')
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }, [prescriptionId])

  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(() => window.print(), 450)
      return () => clearTimeout(t)
    }
  }, [status])

  if (status === 'loading') return <div className="inv-loading"><Spinner size={24} /></div>
  if (status === 'error')   return <div className="inv-loading">Could not load prescription.</div>

  const p        = prescription.patient
  const items    = prescription.items ?? []
  const total    = prescription.total_amount ?? 0
  const hasPrice = items.some(i => i.unit_price != null)
  const rxNum    = `RX-${prescription.id.toString().padStart(5, '0')}`

  const patientMeta = [
    p.age != null && `${p.age} yrs`,
    p.gender,
  ].filter(Boolean).join(', ')

  return (
    <div className="inv-page">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="inv-toolbar">
        <button className="inv-toolbar-btn inv-toolbar-btn--back" onClick={() => window.close()}>
          ✕ Close
        </button>
        <span className="inv-toolbar-title">Invoice — {p.name}</span>
        <button
          className={`inv-toolbar-btn inv-toolbar-btn--settings${settingsOpen ? ' inv-toolbar-btn--settings-on' : ''}`}
          onClick={() => setSettingsOpen(o => !o)}
        >
          <IconSettings />
          Page Setup
        </button>
        <button className="inv-toolbar-btn inv-toolbar-btn--print" onClick={() => window.print()}>
          <IconPrint />
          Print
        </button>
      </div>

      {/* ── Settings panel ───────────────────────────────────────────────── */}
      {settingsOpen && (
        <PrintSettingsPanel papers={PAPERS} {...printSettings} />
      )}

      {/* ── Invoice document ─────────────────────────────────────────────── */}
      <div className={`inv-doc inv-doc--${docVariant}`}>

        <div className="inv-doc-header">
          <div className="inv-brand">
            <div className="inv-brand-name">{clinicName || 'Rx Dispensary'}</div>
            <div className="inv-brand-sub">Pharmacy Receipt</div>
          </div>
          <div className="inv-title-block">
            <div className="inv-title">Invoice</div>
            <div className="inv-number">{rxNum}</div>
          </div>
        </div>

        <div className="inv-info-grid">
          <div className="inv-info-block">
            <div className="inv-info-row">
              <span className="inv-info-label">Patient</span>
              <span className="inv-info-value">{p.name}</span>
            </div>
            {patientMeta && (
              <div className="inv-info-row">
                <span className="inv-info-label">Age / Sex</span>
                <span className="inv-info-value">{patientMeta}</span>
              </div>
            )}
            {p.mobile && (
              <div className="inv-info-row">
                <span className="inv-info-label">Mobile</span>
                <span className="inv-info-value">{p.mobile}</span>
              </div>
            )}
            {prescription.doctor && (
              <div className="inv-info-row">
                <span className="inv-info-label">Doctor</span>
                <span className="inv-info-value">{doctorLabel(prescription.doctor.name)}</span>
              </div>
            )}
          </div>

          <div className="inv-info-block inv-info-block--right">
            <div className="inv-info-row">
              <span className="inv-info-label">Invoice #</span>
              <span className="inv-info-value">{rxNum}</span>
            </div>
            <div className="inv-info-row">
              <span className="inv-info-label">Dispensed</span>
              <span className="inv-info-value">{fmtDate(prescription.completed_at)}</span>
            </div>
            <div className="inv-info-row">
              <span className="inv-info-label">Prescribed</span>
              <span className="inv-info-value">{fmtDate(prescription.prescribed_at)}</span>
            </div>
          </div>
        </div>

        <table className="inv-table">
          <thead>
            <tr>
              <th style={{ width: '32px' }}>#</th>
              <th>Medicine</th>
              <th>Dosage / Instructions</th>
              {hasPrice && <th style={{ textAlign: 'right', width: '110px' }}>Amount</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id ?? idx}>
                <td>{idx + 1}</td>
                <td>
                  <div className="inv-med-name">{item.medicine_name}</div>
                  {item.dosage && <div className="inv-med-detail">{item.dosage}</div>}
                </td>
                <td>
                  {[item.frequency, item.duration].filter(Boolean).join(' · ') || '—'}
                  {item.instructions && (
                    <div className="inv-med-detail">{item.instructions}</div>
                  )}
                </td>
                {hasPrice && (
                  <td className="inv-amount">
                    {item.unit_price != null ? `₹${fmtPrice(item.unit_price)}` : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {hasPrice && total > 0 && (
            <tfoot>
              <tr className="inv-total-row">
                <td colSpan={3} className="inv-total-label">Total Amount</td>
                <td className="inv-amount inv-total-amount">₹{fmtPrice(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        <div className="inv-footer">
          <div className="inv-sig-block">
            <div className="inv-sig-line" />
            <div className="inv-sig-label">Pharmacist Signature</div>
          </div>
          <div className="inv-sig-block">
            <div className="inv-sig-line" />
            <div className="inv-sig-label">Patient / Receiver Signature</div>
          </div>
        </div>

        <div className="inv-note">
          This is a computer-generated invoice. Thank you for visiting.
        </div>
      </div>
    </div>
  )
}
