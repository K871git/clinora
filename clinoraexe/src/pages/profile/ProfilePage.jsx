import '../../styles/profile-page.css'
import { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import profileService from '../../services/profileService'
import { convertFileSrc } from '@tauri-apps/api/core'
import { sanitizeMobile, validateMobile, validateDob, validateEmail } from '../../lib/inputValidators'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 7 * 1024 * 1024

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
  const [infoErrors, setInfoErrors] = useState({})

  /* ── Personal details ───────────────────────────────────────────────── */
  const [personal, setPersonal] = useState({
    username: user?.username ?? '',
    phone:    user?.phone    ?? '',
    gender:   user?.gender   ?? '',
    dob:      user?.dob      ?? '',
    address:  user?.address  ?? '',
  })
  const [persErrors, setPersErrors] = useState({})

  /* ── Password ───────────────────────────────────────────────────────── */
  const [pwd, setPwd]             = useState({ current_password: '', password: '', password_confirmation: '' })
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSaved, setPwdSaved]   = useState(false)
  const [pwdErrors, setPwdErrors] = useState({})

  /* ── Unified save (Account + Personal) ─────────────────────────────── */
  const [allSaving, setAllSaving] = useState(false)
  const [allSaved,  setAllSaved]  = useState(false)

  /* ── Avatar ─────────────────────────────────────────────────────────── */
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError,     setAvatarError]     = useState('')
  const fileRef = useRef(null)

  /* ── Handlers ───────────────────────────────────────────────────────── */

  async function doInfoSave() {
    const errs = {}
    if (!info.name.trim()) errs.name = ['Full name is required.']
    const emailErr = validateEmail(info.email)
    if (emailErr) errs.email = [emailErr]
    if (Object.keys(errs).length) { setInfoErrors(errs); throw new Error('validation') }
    setInfoErrors({})
    const { data } = await profileService.updateProfile(info)
    updateUser(data.user)
  }

  async function doPersonalSave() {
    const errs = {}
    const phoneErr = validateMobile(personal.phone)
    if (phoneErr) errs.phone = [phoneErr]
    const dobErr = validateDob(personal.dob)
    if (dobErr) errs.dob = [dobErr]
    if (Object.keys(errs).length) { setPersErrors(errs); throw new Error('validation') }
    setPersErrors({})
    const { data } = await profileService.updateProfile({ ...info, ...personal })
    updateUser(data.user)
  }

  async function handleSaveAll(e) {
    e?.preventDefault()
    setAllSaving(true); setAllSaved(false)
    try {
      await doInfoSave()
      await doPersonalSave()
      setAllSaved(true)
      setTimeout(() => setAllSaved(false), 5000)
    } catch (err) {
      if (err.response?.status === 422) {
        const errs = err.response.data.errors ?? {}
        setInfoErrors(p => ({ ...p, ...errs }))
        setPersErrors(p => ({ ...p, ...errs }))
      }
    } finally {
      setAllSaving(false)
    }
  }

  async function handlePwdSave(e) {
    e.preventDefault()
    const errs = {}
    if (!pwd.current_password) errs.current_password = ['Current password is required.']
    if (!pwd.password) errs.password = ['New password is required.']
    else if (pwd.password.length < 8) errs.password = ['Password must be at least 8 characters.']
    if (pwd.password && pwd.password !== pwd.password_confirmation)
      errs.password_confirmation = ['Passwords do not match.']
    if (Object.keys(errs).length) { setPwdErrors(errs); return }
    setPwdErrors({})
    setPwdSaving(true)
    try {
      await profileService.changePassword(pwd)
      setPwdSaved(true)
      setPwd({ current_password: '', password: '', password_confirmation: '' })
      setTimeout(() => setPwdSaved(false), 5000)
    } catch (err) {
      if (err.response?.status === 422) setPwdErrors(err.response.data.errors ?? {})
      else setPwdErrors({ current_password: [typeof err === 'string' ? err : 'Password update failed. Please try again.'] })
    } finally {
      setPwdSaving(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Only JPG, PNG, or WebP photos are allowed.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setAvatarError('Photo must be under 7 MB.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setAvatarUploading(true)
    try {
      const { data } = await profileService.uploadAvatar(file)
      updateUser(data.user)
    } catch (err) {
      setAvatarError(typeof err === 'string' ? err : 'Photo upload failed. Please try again.')
    } finally {
      setAvatarUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleAvatarRemove() {
    setAvatarError('')
    setAvatarUploading(true)
    try {
      const { data } = await profileService.removeAvatar()
      updateUser(data.user)
    } catch (err) {
      setAvatarError(typeof err === 'string' ? err : 'Could not remove photo. Please try again.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const imgSrc = getAvatarUrl(user?.avatar)
  const pwdMismatch = pwd.password_confirmation.length > 0 && pwd.password !== pwd.password_confirmation

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
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />

            {user?.avatar && !avatarUploading && (
              <button className="prf-remove-avatar" onClick={handleAvatarRemove}>Remove photo</button>
            )}

            {avatarError && <p className="prf-avatar-error">{avatarError}</p>}
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
        <form className="prf-card-body" id="prf-form-info" onSubmit={handleSaveAll}>
          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label" htmlFor="prf-name">Full Name <span className="prf-required">*</span></label>
              <input
                id="prf-name"
                className={`stg-input${infoErrors.name ? ' prf-input--error' : ''}`}
                value={info.name}
                onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
                disabled={allSaving}
              />
              {infoErrors.name && <span className="prf-error">{infoErrors.name[0]}</span>}
            </div>
            <div className="prf-field">
              <label className="prf-label" htmlFor="prf-email">Email Address <span className="prf-required">*</span></label>
              <input
                id="prf-email"
                type="email"
                className={`stg-input${infoErrors.email ? ' prf-input--error' : ''}`}
                value={info.email}
                onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
                placeholder="you@clinic.com"
                disabled={allSaving}
              />
              {infoErrors.email && <span className="prf-error">{infoErrors.email[0]}</span>}
            </div>
          </div>
        </form>
      </div>

      {/* ── Personal Details ───────────────────────────────────────────── */}
      <div className="card prf-card">
        <div className="prf-card-head"><IconIdCard /> Personal Details</div>
        <form className="prf-card-body" id="prf-form-personal" onSubmit={handleSaveAll}>

          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label" htmlFor="prf-username">Username</label>
              <div className="prf-input-prefix-wrap">
                <span className="prf-input-prefix">@</span>
                <input
                  id="prf-username"
                  className={`stg-input prf-input-prefixed${persErrors.username ? ' prf-input--error' : ''}`}
                  value={personal.username}
                  onChange={e => setPersonal(p => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. sonali.ph"
                  autoComplete="off"
                  disabled={allSaving}
                />
              </div>
              {persErrors.username && <span className="prf-error">{persErrors.username[0]}</span>}
            </div>

            <div className="prf-field">
              <label className="prf-label" htmlFor="prf-phone">Phone / Mobile</label>
              <input
                id="prf-phone"
                type="tel"
                className={`stg-input${persErrors.phone ? ' prf-input--error' : ''}`}
                value={personal.phone}
                onChange={e => setPersonal(p => ({ ...p, phone: sanitizeMobile(e.target.value) }))}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
                disabled={allSaving}
              />
              {persErrors.phone && <span className="prf-error">{persErrors.phone[0]}</span>}
            </div>
          </div>

          <div className="prf-grid-2">
            <div className="prf-field">
              <label className="prf-label" htmlFor="prf-gender">Gender</label>
              <select
                id="prf-gender"
                className={`stg-input prf-select${persErrors.gender ? ' prf-input--error' : ''}`}
                value={personal.gender}
                onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))}
                disabled={allSaving}
              >
                <option value="">— Select gender —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
              {persErrors.gender && <span className="prf-error">{persErrors.gender[0]}</span>}
            </div>

            <div className="prf-field">
              <label className="prf-label" htmlFor="prf-dob">Date of Birth</label>
              <input
                id="prf-dob"
                type="date"
                className={`stg-input${persErrors.dob ? ' prf-input--error' : ''}`}
                value={personal.dob}
                onChange={e => setPersonal(p => ({ ...p, dob: e.target.value }))}
                max={new Date().toISOString().split('T')[0]}
                disabled={allSaving}
              />
              {persErrors.dob && <span className="prf-error">{persErrors.dob[0]}</span>}
            </div>
          </div>

          <div className="prf-field">
            <label className="prf-label" htmlFor="prf-address">Address</label>
            <textarea
              id="prf-address"
              className={`stg-input prf-textarea${persErrors.address ? ' prf-input--error' : ''}`}
              value={personal.address}
              onChange={e => setPersonal(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, City, Province"
              rows={2}
              disabled={allSaving}
            />
            {persErrors.address && <span className="prf-error">{persErrors.address[0]}</span>}
          </div>

        </form>
      </div>

      {/* ── Unified save bar ───────────────────────────────────────────── */}
      <div className="stg-save-all-bar">
        {allSaved
          ? <span className="stg-saved-msg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Profile saved
            </span>
          : <span />}
        <button
          type="button"
          className="stg-save-btn"
          onClick={handleSaveAll}
          disabled={allSaving}
        >
          {allSaving ? 'Saving…' : 'Save Profile Changes'}
        </button>
      </div>

      {/* ── Change Password ────────────────────────────────────────────── */}
      <div className="card prf-card">
        <div className="prf-card-head"><IconLock /> Change Password</div>
        <form className="prf-card-body" onSubmit={handlePwdSave}>
          <div className="prf-field">
            <label className="prf-label" htmlFor="prf-cur-pwd">Current Password</label>
            <input
              id="prf-cur-pwd"
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
              <label className="prf-label" htmlFor="prf-new-pwd">New Password</label>
              <input
                id="prf-new-pwd"
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
              <label className="prf-label" htmlFor="prf-conf-pwd">Confirm New Password</label>
              <input
                id="prf-conf-pwd"
                type="password"
                className={`stg-input${pwdErrors.password_confirmation || pwdMismatch ? ' prf-input--error' : ''}`}
                value={pwd.password_confirmation}
                onChange={e => setPwd(p => ({ ...p, password_confirmation: e.target.value }))}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {pwdErrors.password_confirmation
                ? <span className="prf-error">{pwdErrors.password_confirmation[0]}</span>
                : pwdMismatch
                  ? <span className="prf-error">Passwords do not match.</span>
                  : null}
            </div>
          </div>

          <div className="prf-card-foot">
            {pwdSaved && <span className="stg-saved-msg">✓ Password updated</span>}
            <button className="stg-save-btn" disabled={pwdSaving || pwdMismatch}>
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
