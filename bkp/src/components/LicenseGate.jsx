import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import '../styles/license-gate.css'

export default function LicenseGate({ children }) {
  const [status,      setStatus]      = useState('checking')
  const [licenseInfo, setLicenseInfo] = useState(null)
  const [key,         setKey]         = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)
  const [popupDismissed, setPopupDismissed] = useState(false)

  useEffect(() => {
    invoke('get_license_status')
      .then(res => {
        setLicenseInfo(res)
        setStatus(res.licensed ? 'licensed' : 'unlicensed')
      })
      .catch(() => setStatus('unlicensed'))
  }, [])

  async function handleActivate(e) {
    e.preventDefault()
    if (!key.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await invoke('activate_license', { key: key.trim() })
      setLicenseInfo(res)
      setSuccess(true)
      setTimeout(() => setStatus('licensed'), 1600)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Invalid license key.')
    } finally {
      setLoading(false)
    }
  }

  // ── Checking spinner ──────────────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div className="lg-overlay">
        <div className="lg-spinner" />
      </div>
    )
  }

  // ── Licensed ──────────────────────────────────────────────────────────────────
  if (status === 'licensed') {
    const expiringSoon = licenseInfo?.expiring_soon
    const daysLeft     = licenseInfo?.days_remaining
    return (
      <>
        {expiringSoon && !popupDismissed && (
          <div className="lg-popup-overlay">
            <div className="lg-popup-card">
              {/* Close button */}
              <button className="lg-popup-close" onClick={() => setPopupDismissed(true)} aria-label="Dismiss">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 1l12 12M13 1L1 13"/>
                </svg>
              </button>

              {/* Icon */}
              <div className="lg-popup-icon-wrap">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>

              <h2 className="lg-popup-title">Subscription Expiring</h2>
              <p className="lg-popup-days">
                {daysLeft === 0 ? 'Today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
              </p>
              <p className="lg-popup-body">
                Your Clinora license is expiring{' '}
                {daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}.
                Renew your subscription to avoid any interruption.
              </p>

              {/* Contact section */}
              <div className="lg-popup-contact-block">
                <p className="lg-popup-contact-label">Get in touch to renew</p>
                <div className="lg-popup-contact-wa-wrap">
                  <button className="lg-popup-contact-row lg-popup-contact-wa"
                    onClick={() => openUrl('https://wa.me/917499621927')}>
                    <span className="lg-popup-contact-icon lg-popup-contact-icon--wa">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                      </svg>
                    </span>
                    <span className="lg-popup-contact-text">
                      <span className="lg-popup-contact-main">WhatsApp</span>
                      <span className="lg-popup-contact-sub">+91 74996 21927</span>
                    </span>
                    <svg className="lg-popup-contact-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M7 17L17 7M7 7h10v10"/>
                    </svg>
                  </button>
                  <button className="lg-popup-call-btn" title="Call directly"
                    onClick={() => openUrl('tel:+917499621927')}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </button>
                </div>

                <button className="lg-popup-contact-row lg-popup-contact-email"
                  onClick={() => openUrl('mailto:gangardekishor87@gmail.com')}>
                  <span className="lg-popup-contact-icon lg-popup-contact-icon--email">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <span className="lg-popup-contact-text">
                    <span className="lg-popup-contact-main">Email</span>
                    <span className="lg-popup-contact-sub">gangardekishor87@gmail.com</span>
                  </span>
                  <svg className="lg-popup-contact-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M7 17L17 7M7 7h10v10"/>
                  </svg>
                </button>
              </div>

              <button className="lg-popup-dismiss" onClick={() => setPopupDismissed(true)}>
                Got it, I'll renew
              </button>
            </div>
          </div>
        )}
        {children}
      </>
    )
  }

  // ── Unlicensed / Expired ──────────────────────────────────────────────────────
  const isExpired = licenseInfo?.reason === 'expired'

  return (
    <div className="lg-overlay">
      <div className={`lg-card${isExpired ? ' lg-card--expired' : ''}`}>

        <div className="lg-logo">
          {isExpired ? (
            <div className="lg-expired-icon">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                <circle cx="36" cy="36" r="36" fill="#fef2f2"/>
                <circle cx="36" cy="36" r="28" fill="#fee2e2"/>
                <circle cx="36" cy="36" r="20" stroke="#ef4444" strokeWidth="2.5" fill="none"/>
                <path d="M36 24v13l7 4.5" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ) : (
            <img src="/logos/logo1.png" alt="Clinora" />
          )}
        </div>

        <h1 className="lg-title">{isExpired ? 'License Expired' : 'Clinora'}</h1>

        {isExpired ? (
          <>
            <p className="lg-subtitle lg-subtitle--expired">
              Your Clinora license has expired.
              {licenseInfo?.clinic_id && (
                <><br /><span className="lg-clinic-id">{licenseInfo.clinic_id}</span></>
              )}
            </p>
            <p className="lg-renew-hint">Enter your new license key below to continue.</p>
          </>
        ) : (
          <p className="lg-subtitle">Enter your license key to activate</p>
        )}

        {success ? (
          <div className="lg-success">
            <span className="lg-success-icon">✓</span>
            {licenseInfo?.message || 'Activated successfully!'} Starting…
          </div>
        ) : (
          <form onSubmit={handleActivate} className="lg-form">
            <input
              className={`lg-input${error ? ' lg-input--error' : ''}`}
              type="text"
              placeholder="Paste your license key here"
              value={key}
              onChange={e => { setKey(e.target.value); setError('') }}
              spellCheck={false}
              autoComplete="off"
              disabled={loading}
            />
            {error && <p className="lg-error">{error}</p>}
            <button
              className={`lg-btn${isExpired ? ' lg-btn--renew' : ''}`}
              type="submit"
              disabled={loading || !key.trim()}
            >
              {loading ? 'Activating…' : isExpired ? 'Renew License' : 'Activate'}
            </button>
          </form>
        )}

        {/* Contact section — shown on both expired and fresh activation */}
        <div className="lg-contact-block">
          <p className="lg-contact-block-label">Contact Clinora support</p>
          <div className="lg-contact-wa-wrap">
            <button className="lg-contact-row lg-contact-wa"
              onClick={() => openUrl('https://wa.me/917499621927')}>
              <span className="lg-contact-icon lg-contact-icon--wa">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
              </span>
              <span className="lg-contact-text">
                <span className="lg-contact-main">WhatsApp</span>
                <span className="lg-contact-sub">+91 74996 21927</span>
              </span>
              <svg className="lg-contact-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M7 17L17 7M7 7h10v10"/>
              </svg>
            </button>
            <button className="lg-contact-call-btn" title="Call directly"
              onClick={() => openUrl('tel:+917499621927')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          </div>
          <button className="lg-contact-row lg-contact-email"
            onClick={() => openUrl('mailto:gangardekishor87@gmail.com')}>
            <span className="lg-contact-icon lg-contact-icon--email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </span>
            <span className="lg-contact-text">
              <span className="lg-contact-main">Email</span>
              <span className="lg-contact-sub">gangardekishor87@gmail.com</span>
            </span>
            <svg className="lg-contact-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M7 17L17 7M7 7h10v10"/>
            </svg>
          </button>
        </div>

        <p className="lg-footer">
          <span className="lg-footer-contact">Clinora v1.2.0</span>
        </p>
      </div>
    </div>
  )
}
