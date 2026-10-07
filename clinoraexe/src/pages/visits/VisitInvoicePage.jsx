import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVisit, listVisitCharges } from '../../services/visitService'
import { getSettings } from '../../services/settingsService'
import usePrintSettings from '../../hooks/usePrintSettings'
import PrintSettingsPanel from '../../components/ui/PrintSettingsPanel'
import Spinner from '../../components/ui/Spinner'
import '../../styles/pharmacy-invoice.css'
import '../../styles/visit-invoice.css'

const PAPERS = [
  { value: 'a4',     label: 'A4' },
  { value: 'a5',     label: 'A5' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal',  label: 'Legal' },
]

function fmtDate(iso) {
  if (!iso) return '—'
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtPrice(amount) {
  return parseFloat(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function doctorLabel(name) {
  if (!name) return ''
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
}

function amountInWords(amount) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function toW(n) {
    if (n === 0) return ''
    if (n < 20)  return units[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '')
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toW(n % 100) : '')
    if (n < 100000) return toW(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toW(n % 1000) : '')
    if (n < 10000000) return toW(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toW(n % 100000) : '')
    return toW(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toW(n % 10000000) : '')
  }

  const n = Math.round(amount)
  const paise = Math.round((amount - n) * 100)
  if (n === 0 && paise === 0) return 'Rupees Zero Only'
  let result = 'Rupees ' + toW(n).trim()
  if (paise > 0) result += ' and ' + toW(paise).trim() + ' Paise'
  return result + ' Only'
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

export default function VisitInvoicePage() {
  const { visitId } = useParams()
  const navigate    = useNavigate()
  const [visit,        setVisit]        = useState(null)
  const [settings,     setSettings]     = useState(null)
  const [charges,      setCharges]      = useState([])
  const [status,       setStatus]       = useState('loading')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const printSettings = usePrintSettings('a4')
  const { docVariant } = printSettings

  useEffect(() => {
    Promise.all([getVisit(visitId), getSettings(), listVisitCharges(visitId)])
      .then(([visitRes, stgRes, chargesRes]) => {
        setVisit(visitRes.data)
        setSettings(stgRes.data)
        setCharges(chargesRes.data.data ?? [])
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }, [visitId])

  if (status === 'loading') return <div className="inv-loading"><Spinner size={24} /></div>
  if (status === 'error')   return <div className="inv-loading">Could not load invoice.</div>

  const p             = visit.patient
  const clinicName    = settings?.clinic?.name          || 'Clinic'
  const clinicAddr    = settings?.clinic?.address       || ''
  const clinicPhone   = settings?.clinic?.contact       || ''
  const doctorName    = visit.doctor ? doctorLabel(visit.doctor.name) : ''
  const qualification = settings?.clinic?.qualification || ''

  const consultFee   = parseFloat(visit.consultation_fee ?? 0)
  const chargesTotal = charges.reduce((s, c) => s + parseFloat(c.amount || 0), 0)
  const gstPercent   = parseFloat(settings?.gst_percent ?? 0)
  const subTotal     = consultFee + chargesTotal
  const gstAmount    = gstPercent > 0 ? (subTotal * gstPercent / 100) : 0
  const grandTotal   = subTotal + gstAmount

  const patientMeta = [p.age != null && `${p.age} yrs`, p.gender].filter(Boolean).join(', ')
  const invNum      = `INV-${visit.id.toString().padStart(5, '0')}`
  const isPaid      = visit.status === 'completed'

  return (
    <div className="inv-page">

      {/* Screen toolbar */}
      <div className="inv-toolbar">
        <button className="inv-toolbar-btn inv-toolbar-btn--back" onClick={() => navigate(-1)}>
          ✕ Close
        </button>
        <span className="inv-toolbar-title">Doctor Invoice — {p.name}</span>
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

      {settingsOpen && <PrintSettingsPanel papers={PAPERS} {...printSettings} />}

      {/* Invoice document */}
      <div className={`inv-doc inv-doc--${docVariant} inv-doc--visit`}>

        {/* ── Header ── */}
        <div className="inv-doc-header">
          <div className="inv-brand">
            <div className="inv-brand-name">{clinicName}</div>
            {qualification && <div className="vinv-brand-qual">{qualification}</div>}
            {clinicAddr   && <div className="inv-brand-sub">{clinicAddr}</div>}
            {clinicPhone  && <div className="vinv-brand-phone">{clinicPhone}</div>}
          </div>
          <div className="inv-title-block vinv-title-block">
            <div className="inv-title">Doctor Invoice</div>
            <div className="vinv-header-meta">
              <div className="inv-number">{invNum}</div>
              <div className="vinv-header-date">{fmtDate(visit.visited_at)}</div>
            </div>
          </div>
        </div>

        {/* ── Patient + Visit info ── */}
        <div className="inv-info-grid">
          <div className="inv-info-block">
            <div className="vinv-section-label">Patient Details</div>
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
            {doctorName && (
              <div className="inv-info-row">
                <span className="inv-info-label">Doctor</span>
                <span className="inv-info-value">
                  {doctorName}{qualification && `, ${qualification}`}
                </span>
              </div>
            )}
            {visit.diagnosis && (
              <div className="inv-info-row">
                <span className="inv-info-label">Diagnosis</span>
                <span className="inv-info-value">{visit.diagnosis}</span>
              </div>
            )}
          </div>

          <div className="inv-info-block inv-info-block--right">
            <div className="vinv-section-label" style={{ textAlign: 'right' }}>Invoice Details</div>
            <div className="inv-info-row">
              <span className="inv-info-label">Invoice #</span>
              <span className="inv-info-value vinv-mono">{invNum}</span>
            </div>
            <div className="inv-info-row">
              <span className="inv-info-label">Visit Date</span>
              <span className="inv-info-value">{fmtDate(visit.visited_at)}</span>
            </div>
            {visit.invoiced_at && (
              <div className="inv-info-row">
                <span className="inv-info-label">Invoiced</span>
                <span className="inv-info-value">{fmtDate(visit.invoiced_at)}</span>
              </div>
            )}
            <div className="inv-info-row">
              <span className="inv-info-label">Status</span>
              <span className={`vinv-badge vinv-badge--${isPaid ? 'paid' : 'open'}`}>
                {isPaid ? 'Paid' : 'Open'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Charges table ── */}
        <table className="inv-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>#</th>
              <th>Description</th>
              <th style={{ textAlign: 'right', width: '130px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <div className="inv-med-name">Consultation Fee</div>
                {doctorName && (
                  <div className="inv-med-detail">
                    {doctorName}{qualification && `, ${qualification}`}
                  </div>
                )}
              </td>
              <td className="inv-amount">₹{fmtPrice(consultFee)}</td>
            </tr>
            {charges.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 2}</td>
                <td><div className="inv-med-name">{c.description}</div></td>
                <td className="inv-amount">₹{fmtPrice(c.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Total block ── */}
        <div className="vinv-total-block">
          {gstPercent > 0 && (
            <>
              <div className="vinv-sub-row">
                <span>Sub-total</span>
                <span>₹{fmtPrice(subTotal)}</span>
              </div>
              <div className="vinv-sub-row">
                <span>GST ({gstPercent}%)</span>
                <span>₹{fmtPrice(gstAmount)}</span>
              </div>
            </>
          )}
          <div className="vinv-grand-row">
            <span>Total Amount</span>
            <span>₹{fmtPrice(grandTotal)}</span>
          </div>
          <div className="vinv-words-row">{amountInWords(grandTotal)}</div>
        </div>

        {/* ── Pharmacy note ── */}
        <div className="vinv-pharma-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Medicine charges are billed separately by the pharmacy.
        </div>

        {/* ── Signatures ── */}
        <div className="inv-footer">
          <div className="vinv-sig-wrap">
            <div className="vinv-sig-space" />
            <div className="vinv-sig-date">Date: _______________</div>
            <div className="vinv-sig-rule" />
            <div className="vinv-sig-label">Doctor / Authorized Signature</div>
          </div>
          <div className="vinv-sig-wrap">
            <div className="vinv-sig-space" />
            <div className="vinv-sig-date">Date: _______________</div>
            <div className="vinv-sig-rule" />
            <div className="vinv-sig-label">Patient / Receiver Signature</div>
          </div>
        </div>

        <div className="inv-note">
          This is a computer-generated invoice. Thank you for visiting {clinicName}.
        </div>
      </div>
    </div>
  )
}
