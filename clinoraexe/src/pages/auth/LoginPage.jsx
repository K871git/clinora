import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Spinner from '../../components/ui/Spinner'
import PharmacyLoader from '../../components/ui/PharmacyLoader'
import DoctorLoader from '../../components/ui/DoctorLoader'
import { quotes } from '../../data/quotes'
import '../../styles/login.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

function getDayStr() {
  const now   = new Date()
  const day   = now.toLocaleDateString('en-US', { weekday: 'long' })
  const date  = now.getDate()
  const month = now.toLocaleDateString('en-US', { month: 'long' })
  return `${day} · ${date} ${month} ${now.getFullYear()}`
}

function randomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)]
}

/* ── Decorations ─────────────────────────────────────────────────────── */

function SunDeco() {
  return (
    <svg className="login-deco login-deco-sun" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="#fef08a" opacity="0.25" />
      <circle cx="100" cy="100" r="72" fill="#fde68a" opacity="0.55" />
      <circle cx="100" cy="100" r="52" fill="#fcd34d" opacity="0.88" />
    </svg>
  )
}

function CloudsDeco() {
  return (
    <svg className="login-deco login-deco-clouds" viewBox="0 0 1000 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ellipse cx="155" cy="72" rx="88" ry="36" fill="white" opacity="0.88" />
      <ellipse cx="102" cy="88" rx="56" ry="28" fill="white" opacity="0.88" />
      <ellipse cx="208" cy="88" rx="58" ry="26" fill="white" opacity="0.88" />
      <ellipse cx="770" cy="56" rx="74" ry="30" fill="white" opacity="0.78" />
      <ellipse cx="718" cy="70" rx="48" ry="24" fill="white" opacity="0.78" />
      <ellipse cx="822" cy="70" rx="50" ry="22" fill="white" opacity="0.78" />
      <ellipse cx="470" cy="36" rx="50" ry="20" fill="white" opacity="0.62" />
      <ellipse cx="432" cy="48" rx="32" ry="16" fill="white" opacity="0.62" />
      <ellipse cx="508" cy="48" rx="34" ry="15" fill="white" opacity="0.62" />
    </svg>
  )
}

function StarsDeco() {
  const S = [
    [6,4,0],[19,11,1],[34,3,0],[51,14,1],[67,5,0],[83,10,1],[97,2,0],
    [11,24,1],[27,20,0],[45,28,0],[63,18,1],[79,25,0],[94,14,1],
    [5,42,0],[21,38,1],[40,46,0],[58,35,1],[74,43,0],[90,32,0],
    [13,58,1],[31,54,0],[52,61,1],[69,55,0],[86,50,1],[98,62,0],
    [8,74,0],[27,70,1],[48,77,0],[66,72,1],[84,68,0],[96,78,1],
  ]
  return (
    <svg className="login-deco login-deco-stars" viewBox="0 0 100 85" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {S.map(([x, y, bright], i) => (
        <circle key={i} cx={x} cy={y}
          r={bright ? 0.9 : 0.45}
          fill={bright ? '#fffde8' : 'white'}
          opacity={bright ? 0.65 : 0.38}
          className={bright ? 'star-bright' : undefined}
          style={bright ? { animationDelay: `${((i * 0.47) % 3).toFixed(2)}s` } : undefined}
        />
      ))}
    </svg>
  )
}

