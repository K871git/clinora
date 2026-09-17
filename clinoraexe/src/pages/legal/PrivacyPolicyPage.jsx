import { useNavigate } from 'react-router-dom'
import '../../styles/consent.css'

export default function PrivacyPolicyPage() {
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
      <h1 className="legal-title">Privacy Policy</h1>
      <p className="legal-meta">Effective: 17 September 2026 &nbsp;·&nbsp; Applies to Clinora Clinic Management System</p>

      <div className="legal-section">
        <h2>1. Who We Are</h2>
        <p>
          Clinora ("the Software") is a desktop clinic management application developed for use by registered medical clinics in India. In the context of the <strong>Digital Personal Data Protection (DPDP) Act 2023</strong>:
        </p>
        <ul>
          <li><strong>Data Fiduciary:</strong> The clinic (doctor/pharmacist) that installs and uses Clinora.</li>
          <li><strong>Data Processor:</strong> Clinora processes personal data on behalf of the clinic.</li>
          <li><strong>Data Principal:</strong> Patients and clinic staff whose personal data is processed.</li>
        </ul>
        <div className="legal-highlight">
          Clinora does not store, access, or transmit your data to any external server. All data stays on your clinic's own computer.
        </div>
      </div>

      <div className="legal-section">
        <h2>2. What Personal Data Is Processed</h2>
        <p><strong>Clinic Staff:</strong></p>
        <ul>
          <li>Name, email address, phone number</li>
          <li>Role (doctor or pharmacist), login credentials (password is stored in hashed form)</li>
          <li>Profile photo (if uploaded)</li>
        </ul>
        <p><strong>Patients:</strong></p>
        <ul>
          <li>Name, age, gender, contact number</li>
          <li>Medical history, diagnosis notes, vital signs</li>
          <li>Prescriptions, medicines dispensed</li>
          <li>Visit records, fees paid</li>
        </ul>
        <p>Patient health data is <strong>sensitive personal data</strong> under the DPDP Act 2023 and is handled with the highest level of care.</p>
      </div>

      <div className="legal-section">
        <h2>3. Purpose of Processing</h2>
        <ul>
          <li>Managing patient records, visits, and prescriptions</li>
          <li>Dispensing medicines through the pharmacy module</li>
          <li>Generating invoices and revenue reports for the clinic</li>
          <li>Authenticating clinic staff and managing access</li>
        </ul>
        <p>Data is processed only for the above purposes and is not used for profiling, marketing, or any other purpose.</p>
      </div>

      <div className="legal-section">
        <h2>4. Data Storage &amp; Security</h2>
        <ul>
          <li>All data is stored locally in a MySQL database on the clinic's own server or PC.</li>
          <li>No data is transmitted to Clinora servers, cloud services, or third parties.</li>
          <li>Passwords are stored using strong cryptographic hashing (bcrypt).</li>
          <li>The clinic is responsible for securing the physical device and database access.</li>
          <li>Regular database backups using the built-in backup feature are strongly recommended.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>5. Data Sharing</h2>
        <p>
          Clinora does <strong>not</strong> sell, rent, share, or disclose personal data to any third party under any circumstances, except:
        </p>
        <ul>
          <li>When legally required by a court order, government authority, or competent regulatory body under Indian law.</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>6. Rights of Data Principals (DPDP Act 2023)</h2>
        <p>Under the DPDP Act 2023, patients and staff have the following rights:</p>
        <ul>
          <li><strong>Right to information:</strong> Know what personal data is held about them.</li>
          <li><strong>Right to correction:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong>Right to erasure:</strong> Request deletion of personal data, subject to legal retention requirements.</li>
          <li><strong>Right to grievance redressal:</strong> Lodge a complaint if their rights are not respected.</li>
        </ul>
        <p>
          These rights are exercised through the clinic (Data Fiduciary). Clinora provides the tools (edit, delete patient records) to enable the clinic to honour these requests.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. Data Retention</h2>
        <p>
          Patient records are retained for as long as the clinic is in operation and uses Clinora. The clinic is responsible for deleting records they no longer need, in accordance with applicable medical record retention laws in India (typically 3–7 years depending on the record type).
        </p>
      </div>

      <div className="legal-section">
        <h2>8. Children's Data</h2>
        <p>
          Clinora may store medical records of minor patients (under 18 years). Such data is processed only in the course of legitimate medical care. The clinic must ensure parental or guardian consent is obtained before recording a minor's data, as required under the DPDP Act 2023.
        </p>
      </div>

      <div className="legal-section">
        <h2>9. Updates to This Policy</h2>
        <p>
          This Privacy Policy may be updated with new versions of Clinora. The version number and effective date will change with each update. Clinics will be asked to review and re-accept the updated policy on first launch after an update.
        </p>
      </div>

      <div className="legal-section">
        <h2>10. Grievance Officer</h2>
        <p>For any privacy-related concerns, requests, or complaints, contact our Grievance Officer:</p>
        <div className="legal-contact-box">
          <p>
            <strong>Grievance Officer — Clinora</strong><br />
            Email: <strong>support@clinora.in</strong><br />
            Response time: Within 30 days of receiving a written complaint, as required by the DPDP Act 2023.
          </p>
        </div>
      </div>

    </div>
  )
}
