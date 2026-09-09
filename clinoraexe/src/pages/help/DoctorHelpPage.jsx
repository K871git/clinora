import '../../styles/doctor-help.css'
import { useNavigate } from 'react-router-dom'

/* ── Icons ──────────────────────────────────────────────────────────────── */

function IconDash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconPatients() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconVisit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      <path d="M12 14v4m-2-2h4" />
    </svg>
  )
}

function IconRx() {
  return (
    <svg width="20" height="20" viewBox="0 0 52 52" fill="none" stroke="currentColor"
      strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 8 v36" /><path d="M10 8 h16 a13 13 0 0 1 0 22 H10" /><path d="M26 30 L44 46" />
    </svg>
  )
}

function IconPill() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3" />
      <circle cx="18" cy="18" r="3" /><path d="m22 22-1.5-1.5" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/* ── Help section card ───────────────────────────────────────────────────── */

function HelpSection({ icon, title, accent, children }) {
  const colors = {
    teal:   { border: '#0d9488', bg: 'rgba(13,148,136,0.08)',  icon: '#0d9488' },
    blue:   { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: '#2563eb' },
    indigo: { border: '#6366f1', bg: 'rgba(99,102,241,0.08)',  icon: '#4f46e5' },
    green:  { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '#15803d' },
    amber:  { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: '#d97706' },
    slate:  { border: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: '#475569' },
  }
  const c = colors[accent] ?? colors.teal

  return (
    <div className="dhlp-section card" style={{ borderLeft: `3px solid ${c.border}` }}>
      <div className="dhlp-section-hdr" style={{ color: c.icon }}>
        <span className="dhlp-section-icon" style={{ background: c.bg }}>{icon}</span>
        <h2 className="dhlp-section-title">{title}</h2>
      </div>
      <div className="dhlp-section-body">{children}</div>
    </div>
  )
}

function Step({ n, text, note }) {
  return (
    <div className="dhlp-step">
      <span className="dhlp-step-num">{n}</span>
      <div>
        <span className="dhlp-step-text">{text}</span>
        {note && <span className="dhlp-step-note"> — {note}</span>}
      </div>
    </div>
  )
}

function Tip({ children }) {
  return <p className="dhlp-tip">{children}</p>
}

function InfoRow({ label, desc }) {
  return (
    <div className="dhlp-info-item">
      <strong>{label}</strong>
      <span>{desc}</span>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function DoctorHelpPage() {
  const navigate = useNavigate()

  return (
    <div className="dhlp-page">

      {/* Header */}
      <div className="dhlp-hdr">
        <div>
          <h2 className="dhlp-hdr-title">How to Use</h2>
          <p className="dhlp-hdr-sub">Doctor module guide</p>
        </div>
        <button className="btn-secondary dhlp-back-btn" onClick={() => navigate('/')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      <div className="dhlp-grid">

        {/* Section 1: Dashboard */}
        <HelpSection icon={<IconDash />} title="Dashboard" accent="teal">
          <p className="dhlp-desc">
            The Dashboard is your home screen. It shows today's activity at a glance so you know
            what's happening the moment you open the app.
          </p>
          <InfoRow label="Today's stats" desc="Total visits, new patients, and prescriptions written today." />
          <InfoRow label="Recent activity" desc="The last few patients you saw, with the time of their visit." />
          <InfoRow label="Quick actions" desc="Buttons to add a new patient or go to the prescription list fast." />
          <Tip>The dashboard updates automatically. No need to refresh the page.</Tip>
        </HelpSection>

        {/* Section 2: Patients */}
        <HelpSection icon={<IconPatients />} title="Patients" accent="blue">
          <p className="dhlp-desc">
            The Patients list is your complete patient registry. All records are stored locally on the clinic PC.
          </p>
          <Step n={1} text="Open Patients from the sidebar" />
          <Step n={2} text='Press "New Patient" and fill in name, age, gender, and contact' />
          <Step n={3} text="Use the search bar to find an existing patient by name or phone" />
          <Step n={4} text="Tap a patient to open their full profile and history" />
          <Tip>Patient records include every visit, diagnosis, and prescription — all in one place.</Tip>
        </HelpSection>

        {/* Section 3: Visits */}
        <HelpSection icon={<IconVisit />} title="Recording a Visit" accent="indigo">
          <p className="dhlp-desc">
            A visit captures everything from a single consultation — vitals, notes, diagnosis, and fee.
          </p>
          <Step n={1} text="Open a patient from the Patients list" />
          <Step n={2} text='Press "New Visit" on their profile page' />
          <Step n={3} text="Fill in vitals (BP, weight, temperature) if needed" />
          <Step n={4} text="Add your consultation notes and diagnosis" />
          <Step n={5} text="Set the consultation fee and save the visit" />
          <Tip>After saving, you can immediately write a prescription for that visit.</Tip>
        </HelpSection>

        {/* Section 4: Prescriptions */}
        <HelpSection icon={<IconRx />} title="Prescriptions" accent="green">
          <p className="dhlp-desc">
            Write and send prescriptions directly from a visit. They are delivered to the pharmacist automatically.
          </p>
          <Step n={1} text="Open a saved visit and press 'New Prescription'"/>
          <Step n={2} text="Add medicines from your library" note="type to search by name" />
          <Step n={3} text="Set dosage, frequency, and duration for each medicine" />
          <Step n={4} text="Add notes for the pharmacist if needed" />
          <Step n={5} text="Press Save — the prescription appears in the pharmacy queue instantly" />
          <Tip>Use the Prescriptions page in the sidebar to browse and search all past prescriptions.</Tip>
        </HelpSection>

        {/* Section 5: Medicine Library */}
        <HelpSection icon={<IconPill />} title="Medicine Library" accent="amber">
          <p className="dhlp-desc">
            The library holds all the medicines that appear when you write a prescription.
            Keep it up to date so you can find medicines quickly.
          </p>
          <Step n={1} text='Open "Medicines" from the sidebar' />
          <Step n={2} text='Press "Add Medicine" and enter the name, category, and unit' />
          <Step n={3} text="Use the search bar to find and edit an existing entry" />
          <Step n={4} text="Tap the edit icon on any medicine to update its details" />
          <Tip>You can import medicines in bulk from an Excel file using the Import button.</Tip>
        </HelpSection>

        {/* Section 6: Settings */}
        <HelpSection icon={<IconSettings />} title="Settings" accent="slate">
          <p className="dhlp-desc">
            Configure your doctor details, clinic information, and how prescriptions are printed.
          </p>
          <InfoRow label="Clinic & Doctor Info" desc="Your name, specialization, phone, clinic name and address — shown on printed prescriptions." />
          <InfoRow label="Show doctor contact" desc="Toggle whether your phone number appears on the prescription printout." />
          <InfoRow label="Show clinic contact" desc="Toggle whether the clinic phone number appears on the prescription printout." />
          <Tip>Changes to settings take effect on the next prescription you print.</Tip>
        </HelpSection>

      </div>

      {/* Footer credit */}
      <div className="dhlp-footer">
        <span className="dhlp-footer-text">Clinora · Doctor Module · Offline LAN edition</span>
        <span className="dhlp-footer-sep">·</span>
        <span className="dhlp-footer-built">
          Built by{' '}
          <a
            className="dhlp-footer-link"
            href="https://k871git.github.io/thaelon"
            target="_blank"
            rel="noopener noreferrer"
          >
            Thaelon
          </a>
        </span>
      </div>

    </div>
  )
}