function BirdsDeco() {
  return (
    <>
      <svg className="login-deco login-bird login-bird-1" width="20" height="10" viewBox="0 0 20 10" aria-hidden="true">
        <path strokeWidth="1.2" d="M0,7 Q5,0 10,5" /><path strokeWidth="1.2" d="M10,5 Q15,0 20,7" />
      </svg>
      <svg className="login-deco login-bird login-bird-2" width="15" height="8" viewBox="0 0 15 8" aria-hidden="true">
        <path strokeWidth="1.1" d="M0,5.5 Q3.75,0 7.5,3.5" /><path strokeWidth="1.1" d="M7.5,3.5 Q11.25,0 15,5.5" />
      </svg>
      <svg className="login-deco login-bird login-bird-3" width="11" height="6" viewBox="0 0 11 6" aria-hidden="true">
        <path strokeWidth="1.0" d="M0,4 Q2.75,0 5.5,2.5" /><path strokeWidth="1.0" d="M5.5,2.5 Q8.25,0 11,4" />
      </svg>
      <svg className="login-deco login-bird login-bird-4" width="9" height="5" viewBox="0 0 9 5" aria-hidden="true">
        <path strokeWidth="0.9" d="M0,3.5 Q2.25,0 4.5,2" /><path strokeWidth="0.9" d="M4.5,2 Q6.75,0 9,3.5" />
      </svg>
    </>
  )
}

function MoonDeco() {
  return (
    <svg className="login-deco login-deco-moon" width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
      <defs>
        <mask id="moon-mask">
          <rect width="90" height="90" fill="white" />
          <circle cx="58" cy="32" r="28" fill="black" />
        </mask>
      </defs>
      <circle cx="44" cy="44" r="42" fill="#a5b4fc" opacity="0.07" />
      <circle cx="44" cy="44" r="26" fill="#e0e7ff" mask="url(#moon-mask)" />
    </svg>
  )
}

/* ── Pharmacy decorations ────────────────────────────────────────────── */

function PillsDeco() {
  return (
    <>
      {/* Pill 1 — large, bottom-left */}
      <svg className="login-deco login-pill login-pill-1" width="56" height="22" viewBox="0 0 56 22" aria-hidden="true">
        <rect x="0" y="0" width="56" height="22" rx="11" fill="rgba(20,184,166,0.28)" />
        <path d="M28,0 L45,0 Q56,0 56,11 Q56,22 45,22 L28,22 Z" fill="rgba(20,184,166,0.18)" />
        <line x1="28" y1="2" x2="28" y2="20" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
      </svg>

      {/* Pill 2 — medium, top-left */}
      <svg className="login-deco login-pill login-pill-2" width="44" height="18" viewBox="0 0 44 18" aria-hidden="true">
        <rect x="0" y="0" width="44" height="18" rx="9" fill="rgba(16,185,129,0.24)" />
        <path d="M22,0 L35,0 Q44,0 44,9 Q44,18 35,18 L22,18 Z" fill="rgba(16,185,129,0.14)" />
        <line x1="22" y1="1.5" x2="22" y2="16.5" stroke="rgba(255,255,255,0.38)" strokeWidth="0.7" />
      </svg>

      {/* Pill 3 — medium, bottom-right */}
      <svg className="login-deco login-pill login-pill-3" width="48" height="19" viewBox="0 0 48 19" aria-hidden="true">
        <rect x="0" y="0" width="48" height="19" rx="9.5" fill="rgba(6,182,212,0.22)" />
        <path d="M24,0 L38.5,0 Q48,0 48,9.5 Q48,19 38.5,19 L24,19 Z" fill="rgba(6,182,212,0.14)" />
        <line x1="24" y1="1.5" x2="24" y2="17.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
      </svg>

      {/* Pill 4 — small, mid-left */}
      <svg className="login-deco login-pill login-pill-4" width="36" height="15" viewBox="0 0 36 15" aria-hidden="true">
        <rect x="0" y="0" width="36" height="15" rx="7.5" fill="rgba(20,184,166,0.2)" />
        <path d="M18,0 L28.5,0 Q36,0 36,7.5 Q36,15 28.5,15 L18,15 Z" fill="rgba(20,184,166,0.12)" />
        <line x1="18" y1="1.5" x2="18" y2="13.5" stroke="rgba(255,255,255,0.32)" strokeWidth="0.6" />
      </svg>
    </>
  )
}

