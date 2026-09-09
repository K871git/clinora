import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPatient, getPatientVisits, getPatientPrescriptions } from '../../services/patientService'
import PatientFormModal from './PatientFormModal'
import Spinner from '../../components/ui/Spinner'
import PageLoader from '../../components/ui/PageLoader'
import '../../styles/patients.css'

/* ─── Constants ─────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
]

function avatarColor(name) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

const RX_STATUS_LABEL = {
  draft:            'Draft',
  sent_to_pharmacy: 'Sent to Pharmacy',
  completed:        'Completed',
}

const RX_DOT_COLOR = {
  draft:            'var(--clr-info)',
  sent_to_pharmacy: 'var(--clr-warning)',
  completed:        'var(--clr-success)',
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtShortDate(str) {
  if (!str) return 'Never'
  return new Date(str).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '—'
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function PatientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [patient, setPatient]           = useState(null)
  const [visits, setVisits]             = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [visitsMeta, setVisitsMeta]     = useState(null)
  const [rxMeta, setRxMeta]             = useState(null)

  const [pageStatus, setPageStatus]       = useState('loading')
  const [historyStatus, setHistoryStatus] = useState('loading')
  const [rxPage, setRxPage]               = useState(1)
  const [rxLoadingMore, setRxLoadingMore] = useState(false)
  const [showEdit, setShowEdit]           = useState(false)

  useEffect(() => {
    let cancelled = false
    getPatient(id)
      .then(({ data }) => {
        if (!cancelled) { setPatient(data.data); setPageStatus('done') }
      })
      .catch((err) => {
        if (!cancelled) setPageStatus(err.response?.status === 404 ? 'not-found' : 'error')
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (pageStatus !== 'done') return
    let cancelled = false
    Promise.all([getPatientVisits(id), getPatientPrescriptions(id)])
      .then(([vRes, rxRes]) => {
        if (!cancelled) {
          setVisits(vRes.data.data ?? [])
          setVisitsMeta(vRes.data.meta ?? null)
          setPrescriptions(rxRes.data.data ?? [])
          setRxMeta(rxRes.data.meta ?? null)
          setHistoryStatus('done')
        }
      })
      .catch(() => { if (!cancelled) setHistoryStatus('error') })
    return () => { cancelled = true }
  }, [id, pageStatus])

  /* ── Load more prescriptions ────────────────────────────────────────── */

  async function loadMoreRx() {
    setRxLoadingMore(true)
    try {
      const res = await getPatientPrescriptions(id, { page: rxPage + 1 })
      setPrescriptions(prev => [...prev, ...(res.data.data ?? [])])
      setRxMeta(res.data.meta ?? null)
      setRxPage(p => p + 1)
    } catch {
      // silently ignore — user can retry
    } finally {
      setRxLoadingMore(false)
    }
  }

  /* ── Loading / error screens ────────────────────────────────────────── */

  if (pageStatus === 'loading') return <PageLoader />

  if (pageStatus === 'not-found') {
    return (
      <div>
        <button className="pd-back" onClick={() => navigate('/patients')}>← Patients</button>
        <div className="card state-panel">Patient not found.</div>
      </div>
    )
  }

  if (pageStatus === 'error') {
    return (
      <div>
        <button className="pd-back" onClick={() => navigate('/patients')}>← Patients</button>
        <div className="card state-panel">Could not load patient — check your connection.</div>
      </div>
    )
  }

  /* ── Computed values ────────────────────────────────────────────────── */

  const totalVisits = visitsMeta?.total ?? visits.length
  const totalRx     = rxMeta?.total ?? prescriptions.length
  const lastVisit   = visits[0]?.visited_at ?? null

  const heroTags = [
    patient.age   != null && `${patient.age} yrs`,
    patient.gender        && capitalize(patient.gender),
    patient.date_of_birth && fmtDate(patient.date_of_birth),
  ].filter(Boolean)

  const hasDemographics =
    patient.date_of_birth || patient.age != null || patient.gender || patient.address

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div>
      <button className="pd-back" onClick={() => navigate('/patients')}>← Patients</button>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="pd-hero">
        <div
          className="pd-hero-avatar"
          style={{ backgroundColor: avatarColor(patient.name) }}
          aria-hidden="true"
        >
          {patient.name[0].toUpperCase()}
        </div>

        <div className="pd-hero-info">
          <h1 className="pd-hero-name">{patient.name}</h1>
          <div className="pd-hero-contact">{patient.mobile ?? 'No contact on file'}</div>
          {heroTags.length > 0 && (
            <div className="pd-hero-tags">
              {heroTags.map((tag) => (
                <span key={tag} className="pd-hero-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="pd-hero-actions">
          <button className="btn-secondary" onClick={() => setShowEdit(true)}>Edit</button>
          <button
            className="btn-primary pd-visit-btn"
            onClick={() => navigate(`/patients/${id}/visits/new`)}
          >
            + Start Visit
          </button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="pd-stats">
        <div className="pd-stat">
          <div className="pd-stat-value">
            {historyStatus === 'loading' ? '—' : totalVisits}
          </div>
          <div className="pd-stat-label">Visits</div>
        </div>
        <div className="pd-stat">
          <div className="pd-stat-value">
            {historyStatus === 'loading' ? '—' : totalRx}
          </div>
          <div className="pd-stat-label">Prescriptions</div>
        </div>
        <div className="pd-stat">
          <div className={`pd-stat-value ${totalVisits > 0 ? 'pd-stat-value--sm' : ''}`}>
            {historyStatus === 'loading' ? '—' : fmtShortDate(lastVisit)}
          </div>
          <div className="pd-stat-label">Last Visit</div>
        </div>
      </div>

      {/* ── Demographics ─────────────────────────────────────────────── */}
      {hasDemographics && (
        <div className="card pd-meta-section">
          <div className="pd-meta-grid">
            {patient.date_of_birth && (
              <MetaItem label="Date of Birth" value={fmtDate(patient.date_of_birth)} />
            )}
            {patient.age != null && (
              <MetaItem label="Age" value={`${patient.age} years`} />
            )}
            {patient.gender && (
              <MetaItem label="Gender" value={capitalize(patient.gender)} />
            )}
            {patient.mobile && (
              <MetaItem label="Contact" value={patient.mobile} />
            )}
            {patient.address && (
              <MetaItem label="Address" value={patient.address} />
            )}
          </div>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      <div className="pd-history">

        {/* Visit history */}
        <div className="card pd-history-panel">
          <h3 className="pd-history-title">Visit History</h3>

          {historyStatus === 'loading' && (
            <div className="pd-history-empty">Loading…</div>
          )}
          {historyStatus === 'error' && (
            <div className="pd-history-empty">Could not load visits.</div>
          )}
          {historyStatus === 'done' && visits.length === 0 && (
            <div className="pd-history-empty">No visits recorded yet.</div>
          )}
          {historyStatus === 'done' && visits.length > 0 && (
            <ul className="pd-history-list">
              {visits.map((v) => (
                <li
                  key={v.id}
                  className="pd-history-item"
                  onClick={() => navigate(`/visits/${v.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/visits/${v.id}`)}
                >
                  <div className="pd-history-dot" style={{ backgroundColor: 'var(--clr-primary)' }} />
                  <div className="pd-history-body">
                    <div className="pd-history-date">{fmtDate(v.visited_at)}</div>
                    {v.consultation_notes && (
                      <div className="pd-history-sub">{v.consultation_notes}</div>
                    )}
                  </div>
                  <div className="pd-history-right">
                    {v.consultation_fee > 0 && (
                      <span className="pd-fee-tag">
                        Rs.{' '}{Number(v.consultation_fee).toLocaleString()}
                      </span>
                    )}
                    <span className="pd-arrow" aria-hidden="true">→</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Prescription history */}
        <div className="card pd-history-panel">
          <h3 className="pd-history-title">Prescriptions</h3>

          {historyStatus === 'loading' && (
            <div className="pd-history-empty">Loading…</div>
          )}
          {historyStatus === 'error' && (
            <div className="pd-history-empty">Could not load prescriptions.</div>
          )}
          {historyStatus === 'done' && prescriptions.length === 0 && (
            <div className="pd-history-empty">No prescriptions issued yet.</div>
          )}
          {historyStatus === 'done' && prescriptions.length > 0 && (
            <>
              <ul className="pd-history-list">
                {prescriptions.map((rx) => (
                  <li
                    key={rx.id}
                    className="pd-history-item"
                    onClick={() => navigate(`/prescriptions/${rx.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/prescriptions/${rx.id}`)}
                  >
                    <div
                      className="pd-history-dot"
                      style={{ backgroundColor: RX_DOT_COLOR[rx.status] ?? 'var(--clr-text-muted)' }}
                    />
                    <div className="pd-history-body">
                      <div className="pd-history-date">{fmtDate(rx.prescribed_at)}</div>
                      {rx.items?.length > 0 && (
                        <div className="pd-history-sub">
                          {rx.items.length} item{rx.items.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="pd-history-right">
                      <span className={`status-badge ${rx.status}`}>
                        {RX_STATUS_LABEL[rx.status] ?? rx.status}
                      </span>
                      <span className="pd-arrow" aria-hidden="true">→</span>
                    </div>
                  </li>
                ))}
              </ul>
              {rxMeta && rxPage < rxMeta.last_page && (
                <button
                  className="btn-link"
                  style={{ marginTop: 'var(--space-sm)', fontSize: '13px', display: 'block' }}
                  onClick={loadMoreRx}
                  disabled={rxLoadingMore}
                >
                  {rxLoadingMore ? 'Loading…' : `Load more (${rxMeta.total - prescriptions.length} more)`}
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* ── Edit modal ───────────────────────────────────────────────── */}
      {showEdit && (
        <PatientFormModal
          patient={patient}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setPatient(updated); setShowEdit(false) }}
        />
      )}
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function MetaItem({ label, value }) {
  return (
    <div className="pd-meta-item">
      <span className="pd-meta-label">{label}</span>
      <span className="pd-meta-value">{value}</span>
    </div>
  )
}
