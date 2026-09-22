import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../styles/consent.css'

export default function ConsentScreen({ onAccepted }) {
  const [checked,  setChecked]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function handleAgree() {
    if (!checked || saving) return
    setSaving(true)
    try {
      await invoke('record_consent')
      onAccepted()
    } catch {
      setSaving(false)
    }
  }

  function handleExit() {
    invoke('exit_app').catch(() => window.close())
  }

  return (
    <div className="cs-overlay">
      <div className="cs-card">

        {/* Header */}
        <div className="cs-header">
          <img src="/logos/logo1.png" alt="Clinora" className="cs-logo" />
          <div className="cs-brand">
            <span className="cs-brand-name">Clinora</span>
            <span className="cs-brand-sub">Clinic Management System</span>
          </div>
          <span className="cs-badge">DPDP Compliant</span>
        </div>

        {/* Body */}
        <div className="cs-body">
          <p className="cs-intro">
            Before you continue, please read and accept our <strong>Terms &amp; Conditions</strong> and <strong>Privacy Policy</strong>.
            Clinora is committed to protecting personal data in compliance with the{' '}
            <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>, India.
          </p>

          {/* Scrollable legal content */}
          <div className="cs-legal-box">

            <p className="cs-section-title">Terms &amp; Conditions — v1.0</p>

            <p className="cs-legal-text">
              <strong>1. License &amp; Permitted Use</strong><br />
              Clinora is licensed for use solely by authorised medical professionals and clinic staff for the purpose of managing clinical records, patient visits, prescriptions, and pharmacy operations. Use for any other purpose is prohibited.
            </p>

            <p className="cs-legal-text">
              <strong>2. Your Responsibility as Data Fiduciary</strong><br />
              Under the DPDP Act 2023, the clinic using this software is the <em>Data Fiduciary</em>. You are responsible for:
            </p>
            <ul className="cs-legal-list">
              <li>Obtaining valid, informed consent from patients before recording their personal or health data.</li>
              <li>Honouring patients' rights to access, correct, or erase their records on request.</li>
              <li>Securing the device and database where Clinora is installed.</li>
              <li>Ensuring data is not shared with unauthorised persons.</li>
            </ul>

            <p className="cs-legal-text">
              <strong>3. No Medical Advice</strong><br />
              Clinora is a management tool and does not provide clinical diagnosis, treatment recommendations, or medical advice. All clinical decisions are the sole responsibility of the treating doctor.
            </p>

            <p className="cs-legal-text">
              <strong>4. Data Storage</strong><br />
              All patient and clinic data is stored locally on your clinic's own computer or server. Clinora does not upload, transmit, or back up your data to any external cloud server without your explicit action.
            </p>

            <p className="cs-legal-text">
              <strong>5. Limitation of Liability</strong><br />
              Clinora and its developers shall not be liable for any loss, damage, or legal consequence arising from misuse of the software, data loss due to hardware failure, or non-compliance with applicable laws by the clinic.
            </p>

            <p className="cs-legal-text">
              <strong>6. Modifications</strong><br />
              These Terms may be updated with new software versions. Continued use after an update constitutes acceptance of the revised Terms.
            </p>

            <p className="cs-legal-text">
              <strong>7. Governing Law</strong><br />
              These Terms are governed by the laws of India, including the DPDP Act 2023, the Information Technology Act 2000, and applicable medical data regulations.
            </p>

            <p className="cs-section-title">Privacy Policy — v1.0</p>

            <p className="cs-legal-text">
              <strong>What Data Clinora Processes</strong><br />
              Clinora processes the following categories of data on your behalf:
            </p>
            <ul className="cs-legal-list">
              <li><strong>Staff data:</strong> Name, email, phone, role, and login credentials of clinic users.</li>
              <li><strong>Patient data:</strong> Name, age, gender, contact details, medical history, visit records, prescriptions, and payment information.</li>
            </ul>

            <p className="cs-legal-text">
              <strong>Local Storage Only</strong><br />
              All data is stored exclusively on your clinic's device. Clinora does not maintain any remote copy of your data and does not have access to it.
            </p>

            <p className="cs-legal-text">
              <strong>No Third-Party Sharing</strong><br />
              Patient data is never sold, rented, or disclosed to any third party. The only exception is if legally required by a court order or competent authority under Indian law.
            </p>

            <p className="cs-legal-text">
              <strong>Data Principal Rights (DPDP Act 2023)</strong><br />
              Patients (Data Principals) have the right to request access to, correction of, or erasure of their personal data. The clinic (Data Fiduciary) is responsible for honouring these requests through the Clinora interface.
            </p>

            <p className="cs-legal-text">
              <strong>Grievance Officer</strong><br />
              For any data-related concerns, contact: <strong>gangardekishor87@gmail.com</strong>. We will respond within 30 days as required by the DPDP Act 2023.
            </p>

            <p className="cs-legal-text">
              <strong>Effective Date:</strong> 17 September 2026 &nbsp;|&nbsp; <strong>Version:</strong> 1.0
            </p>

          </div>

          <p className="cs-scroll-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            Scroll to read the full document
          </p>

          {/* Checkbox */}
          <label className="cs-agree-row">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
            />
            <span className="cs-agree-label">
              I have read and understood the Terms &amp; Conditions and Privacy Policy.
              I accept them on behalf of this clinic and agree to comply with the DPDP Act 2023.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="cs-footer">
          <button className="cs-btn-exit" onClick={handleExit}>
            Exit App
          </button>
          <button
            className="cs-btn-agree"
            onClick={handleAgree}
            disabled={!checked || saving}
          >
            {saving ? 'Saving…' : 'Agree & Continue →'}
          </button>
        </div>

      </div>
    </div>
  )
}
