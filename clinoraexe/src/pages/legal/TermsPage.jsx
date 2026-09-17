import { useNavigate } from 'react-router-dom'
import '../../styles/consent.css'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="legal-page">
      <button className="legal-back-btn" onClick={() => navigate(-1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

      <span className="legal-badge">DPDP Act 2023 · v1.0</span>
      <h1 className="legal-title">Terms &amp; Conditions</h1>
      <p className="legal-meta">Effective: 17 September 2026 &nbsp;·&nbsp; Applies to Clinora Clinic Management System</p>

      <div className="legal-section">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By installing, launching, or using Clinora ("the Software"), you ("the Clinic", "the User") agree to be bound by these Terms &amp; Conditions. If you do not agree, you must not use the Software.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and the Clinora development team, governed by the laws of India.
        </p>
      </div>

      <div className="legal-section">
        <h2>2. License</h2>
        <p>
          Clinora grants you a non-exclusive, non-transferable, limited license to install and use the Software solely for the purpose of managing your registered medical clinic's operations — including patient records, consultations, prescriptions, and pharmacy dispensing.
        </p>
        <ul>
          <li>You may not copy, distribute, sell, sub-license, or re-brand the Software.</li>
          <li>You may not reverse-engineer, decompile, or modify the Software.</li>
          <li>This license is valid for one clinic installation. Multi-location use requires a separate license.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>3. Your Obligations Under the DPDP Act 2023</h2>
        <p>
          As the entity that collects and uses patient data through this Software, you are the <strong>Data Fiduciary</strong> as defined by the Digital Personal Data Protection (DPDP) Act 2023. Your obligations include:
        </p>
        <ul>
          <li>
            <strong>Patient Consent:</strong> Obtain free, specific, informed, and unambiguous consent from patients (or their guardians) before recording their personal data. This consent must be documented by the clinic.
          </li>
          <li>
            <strong>Purpose Limitation:</strong> Use patient data only for providing medical care and clinic management. Do not use it for marketing, research, or any other purpose without separate explicit consent.
          </li>
          <li>
            <strong>Data Accuracy:</strong> Ensure patient records are accurate and up to date.
          </li>
          <li>
            <strong>Data Security:</strong> Protect the device, database credentials, and login accounts associated with Clinora. Immediately change passwords if a breach is suspected.
          </li>
          <li>
            <strong>Honour Data Principal Rights:</strong> On request, provide patients with access to their records, correct inaccurate data, or erase data where legally permissible.
          </li>
          <li>
            <strong>Breach Notification:</strong> In the event of a data breach, notify the Data Protection Board of India and affected patients as required by the DPDP Act 2023.
          </li>
        </ul>
        <div className="legal-highlight">
          Clinora provides the tools to help you comply. The legal responsibility rests with the clinic as the Data Fiduciary.
        </div>
      </div>

      <div className="legal-section">
        <h2>4. No Medical Advice</h2>
        <p>
          Clinora is a clinic management and record-keeping tool. It does not provide clinical diagnosis, treatment recommendations, drug interaction alerts, or any form of medical advice.
        </p>
        <p>
          All clinical decisions are the sole responsibility of the treating doctor. Clinora shall not be held liable for any medical outcome resulting from information stored or displayed by the Software.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. Data Ownership</h2>
        <p>
          All patient data entered into Clinora belongs to the clinic and ultimately to the patients (Data Principals). Clinora does not claim ownership of any data stored within the Software.
        </p>
        <p>
          You may export or delete your data at any time using the built-in tools.
        </p>
      </div>

      <div className="legal-section">
        <h2>6. Software Updates</h2>
        <p>
          Clinora may release updates that introduce new features, fix bugs, or update these Terms. When the Terms are updated:
        </p>
        <ul>
          <li>You will be shown the updated Terms on the next app launch.</li>
          <li>You must accept the new Terms to continue using the Software.</li>
          <li>If you do not accept, you may export your data before discontinuing use.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>7. Limitation of Liability</h2>
        <p>To the maximum extent permitted by Indian law, Clinora and its developers shall not be liable for:</p>
        <ul>
          <li>Loss or corruption of data due to hardware failure, power outages, or improper use.</li>
          <li>Legal penalties arising from the clinic's failure to comply with the DPDP Act 2023 or other applicable laws.</li>
          <li>Any indirect, incidental, or consequential damages arising from use of the Software.</li>
        </ul>
        <p>
          The clinic assumes full responsibility for maintaining regular database backups using the built-in backup feature.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Termination</h2>
        <p>
          Your license to use Clinora may be terminated if you materially breach these Terms. Upon termination, you must cease all use of the Software. Patient data remains accessible to you for export purposes for 30 days after termination.
        </p>
      </div>

      <div className="legal-section">
        <h2>9. Governing Law &amp; Dispute Resolution</h2>
        <p>
          These Terms are governed exclusively by the laws of India, including but not limited to:
        </p>
        <ul>
          <li>Digital Personal Data Protection (DPDP) Act 2023</li>
          <li>Information Technology Act 2000 and its amendments</li>
          <li>Indian Contract Act 1872</li>
        </ul>
        <p>
          Any disputes shall be subject to the exclusive jurisdiction of courts in India. Both parties agree to first attempt resolution through the grievance process before approaching a court.
        </p>
      </div>

      <div className="legal-section">
        <h2>10. Contact</h2>
        <div className="legal-contact-box">
          <p>
            <strong>Clinora Support</strong><br />
            Email: <strong>support@clinora.in</strong><br />
            Grievance response time: Within 30 days as required by the DPDP Act 2023.
          </p>
        </div>
      </div>

    </div>
  )
}
