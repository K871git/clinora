import '../../../styles/pharmacy-help.css'
import { useNavigate } from 'react-router-dom'

/* ── Icon components ─────────────────────────────────────────────────── */

function IconRx() {
  return (
    <svg width="20" height="20" viewBox="0 0 52 52" fill="none" stroke="currentColor"
      strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 8 v36" /><path d="M10 8 h16 a13 13 0 0 1 0 22 H10" /><path d="M26 30 L44 46" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l3.5 2" />
    </svg>
  )
}

/* ── Help section card ───────────────────────────────────────────────── */

function HelpSection({ icon, title, accent, children }) {
  const colors = {
    teal:   { border: '#0d9488', bg: 'rgba(13,148,136,0.08)',  icon: '#0d9488' },
    amber:  { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: '#d97706' },
    green:  { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '#15803d' },
    indigo: { border: '#6366f1', bg: 'rgba(99,102,241,0.08)',  icon: '#4f46e5' },
    red:    { border: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '#dc2626' },
    blue:   { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: '#2563eb' },
  }
  const c = colors[accent] ?? colors.teal

  return (
    <div className="pharma-help-section card" style={{ borderLeft: `3px solid ${c.border}` }}>
      <div className="pharma-help-section-hdr" style={{ color: c.icon }}>
        <span className="pharma-help-section-icon" style={{ background: c.bg }}>{icon}</span>
        <h2 className="pharma-help-section-title">{title}</h2>
      </div>
      <div className="pharma-help-section-body">{children}</div>
    </div>
  )
}

function Step({ n, text, note }) {
  return (
    <div className="pharma-help-step">
      <span className="pharma-help-step-num">{n}</span>
      <div>
        <span className="pharma-help-step-text">{text}</span>
        {note && <span className="pharma-help-step-note"> — {note}</span>}
      </div>
    </div>
  )
}

function Tip({ children }) {
  return <p className="pharma-help-tip">{children}</p>
}

