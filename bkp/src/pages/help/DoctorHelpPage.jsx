import '../../styles/doctor-help.css'
import { useNavigate } from 'react-router-dom'

/* ── Icons ──────────────────────────────────────────────────────────────── */

function IconDash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconPatients() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconVisit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      <path d="M12 14v4m-2-2h4" />
    </svg>
  )
}
function IconRx() {
  return (
    <svg width="20" height="20" viewBox="0 0 52 52" fill="none" stroke="currentColor"
      strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 8 v36" /><path d="M10 8 h16 a13 13 0 0 1 0 22 H10" /><path d="M26 30 L44 46" />
    </svg>
  )
}
function IconPill() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3" />
      <circle cx="18" cy="18" r="3" /><path d="m22 22-1.5-1.5" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconBulb() {
  return (
    <svg className="dhlp-tip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  )
}

/* ── Palette ─────────────────────────────────────────────────────────────── */

const ACCENT = {
  teal:   { band: 'linear-gradient(90deg,#0d9488,#2dd4bf)', icon: '#0d9488', iconBg: 'rgba(13,148,136,0.1)',  num: '#0d9488', numBg: 'rgba(13,148,136,0.12)',  dot: '#0d9488' },
  blue:   { band: 'linear-gradient(90deg,#3b82f6,#60a5fa)', icon: '#2563eb', iconBg: 'rgba(59,130,246,0.1)',  num: '#2563eb', numBg: 'rgba(59,130,246,0.12)',  dot: '#3b82f6' },
  indigo: { band: 'linear-gradient(90deg,#6366f1,#a5b4fc)', icon: '#4f46e5', iconBg: 'rgba(99,102,241,0.1)',  num: '#4f46e5', numBg: 'rgba(99,102,241,0.12)',  dot: '#6366f1' },
  green:  { band: 'linear-gradient(90deg,#22c55e,#86efac)', icon: '#16a34a', iconBg: 'rgba(34,197,94,0.1)',   num: '#15803d', numBg: 'rgba(34,197,94,0.12)',   dot: '#22c55e' },
  amber:  { band: 'linear-gradient(90deg,#f59e0b,#fcd34d)', icon: '#d97706', iconBg: 'rgba(245,158,11,0.1)',  num: '#b45309', numBg: 'rgba(245,158,11,0.12)',  dot: '#f59e0b' },
  slate:  { band: 'linear-gradient(90deg,#64748b,#94a3b8)', icon: '#475569', iconBg: 'rgba(100,116,139,0.1)', num: '#334155', numBg: 'rgba(100,116,139,0.12)', dot: '#64748b' },
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function HelpSection({ icon, title, accent, children }) {
  const c = ACCENT[accent] ?? ACCENT.teal
  return (
    <div className="dhlp-section">
      <div className="dhlp-section-band" style={{ background: c.band }} />
      <div className="dhlp-section-hdr">
        <span className="dhlp-section-icon" style={{ background: c.iconBg, color: c.icon }}>
          {icon}
        </span>
        <h2 className="dhlp-section-title">{title}</h2>
      </div>
      <div className="dhlp-section-body">{children}</div>
    </div>
  )
}

function Steps({ children }) {
  return <div className="dhlp-steps">{children}</div>
}

function Step({ n, text, note, accent = 'teal' }) {
  const c = ACCENT[accent] ?? ACCENT.teal
  return (
    <div className="dhlp-step">
      <span className="dhlp-step-num" style={{ background: c.numBg, color: c.num }}>
        {n}
      </span>
      <div className="dhlp-step-content">
        <span className="dhlp-step-text">{text}</span>
        {note && <span className="dhlp-step-note">{note}</span>}
      </div>
    </div>
  )
}

function Tip({ children }) {
  return (
    <div className="dhlp-tip">
      <IconBulb />
      <span>{children}</span>
    </div>
  )
}

function InfoRows({ children }) {
  return <div className="dhlp-info-rows">{children}</div>
}

function InfoRow({ label, desc, accent = 'teal' }) {
  const c = ACCENT[accent] ?? ACCENT.teal
  return (
    <div className="dhlp-info-item">
      <span className="dhlp-info-dot" style={{ background: c.dot }} />
      <div className="dhlp-info-content">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
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
          <p className="dhlp-hdr-eyebrow">Doctor Module</p>
          <h1 className="dhlp-hdr-title">How to Use Clinora</h1>
          <p className="dhlp-hdr-sub">Step-by-step guide to every feature in the doctor module.</p>
        </div>
        <button className="dhlp-back-btn" onClick={() => navigate('/')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      <div className="dhlp-grid">

        {/* Dashboard */}
        <HelpSection icon={<IconDash />} title="Dashboard" accent="teal">
          <p className="dhlp-desc">
            Your home screen. Shows everything happening today the moment you open the app — no need to dig through menus.
          </p>
          <InfoRows>
            <InfoRow accent="teal" label="Today's stats" desc="Total visits, new patients, and prescriptions written today." />
            <InfoRow accent="teal" label="Recent activity" desc="The last few patients you saw, with the time of their visit." />
            <InfoRow accent="teal" label="Quick actions" desc="Jump to add a new patient or open the prescription list instantly." />
          </InfoRows>
          <Tip>The dashboard refreshes automatically — no need to reload.</Tip>
        </HelpSection>

        {/* Patients */}
        <HelpSection icon={<IconPatients />} title="Patients" accent="blue">
          <p className="dhlp-desc">
            Your complete patient registry. All records are stored locally on your clinic PC — private and offline.
          </p>
          <Steps>
            <Step accent="blue" n={1} text="Open Patients from the sidebar" />
            <Step accent="blue" n={2} text='Press "New Patient"' note="Fill in name, age, gender, and contact number" />
            <Step accent="blue" n={3} text="Search by name or phone to find an existing patient" />
            <Step accent="blue" n={4} text="Tap any patient to open their full profile and history" />
          </Steps>
          <Tip>Every visit, diagnosis, and prescription lives on the patient's profile — all in one place.</Tip>
        </HelpSection>

        {/* Recording a Visit */}
        <HelpSection icon={<IconVisit />} title="Recording a Visit" accent="indigo">
          <p className="dhlp-desc">
            A visit captures everything from one consultation — vitals, notes, diagnosis, and fee.
          </p>
          <Steps>
            <Step accent="indigo" n={1} text="Open a patient from the Patients list" />
            <Step accent="indigo" n={2} text='Press "New Visit" on their profile page' />
            <Step accent="indigo" n={3} text="Fill in vitals" note="BP, weight, temperature, SpO₂ — all optional" />
            <Step accent="indigo" n={4} text="Add your consultation notes and diagnosis" />
            <Step accent="indigo" n={5} text="Set the consultation fee and save" />
          </Steps>
          <Tip>Once saved, you can immediately write a prescription for that visit.</Tip>
        </HelpSection>

        {/* Prescriptions */}
        <HelpSection icon={<IconRx />} title="Prescriptions" accent="green">
          <p className="dhlp-desc">
            Write and send prescriptions directly from a visit. They reach the pharmacist's queue automatically.
          </p>
          <Steps>
            <Step accent="green" n={1} text="Open a saved visit and press 'New Prescription'" />
            <Step accent="green" n={2} text="Search and add medicines from your library" note="Type to search by name" />
            <Step accent="green" n={3} text="Set dosage, frequency, and duration for each medicine" />
            <Step accent="green" n={4} text="Add pharmacist notes if needed" />
            <Step accent="green" n={5} text="Press Save — appears in the pharmacy queue instantly" />
          </Steps>
          <Tip>Use the Prescriptions page in the sidebar to browse and search all past prescriptions.</Tip>
        </HelpSection>

        {/* Medicine Library */}
        <HelpSection icon={<IconPill />} title="Medicine Library" accent="amber">
          <p className="dhlp-desc">
            Manage the medicines that appear when writing a prescription. Keep it updated for fast searching.
          </p>
          <Steps>
            <Step accent="amber" n={1} text='Open "Medicines" from the sidebar' />
            <Step accent="amber" n={2} text='Press "Add Medicine"' note="Enter name, category, and unit" />
            <Step accent="amber" n={3} text="Use the search bar to find and edit an existing entry" />
            <Step accent="amber" n={4} text="Tap the edit icon on any row to update its details" />
          </Steps>
          <Tip>Import medicines in bulk from an Excel file using the Import button — saves hours of manual entry.</Tip>
        </HelpSection>

        {/* Settings */}
        <HelpSection icon={<IconSettings />} title="Settings" accent="slate">
          <p className="dhlp-desc">
            Configure doctor details, clinic info, and prescription print options. Changes apply on the next print.
          </p>
          <InfoRows>
            <InfoRow accent="slate" label="Clinic & Doctor Info" desc="Name, specialization, phone, and clinic address — shown on every printed prescription." />
            <InfoRow accent="slate" label="Show doctor contact" desc="Toggle whether your phone number appears on the prescription printout." />
            <InfoRow accent="slate" label="Show clinic contact" desc="Toggle whether the clinic phone appears on the prescription printout." />
            <InfoRow accent="slate" label="Prescription template" desc="Upload a PDF or image to use as the prescription background." />
          </InfoRows>
          <Tip>Header and footer banners can be added for clinics that don't use a pre-printed letterhead.</Tip>
        </HelpSection>

      </div>

      {/* Footer */}
      <div className="dhlp-footer">
        <span className="dhlp-footer-text">Clinora · Doctor Module · Offline LAN edition</span>
        <span className="dhlp-footer-sep">·</span>
        <span className="dhlp-footer-built">
          Built by{' '}
          <a className="dhlp-footer-link" href="https://k871git.github.io/thaelon"
            target="_blank" rel="noopener noreferrer">
            Thaelon
          </a>
        </span>
      </div>

    </div>
  )
}
