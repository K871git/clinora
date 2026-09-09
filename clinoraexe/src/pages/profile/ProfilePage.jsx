import '../../styles/profile-page.css'
import { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import profileService from '../../services/profileService'
import { convertFileSrc } from '@tauri-apps/api/core'

function getAvatarUrl(path) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path
  try { return convertFileSrc(path) } catch { return null }
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth()

  /* ── Account info (name + email) ───────────────────────────────────── */
  const [info, setInfo]             = useState({ name: user?.name ?? '', email: user?.email ?? '' })
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSaved, setInfoSaved]   = useState(false)
  const [infoErrors, setInfoErrors] = useState({})

  /* ── Personal details ───────────────────────────────────────────────── */
  const [personal, setPersonal]           = useState({
    username: user?.username ?? '',
    phone:    user?.phone    ?? '',
    gender:   user?.gender   ?? '',
    dob:      user?.dob      ?? '',
    address:  user?.address  ?? '',
  })
  const [persSaving, setPersSaving] = useState(false)
  const [persSaved, setPersSaved]   = useState(false)
  const [persErrors, setPersErrors] = useState({})

  /* ── Password ───────────────────────────────────────────────────────── */
  const [pwd, setPwd]             = useState({ current_password: '', password: '', password_confirmation: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSaved, setPwdSaved]   = useState(false)
  const [pwdErrors, setPwdErrors] = useState({})

  /* ── Avatar ─────────────────────────────────────────────────────────── */
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileRef = useRef(null)

  /* ── Handlers ───────────────────────────────────────────────────────── */

  async function handleInfoSave(e) {
    e.preventDefault()
    setInfoErrors({})
    setInfoSaving(true)
    try {
      const { data } = await profileService.updateProfile(info)
      updateUser(data.user)
      setInfoSaved(true)
      setTimeout(() => setInfoSaved(false), 3000)
    } catch (err) {
      if (err.response?.status === 422) setInfoErrors(err.response.data.errors ?? {})
    } finally {
      setInfoSaving(false)
    }
  }

  async function handlePersonalSave(e) {
    e.preventDefault()
    setPersErrors({})
    setPersSaving(true)
    try {
      /* Send all fields together — backend validates optional ones */
      const { data } = await profileService.updateProfile({ ...info, ...personal })
      updateUser(data.user)
      setPersSaved(true)
      setTimeout(() => setPersSaved(false), 3000)
    } catch (err) {
      if (err.response?.status === 422) setPersErrors(err.response.data.errors ?? {})
    } finally {
      setPersSaving(false)
    }
  }

  async function handlePwdSave(e) {
    e.preventDefault()
    setPwdErrors({})
    setPwdSaving(true)
    try {
      await profileService.changePassword(pwd)
      setPwdSaved(true)
      setPwd({ current_password: '', password: '', password_confirmation: '' })
      setTimeout(() => setPwdSaved(false), 3000)
    } catch (err) {
      if (err.response?.status === 422) setPwdErrors(err.response.data.errors ?? {})
    } finally {
      setPwdSaving(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const { data } = await profileService.uploadAvatar(file)
      updateUser(data.user)
    } catch { /* silent */ } finally {
      setAvatarUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true)
    try {
      const { data } = await profileService.removeAvatar()
      updateUser(data.user)
    } catch { /* silent */ } finally {
      setAvatarUploading(false)
    }
  }

  const imgSrc = getAvatarUrl(user?.avatar)

  return (
    <div className="prf-page">

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <div className="card prf-hero">
        <div className="prf-hero-body">

          <div className="prf-avatar-wrap">
            <div className="prf-avatar">
              {imgSrc
                ? <img src={imgSrc} alt={user?.name} className="prf-avatar-img" />
                : <span className="prf-avatar-initials">{initials(user?.name)}</span>}
              {avatarUploading
                ? <div className="prf-avatar-loading"><span className="prf-spinner" /></div>
                : (
                  <button className="prf-avatar-btn" onClick={() => fileRef.current?.click()} title="Change photo">
                    <IconCamera />
                  </button>
                )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />

            {user?.avatar && !avatarUploading && (
              <button className="prf-remove-avatar" onClick={handleAvatarRemove}>Remove photo</button>
            )}
          </div>

          <div className="prf-hero-info">
            <h2 className="prf-hero-name">{user?.name}</h2>
            {user?.username && (
              <span className="prf-hero-username">@{user.username}</span>
            )}
            <span className={`prf-role-badge prf-role-badge--${user?.role ?? 'doctor'}`}>
              {user?.role === 'pharmacy' ? 'Pharmacist' : 'Doctor'}
            </span>
            <p className="prf-hero-email">{user?.email}</p>
            {user?.phone && <p className="prf-hero-phone">{user.phone}</p>}
          </div>
        </div>
      </div>

      {/* ── Account Information ────────────────────────────────────────── */}
      <div className="card prf-card">
        <div className="prf-card-head"><IconUser /> Account Information</div>
        <form className="prf-card-body" onSubmit={handleInfoSave}>
          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label">Full Name <span className="prf-required">*</span></label>
              <input
                className={`stg-input${infoErrors.name ? ' prf-input--error' : ''}`}
                value={info.name}
                onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
              {infoErrors.name && <span className="prf-error">{infoErrors.name[0]}</span>}
            </div>
            <div className="prf-field">
              <label className="prf-label">Email Address <span className="prf-required">*</span></label>
              <input
                type="email"
                className={`stg-input${infoErrors.email ? ' prf-input--error' : ''}`}
                value={info.email}
                onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
                placeholder="you@clinic.com"
              />
              {infoErrors.email && <span className="prf-error">{infoErrors.email[0]}</span>}
            </div>
          </div>

          <div className="prf-card-foot">
            {infoSaved && <span className="stg-saved-msg">✓ Saved</span>}
            <button className="stg-save-btn" disabled={infoSaving}>
              {infoSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Personal Details ───────────────────────────────────────────── */}
      <div className="card prf-card">
        <div className="prf-card-head"><IconIdCard /> Personal Details</div>
        <form className="prf-card-body" onSubmit={handlePersonalSave}>

          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label">Username</label>
              <div className="prf-input-prefix-wrap">
                <span className="prf-input-prefix">@</span>
                <input
                  className={`stg-input prf-input-prefixed${persErrors.username ? ' prf-input--error' : ''}`}
                  value={personal.username}
                  onChange={e => setPersonal(p => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. sonali.ph"
                  autoComplete="off"
                />
              </div>
              {persErrors.username && <span className="prf-error">{persErrors.username[0]}</span>}
            </div>

            <div className="prf-field">
              <label className="prf-label">Phone / Mobile</label>
              <input
                type="tel"
                className={`stg-input${persErrors.phone ? ' prf-input--error' : ''}`}
                value={personal.phone}
                onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))}
                placeholder="+92 300 0000000"
              />
              {persErrors.phone && <span className="prf-error">{persErrors.phone[0]}</span>}
            </div>
          </div>

          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label">Gender</label>
              <select
                className={`stg-input prf-select${persErrors.gender ? ' prf-input--error' : ''}`}
                value={personal.gender}
                onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))}
              >
                <option value="">— Select gender —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
              {persErrors.gender && <span className="prf-error">{persErrors.gender[0]}</span>}
            </div>

            <div className="prf-field">
              <label className="prf-label">Date of Birth</label>
              <input
                type="date"
                className={`stg-input${persErrors.dob ? ' prf-input--error' : ''}`}
                value={personal.dob}
                onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))}
                max={new Date().toISOString().split('T')[0]}
              />
              {persErrors.dob && <span className="prf-error">{persErrors.dob[0]}</span>}
            </div>
          </div>

          <div className="prf-field">
            <label className="prf-label">Address</label>
            <textarea
              className={`stg-input prf-textarea${persErrors.address ? ' prf-input--error' : ''}`}
              value={personal.address}
              onChange={e => setPersonal(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, City, Province"
              rows={2}
            />
            {persErrors.address && <span className="prf-error">{persErrors.address[0]}</span>}
          </div>

          <div className="prf-card-foot">
            {persSaved && <span className="stg-saved-msg">✓ Saved</span>}
            <button className="stg-save-btn" disabled={persSaving}>
              {persSaving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Change Password ────────────────────────────────────────────── */}
      <div className="card prf-card">
        <div className="prf-card-head"><IconLock /> Change Password</div>
        <form className="prf-card-body" onSubmit={handlePwdSave}>
          <div className="prf-field">
            <label className="prf-label">Current Password</label>
            <input
              type="password"
              className={`stg-input${pwdErrors.current_password ? ' prf-input--error' : ''}`}
              value={pwd.current_password}
              onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
            {pwdErrors.current_password && (
              <span className="prf-error">{pwdErrors.current_password[0]}</span>
            )}
          </div>

          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label">New Password</label>
              <input
                type="password"
                className={`stg-input${pwdErrors.password ? ' prf-input--error' : ''}`}
                value={pwd.password}
                onChange={e => setPwd(p => ({ ...p, password: e.target.value }))}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              {pwdErrors.password && <span className="prf-error">{pwdErrors.password[0]}</span>}
            </div>
            <div className="prf-field">
              <label className="prf-label">Confirm New Password</label>
              <input
                type="password"
                className={`stg-input${pwdErrors.password_confirmation ? ' prf-input--error' : ''}`}
                value={pwd.password_confirmation}
                onChange={e => setPwd(p => ({ ...p, password_confirmation: e.target.value }))}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {pwdErrors.password_confirmation && (
                <span className="prf-error">{pwdErrors.password_confirmation[0]}</span>
              )}
            </div>
          </div>

          <div className="prf-card-foot">
            {pwdSaved && <span className="stg-saved-msg">✓ Password updated</span>}
            <button className="stg-save-btn" disabled={pwdSaving}>
              {pwdSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}

/* ─── Icons ─────────────────────────────────────────────────────────── */

function IconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="5.5" r="3" />
      <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

function IconIdCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="16" height="10" rx="2" />
      <circle cx="6" cy="9" r="2" />
      <path d="M10 7.5h4M10 10.5h3" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="12" height="9" rx="2" />
      <path d="M6 8V5.5a3 3 0 0 1 6 0V8" />
    </svg>
  )
}