function StatusBadge({ label, color }) {
  const map = {
    pending:    { bg: 'rgba(245,158,11,0.12)',  color: '#b45309', border: 'rgba(245,158,11,0.3)'  },
    dispensing: { bg: 'rgba(34,197,94,0.12)',   color: '#15803d', border: 'rgba(34,197,94,0.3)'   },
    done:       { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5', border: 'rgba(99,102,241,0.3)'  },
  }
  const s = map[color] ?? map.pending
  return (
    <span className="pharma-help-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {label}
    </span>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function PharmacyHelpPage() {
  const navigate = useNavigate()

  return (
    <div className="pharma-page pharma-help-page">

      {/* Header */}
      <div className="pharma-page-hdr">
        <div>
          <h2 className="pharma-page-hdr-title">How to Use</h2>
          <p className="pharma-page-hdr-sub">Pharmacy module guide</p>
        </div>
        <button className="btn-secondary pharma-refresh-btn" onClick={() => navigate('/pharmacy')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Queue
        </button>
      </div>

      <div className="pharma-help-grid">

        {/* ── Section 1: Queue ─────────────────────────────────────────── */}
        <HelpSection icon={<IconRx />} title="Prescription Queue" accent="teal">
          <p className="pharma-help-desc">
            The Queue is your main workspace. Prescriptions sent by the doctor arrive here automatically.
            You never need to enter them manually.
          </p>
          <Step n={1} text="Open the Queue page" note="it loads automatically on login" />
          <Step n={2} text="Find a Pending prescription and tap it to open the details" />
          <Step n={3} text='Press "Start Dispensing" to claim it' note="status changes to Dispensing" />
          <Step n={4} text='Prepare the medicines, then press "Mark as Done"' note="removes from queue" />

          <div className="pharma-help-status-row">
            <StatusBadge label="Pending"    color="pending" />
            <span className="pharma-help-arrow">→</span>
            <StatusBadge label="Dispensing" color="dispensing" />
            <span className="pharma-help-arrow">→</span>
            <StatusBadge label="Done"       color="done" />
          </div>
        </HelpSection>

        {/* ── Section 2: Stats ─────────────────────────────────────────── */}
        <HelpSection icon={<IconActivity />} title="Dashboard Stats" accent="indigo">
          <p className="pharma-help-desc">
            The four stat cards at the top of the Queue page give you a live snapshot.
          </p>
          <div className="pharma-help-stat-list">
            <div className="pharma-help-stat-item">
              <strong>Total Active</strong>
              <span>Pending + Dispensing combined. Your current workload.</span>
            </div>
            <div className="pharma-help-stat-item">
              <strong>Pending</strong>
              <span>Waiting to be picked up and dispensed.</span>
            </div>
            <div className="pharma-help-stat-item">
              <strong>Dispensing</strong>
              <span>Actively being prepared right now.</span>
            </div>
            <div className="pharma-help-stat-item">
              <strong>Done Today</strong>
              <span>Total prescriptions completed since midnight.</span>
            </div>
          </div>
          <Tip>Stats update every 30 seconds automatically, or tap the Sync button to refresh immediately.</Tip>
        </HelpSection>

        {/* ── Section 3: Search ────────────────────────────────────────── */}
        <HelpSection icon={<IconSearch />} title="Search" accent="blue">
          <p className="pharma-help-desc">
            Both the Queue and History pages have a search bar.
          </p>
          <div className="pharma-help-stat-list">
            <div className="pharma-help-stat-item">
              <strong>Queue search</strong>
              <span>Filters by patient name, doctor name, or medicine name. Results update as you type.</span>
            </div>
            <div className="pharma-help-stat-item">
              <strong>History search</strong>
              <span>Searches all completed records on the server. Results appear after a short pause.</span>
            </div>
          </div>
          <Tip>Clear the search box to return to the full list.</Tip>
        </HelpSection>

        {/* ── Section 4: History ───────────────────────────────────────── */}
        <HelpSection icon={<IconHistory />} title="Dispensed History" accent="green">
          <p className="pharma-help-desc">
            History shows all prescriptions that have been completed. Records are grouped by date.
          </p>
          <Step n={1} text='Tap "History" in the sidebar' />
          <Step n={2} text="Browse Today, Yesterday, and Older groups" />
          <Step n={3} text="Use the search bar to find a specific patient" />
          <Step n={4} text="Tap any card to view full prescription details" />
          <Tip>History shows the most recent 50 records. Use search to find older ones.</Tip>
        </HelpSection>

        {/* ── Section 5: Urgent alerts ─────────────────────────────────── */}
        <HelpSection icon={<IconAlert />} title="Urgent Prescriptions" accent="red">
          <p className="pharma-help-desc">
            A prescription is marked urgent if it has been waiting for more than 30 minutes without being picked up.
          </p>
          <div className="pharma-help-stat-list">
            <div className="pharma-help-stat-item">
              <strong>Red border on the card</strong>
              <span>Indicates a prescription that has been waiting too long.</span>
            </div>
            <div className="pharma-help-stat-item">
              <strong>Red time label</strong>
              <span>Shows exactly how long ago the prescription arrived.</span>
            </div>
          </div>
          <Tip>Always prioritize urgent prescriptions to keep wait times low for patients.</Tip>
        </HelpSection>

        {/* ── Section 6: Sync & refresh ────────────────────────────────── */}
        <HelpSection icon={<IconRefresh />} title="Auto-Sync" accent="amber">
          <p className="pharma-help-desc">
            The Queue and Stats refresh automatically every 30 seconds. History refreshes every 2 minutes.
            You do not need to reload the page.
          </p>
          <div className="pharma-help-stat-list">
            <div className="pharma-help-stat-item">
              <strong>Sync button</strong>
              <span>Tap it to force an immediate refresh. The button label shows the last sync time.</span>
            </div>
            <div className="pharma-help-stat-item">
              <strong>Offline use</strong>
              <span>This application runs entirely on your clinic's local network. No internet required.</span>
            </div>
          </div>
          <Tip>If new prescriptions are not appearing, check your network connection to the clinic server.</Tip>
        </HelpSection>

      </div>

      <p className="pharma-help-footer">
        Clinora Pharmacy Module · Offline LAN edition
      </p>
    </div>
  )
}
