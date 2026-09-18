import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import '../styles/license-gate.css'

export default function LicenseGate({ children }) {
  const [status, setStatus] = useState('checking')
  const [licenseInfo, setLicenseInfo] = useState(null)
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    invoke('get_license_status')
      .then(res => {
        if (res.licensed) {
          setLicenseInfo(res)
          setStatus('licensed')
        } else {
          setLicenseInfo(res)
          setStatus('unlicensed')
        }
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

  // Checking spinner
  if (status === 'checking') {
    return (
      <div className="lg-overlay">
        <div className="lg-spinner" />
      </div>
    )
  }

  // Licensed — render app, but show expiry banner if expiring soon
  if (status === 'licensed') {
    const expiringSoon = licenseInfo?.expiring_soon
    const daysLeft = licenseInfo?.days_remaining
    return (
      <>
        {expiringSoon && daysLeft != null && (
          <div className="lg-expiry-banner">
            Your Clinora {licenseInfo.tier} license expires in{' '}
            <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>.
            Contact your provider to renew.
          </div>
        )}
        {children}
      </>
    )
  }

  // Unlicensed / expired
  const isExpired = licenseInfo?.reason === 'expired'

  return (
    <div className="lg-overlay">
      <div className="lg-card">
        <div className="lg-logo">
          <img src="/logos/logo1.png" alt="Clinora" />
        </div>
        <h1 className="lg-title">Clinora</h1>

        {isExpired ? (
          <p className="lg-subtitle lg-subtitle--expired">
            Your license has expired. Enter a new key to continue.
          </p>
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
              className="lg-btn"
              type="submit"
              disabled={loading || !key.trim()}
            >
              {loading ? 'Activating…' : 'Activate'}
            </button>
          </form>
        )}

        <p className="lg-footer">
          Need a license key?{' '}
          <span className="lg-footer-contact">Contact Clinora support.</span>
        </p>
      </div>
    </div>
  )
}