function CrossesDeco() {
  return (
    <>
      {/* Cross 1 — large, top-right */}
      <svg className="login-deco login-cross-deco login-cross-1" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="12" y="0" width="8" height="32" rx="3" fill="rgba(20,184,166,0.35)" />
        <rect x="0" y="12" width="32" height="8" rx="3" fill="rgba(20,184,166,0.35)" />
      </svg>

      {/* Cross 2 — medium, right-mid */}
      <svg className="login-deco login-cross-deco login-cross-2" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="8" y="0" width="6" height="22" rx="2.5" fill="rgba(16,185,129,0.3)" />
        <rect x="0" y="8" width="22" height="6" rx="2.5" fill="rgba(16,185,129,0.3)" />
      </svg>

      {/* Cross 3 — small, bottom-right */}
      <svg className="login-deco login-cross-deco login-cross-3" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="6" y="0" width="4" height="16" rx="2" fill="rgba(6,182,212,0.28)" />
        <rect x="0" y="6" width="16" height="4" rx="2" fill="rgba(6,182,212,0.28)" />
      </svg>
    </>
  )
}

function MoleculeDeco() {
  return (
    <svg className="login-deco login-molecule" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
      {/* Static rings */}
      <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(20,184,166,0.1)" strokeWidth="1.5" />
      <circle cx="110" cy="110" r="62"  fill="none" stroke="rgba(20,184,166,0.07)" strokeWidth="1" />
      <circle cx="110" cy="110" r="7"   fill="rgba(20,184,166,0.2)" />
      {/* Outer orbit — rotates forward */}
      <g className="mol-orbit-outer">
        <circle cx="210" cy="110" r="6" fill="rgba(20,184,166,0.5)" />
        <circle cx="10"  cy="110" r="4" fill="rgba(20,184,166,0.3)" />
        <circle cx="110" cy="10"  r="5" fill="rgba(16,185,129,0.4)" />
        <circle cx="110" cy="210" r="3.5" fill="rgba(16,185,129,0.28)" />
      </g>
      {/* Inner orbit — rotates backward */}
      <g className="mol-orbit-inner">
        <circle cx="172" cy="110" r="4.5" fill="rgba(6,182,212,0.45)" />
        <circle cx="48"  cy="110" r="3.5" fill="rgba(6,182,212,0.3)" />
      </g>
    </svg>
  )
}

/* ── Brand panel illustrations ───────────────────────────────────────── */

function IlloDoctor() {
  return (
    <svg width="108" height="116" viewBox="0 0 108 116" fill="none" aria-hidden="true">
      {/* Earpieces */}
      <circle cx="26" cy="20" r="7" fill="rgba(255,255,255,0.92)" />
      <circle cx="82" cy="20" r="7" fill="rgba(255,255,255,0.92)" />
      {/* Connecting arch */}
      <path d="M26 27 C26 46 26 54 54 56 C82 54 82 46 82 27"
        stroke="rgba(255,255,255,0.78)" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Down tube */}
      <path d="M54 56 L54 80"
        stroke="rgba(255,255,255,0.78)" strokeWidth="5" strokeLinecap="round" />
      {/* Diaphragm ring */}
      <circle cx="54" cy="97" r="18"
        stroke="rgba(255,255,255,0.88)" strokeWidth="3"
        fill="rgba(255,255,255,0.1)" />
      {/* Inner ring */}
      <circle cx="54" cy="97" r="9" fill="rgba(255,255,255,0.22)" />
      {/* Heartbeat / ECG line */}
      <path d="M38 97 L44 97 L47 88 L51 106 L55 88 L58 97 L64 97 L70 97"
        stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <animate attributeName="stroke-dasharray" from="0 120" to="120 0" dur="1.8s" begin="0s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

function IlloPharmacy() {
  return (
    <svg width="108" height="116" viewBox="0 0 108 116" fill="none" aria-hidden="true">
      {/* Medical cross — vertical */}
      <rect x="43" y="6" width="22" height="54" rx="11"
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
      {/* Medical cross — horizontal */}
      <rect x="16" y="22" width="76" height="22" rx="11"
        fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" />
      {/* Cross center highlight */}
      <rect x="43" y="22" width="22" height="22" fill="rgba(255,255,255,0.18)" />

      {/* Pill capsule outer */}
      <rect x="12" y="76" width="84" height="32" rx="16"
        fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.88)" strokeWidth="2.5" />
      {/* Pill left half fill */}
      <path d="M28,76 L54,76 L54,108 L28,108 Q12,108 12,92 Q12,76 28,76 Z"
        fill="rgba(255,255,255,0.28)" />
      {/* Pill divider */}
      <line x1="54" y1="76" x2="54" y2="108" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      {/* Small dots on right half */}
      <circle cx="72" cy="89" r="2.5" fill="rgba(255,255,255,0.35)" />
      <circle cx="80" cy="89" r="2.5" fill="rgba(255,255,255,0.35)" />
      <circle cx="88" cy="89" r="2.5" fill="rgba(255,255,255,0.35)" />
    </svg>
  )
}

/* ── Eye icons for password toggle ──────────────────────────────────── */

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/* ── Role icons (switcher) ───────────────────────────────────────────── */

function IconDoctor() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="5.5" r="3" />
      <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

function IconPharmacy() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="14" height="10" rx="5" />
      <line x1="9" y1="4" x2="9" y2="14" />
      <line x1="2" y1="9" x2="9" y2="9" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function LoginPage() {
  const { login, token, user, loading } = useAuth()
  const navigate = useNavigate()

  const [isDark, setIsDark]         = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [mounted, setMounted]       = useState(false)
  const [role, setRole]             = useState('doctor')
  const [greeting]                  = useState(() => getGreeting())
  const [dayStr]                    = useState(() => getDayStr())
  const [quote, setQuote]           = useState(randomQuote)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]           = useState('')
  const [welcomeUser, setWelcomeUser] = useState(null) // triggers pharmacy welcome overlay

  // Read the session-expired flag set by api.js on 401 redirect, then clear it.
  const [sessionExpired] = useState(() => {
    const flag = sessionStorage.getItem('session_expired')
    if (flag) sessionStorage.removeItem('session_expired')
    return flag
  })

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  /* New quote + clear error on every role switch */
  useEffect(() => {
    setQuote(randomQuote())
    setError('')
  }, [role])

  if (!loading && user) {
    return <Navigate to={user.role === 'pharmacy' ? '/pharmacy' : '/'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const loggedInUser = await login(email, password, role)
      if (loggedInUser.role === 'pharmacy') {
        setWelcomeUser(loggedInUser)
        setSubmitting(false)
        setTimeout(() => navigate('/pharmacy', { replace: true }), 1800)
      } else {
        setWelcomeUser(loggedInUser)
        setSubmitting(false)
        setTimeout(() => navigate('/', { replace: true }), 1800)
      }
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || 'Something went wrong. Please try again.')
      setError(msg)
      setSubmitting(false)
    }
  }

  const canSubmit  = email.trim() && password && !submitting
  const isPharmacy = role === 'pharmacy'

  return (
    <div className={`login-scene${mounted ? ' login-scene--mounted' : ''}`} data-theme={isDark ? 'dark' : 'light'} data-role={role}>

      {/* Theme toggle */}
      <button className="login-theme-toggle" onClick={() => setIsDark(d => !d)}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      {/* Doctor scene decorations */}
      <SunDeco />
      <CloudsDeco />
      <BirdsDeco />
      <StarsDeco />
      <MoonDeco />

      {/* Pharmacy scene decorations */}
      <PillsDeco />
      <CrossesDeco />
      <MoleculeDeco />

      {/* Card */}
      <div className="login-card">

        {/* Left — brand panel */}
        <div className={`login-brand${isPharmacy ? ' login-brand--pharmacy' : ''}`}>
          <div className="login-logo-wrap">
            <img src="/logos/clinoraLogo.png" alt="Clinora" className="login-logo-img" />
          </div>
          <div className="login-brand-text">
            <h1 className="login-title">Clinora</h1>
            <p className="login-subtitle">Medical Records &amp; Prescriptions</p>
          </div>

          {/* Role illustration — both rendered, CSS shows/hides with animation */}
          <div className="login-brand-illo">
            <div className={`login-illo${!isPharmacy ? ' login-illo--visible' : ''}`}>
              <IlloDoctor />
            </div>
            <div className={`login-illo${isPharmacy ? ' login-illo--visible' : ''}`}>
              <IlloPharmacy />
            </div>
          </div>

          <p className="login-slogan">"Your clinic, organized and ready."</p>
        </div>

        {/* Right row 1 — greeting */}
        <div className="login-welcome">
          <span className="login-welcome-label">{greeting}</span>
          {/* key={role} forces re-mount → re-triggers CSS entry animation */}
          <span key={role} className={`login-welcome-sub login-welcome-sub--${role}`}>
            {isPharmacy ? 'Pharmacist' : 'Doctor'}
          </span>
          <span className="login-day">{dayStr}</span>
        </div>

        {/* Right row 2 — form */}
        <form onSubmit={handleSubmit} noValidate className="login-form">

          {/* Session-expired notice — shown when api.js 401 handler redirected here */}
          {sessionExpired && (
            <div role="alert" className="form-alert warning">
              <p className="form-alert-body">
                {sessionExpired === 'inactivity'
                  ? 'Session expired after 2 hours of inactivity. Please sign in again.'
                  : 'Your session has ended. Please sign in again.'}
              </p>
            </div>
          )}

          {/* Role switcher */}
          <div className="login-role-bar">
            <button type="button"
              className={`login-role-btn login-role-btn--doctor${!isPharmacy ? ' login-role-btn--active' : ''}`}
              onClick={() => setRole('doctor')}>
              <IconDoctor /> Doctor
            </button>
            <button type="button"
              className={`login-role-btn login-role-btn--pharmacy${isPharmacy ? ' login-role-btn--active' : ''}`}
              onClick={() => setRole('pharmacy')}>
              <IconPharmacy /> Pharmacy
            </button>
          </div>

          <div className="field-group">
            <label htmlFor="email" className="field-label">Email</label>
            <div className="login-field-wrap">
              <svg className="login-field-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
              </svg>
              <input id="email" className="field login-field-padded" type="email" autoComplete="email"
                placeholder={isPharmacy ? 'pharmacy@clinic.com' : 'doctor@clinic.com'}
                required value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="password" className="field-label">Password</label>
            <div className="login-field-wrap" style={{ position: 'relative' }}>
              <svg className="login-field-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
              <input
                id="password"
                className="field login-field-padded"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={submitting}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--clr-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  lineHeight: 0,
                  opacity: 0.65,
                  transition: 'opacity .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.65'}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="form-alert danger">
              <p className="form-alert-body">{error}</p>
            </div>
          )}

          <button type="submit" className={`login-submit-btn login-submit-btn--${role}`} disabled={!canSubmit}>
            {submitting && <Spinner size={16} />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Right row 3 — quote (key changes on role → re-mounts → fade-in animation) */}
        <div key={role + quote.text} className="login-quote-block">
          <p className="login-quote-text">"{quote.text}"</p>
          {quote.author && <span className="login-quote-author">— {quote.author}</span>}
        </div>

      </div>

      <p className="login-footer">
        Clinora — Offline Medical Records System &middot; Built by{' '}
        <a className="login-footer-link" href="https://k871git.github.io/thaelon" target="_blank" rel="noopener noreferrer">Thaelon</a>
      </p>

      {/* Welcome overlay — pharmacy (teal) or doctor (indigo) */}
      {welcomeUser && welcomeUser.role === 'pharmacy' && (
        <PharmacyLoader
          message={`Welcome, ${welcomeUser.name.split(' ')[0]}`}
          sub="Rx Dispensary · Clinora"
          isDark={isDark}
        />
      )}
      {welcomeUser && welcomeUser.role !== 'pharmacy' && (
        <DoctorLoader
          message={`Welcome, Dr. ${welcomeUser.name.split(' ')[0]}`}
          sub="Clinora — Medical Records"
          isDark={isDark}
        />
      )}
    </div>
  )
}
