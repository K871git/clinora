import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import BackgroundShapes from '../components/ui/BackgroundShapes'
import PharmacyLoader from '../components/ui/PharmacyLoader'
import DoctorLoader from '../components/ui/DoctorLoader'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import profileService from '../services/profileService'
import { searchPatients } from '../services/patientService'
import { getClinicVisits } from '../services/visitService'
import '../styles/app-layout.css'

/* ── Offline detection ───────────────────────────────────────────────── */
function subscribe(cb) {
  window.addEventListener('online',  cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}
function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
      </svg>
      No internet connection — working on LAN only
    </div>
  )
}

const STORAGE_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/api$/, '') + '/storage'
function avatarUrl(path) { return path ? `${STORAGE_BASE}/${path}` : null }

const DOCTOR_NAV = [
  { to: '/',              label: 'Dashboard',    icon: IconDashboard },
  { to: '/patients',      label: 'Patients',     icon: IconPatients },
  { to: '/opd',           label: 'OPD',          icon: IconClipboard },
  { to: '/appointments',  label: 'Appointments', icon: IconCalendar },
  { to: '/prescriptions', label: 'Prescriptions',icon: IconPrescription },
  { to: '/medicines',     label: 'Medicines',    icon: IconMedicines },
  { to: '/revenue',       label: 'Revenue',      icon: IconRevenue },
  { to: '/games',         label: 'Games',        icon: IconGames },
  { to: '/notes',         label: 'Notes',        icon: IconNotes },
]

const PHARMACY_NAV = [
  { to: '/pharmacy',         label: 'Queue',   icon: IconQueue,   end: true },
  { to: '/pharmacy/history', label: 'History', icon: IconHistory },
  { to: '/pharmacy/stock',   label: 'Stock',   icon: IconStock },
  { to: '/pharmacy/revenue', label: 'Revenue', icon: IconRevenue },
  { to: '/pharmacy/notes',   label: 'Notes',   icon: IconNotes },
  { to: '/pharmacy/games',   label: 'Games',   icon: IconGames },
]

const PAGE_TITLES = {
  '/':                    'Dashboard',
  '/patients':            'Patients',
  '/prescriptions':       'Prescriptions',
  '/medicines':           'Medicine Library',
  '/settings':            'Settings',
  '/profile':             'My Profile',
  '/pharmacy':            'Queue',
  '/pharmacy/history':    'History',
  '/pharmacy/stock':      'Stock',
  '/pharmacy/settings':   'Settings',
  '/visits':              'Visits',
  '/pharmacy/help':       'How to Use',
  '/help':                'How to Use',
  '/revenue':             'Revenue',
  '/pharmacy/revenue':    'Revenue',
  '/appointments':        'Appointments',
  '/opd':                 'OPD Register',
  '/notes':               'My Notes',
  '/pharmacy/notes':      'My Notes',
  '/games':               'Game Room',
  '/games/snake':         'Snake',
  '/games/tetris':        'Tetris',
  '/games/flappy':        'Flappy Bird',
  '/pharmacy/games':      'Game Room',
  '/pharmacy/games/snake':'Snake',
  '/pharmacy/games/tetris':'Tetris',
  '/pharmacy/games/flappy':'Flappy Bird',
}

export default function AppLayout() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [collapsed, setCollapsed]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [farewell, setFarewell]             = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [dbError, setDbError]         = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const profileRef = useRef(null)
  const avatarFileRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
        return
      }
      // Single-key shortcuts — skip when typing in inputs
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (document.activeElement?.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const role = user?.role
      switch (e.key) {
        case 'n': case 'N':
          e.preventDefault()
          navigate(role === 'pharmacy' ? '/pharmacy' : '/patients?new=1')
          break
        case 'p': case 'P':
          e.preventDefault()
          navigate(role === 'pharmacy' ? '/pharmacy/history' : '/prescriptions')
          break
        case 'd': case 'D':
          e.preventDefault()
          navigate(role === 'pharmacy' ? '/pharmacy' : '/')
          break
        case 'r': case 'R':
          e.preventDefault()
          navigate(role === 'pharmacy' ? '/pharmacy/revenue' : '/revenue')
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, user?.role])

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('clinora-theme')
    if (saved) return saved === 'dark'
    // No saved preference — follow device; returns false (light) when no device preference is set
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    localStorage.setItem('clinora-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    function handleDbError() { setDbError(true) }
    window.addEventListener('clinora:db-error', handleDbError)
    return () => window.removeEventListener('clinora:db-error', handleDbError)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.role = user?.role === 'pharmacy' ? 'pharmacy' : 'doctor'
    return () => { delete document.documentElement.dataset.role }
  }, [user?.role])

  /* Close profile modal on outside click */
  useEffect(() => {
    if (!profileOpen) return
    function onDown(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [profileOpen])

  const navItems = user?.role === 'pharmacy' ? PHARMACY_NAV : DOCTOR_NAV
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Clinora'

  async function handleLogout() {
    setProfileOpen(false)
    setFarewell(true)
    await new Promise(r => setTimeout(r, 1600))
    await logout()
    navigate('/login', { replace: true })
  }

  function goSettings() {
    setProfileOpen(false)
    navigate(user?.role === 'pharmacy' ? '/pharmacy/settings' : '/settings')
  }

  function goHelp() {
    setProfileOpen(false)
    navigate(user?.role === 'pharmacy' ? '/pharmacy/help' : '/help')
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const { data } = await profileService.uploadAvatar(file)
      updateUser(data.user)
    } catch { /* silent */ } finally {
      setAvatarUploading(false)
      if (avatarFileRef.current) avatarFileRef.current.value = ''
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

  const imgSrc = avatarUrl(user?.avatar)

  return (
    <div>
      {/* Farewell overlay — role-specific */}
      {farewell && user?.role === 'pharmacy' && (
        <PharmacyLoader
          message="See you soon"
          sub={user?.name?.split(' ')[0]}
          isDark={isDark}
        />
      )}
      {farewell && user?.role !== 'pharmacy' && (
        <DoctorLoader
          message="Goodbye"
          sub={`Dr. ${user?.name?.split(' ')[0]}`}
          isDark={isDark}
        />
      )}
      <OfflineBanner />
      <NavProgress />
      <Toaster
        position="top-right"
        richColors
        toastOptions={{ style: { fontFamily: 'inherit', fontSize: '14px' } }}
      />
      <BackgroundShapes pharmacy={user?.role === 'pharmacy'} />

      {/* Mobile overlay */}
      <div
        className={`shell-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`shell-sidebar${mobileOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo-area">
            <img
              src={collapsed ? '/logos/logo1.png' : '/logos/brand2.png'}
              alt="Clinora"
              className="sidebar-logo-img"
            />
            {/* Expand button — visible on hover when collapsed only */}
            <button
              className="sidebar-expand-btn"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
            >
              <IconPanelLeft collapsed={true} />
            </button>
          </div>
        </div>

        {/* Pharmacy brand label — pharmacy users only */}
        {user?.role === 'pharmacy' && (
          <div className="pharmacy-nav-brand">
            <IconRx />
            <span className="pharmacy-nav-brand-label">Rx Dispensary</span>
          </div>
        )}

        {/* Nav links */}
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end ?? false}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={label}
            >
              <span className="nav-icon-wrap"><Icon /></span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="sidebar-user" ref={profileRef}>

          {/* Profile popup modal */}
          {profileOpen && (
            <div className={`profile-menu${collapsed ? ' profile-menu--collapsed' : ''}`}>
              {/* User header */}
              <div className="profile-menu-head">
                {/* Avatar — clickable to upload a new photo */}
                <div className="profile-menu-avatar-wrap">
                  <label
                    className={`profile-menu-avatar profile-menu-avatar--upload${avatarUploading ? ' profile-menu-avatar--busy' : ''}`}
                    htmlFor="pm-avatar-input"
                    title="Change photo"
                  >
                    {imgSrc
                      ? <img src={imgSrc} alt={user?.name} className="profile-menu-avatar-img" />
                      : <span>{user?.name?.[0]?.toUpperCase() ?? '?'}</span>
                    }
                    {!avatarUploading && (
                      <span className="profile-menu-avatar-cam" aria-hidden="true">
                        <IconCamera />
                      </span>
                    )}
                    {avatarUploading && <span className="pm-avatar-spinner" aria-hidden="true" />}
                  </label>
                  <input
                    id="pm-avatar-input"
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleAvatarUpload}
                    disabled={avatarUploading}
                  />
                </div>

                <div className="profile-menu-info">
                  <span className="profile-menu-name">{user?.name}</span>
                  <span className="profile-menu-role">
                    {user?.role === 'pharmacy' ? 'Pharmacy' : 'Doctor'}
                  </span>
                  {user?.avatar && !avatarUploading && (
                    <button className="pm-remove-photo" onClick={handleAvatarRemove}>
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              <div className="profile-menu-sep" />

              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); navigate('/profile') }}>
                <IconUser /> Profile
              </button>
              <button className="profile-menu-item" onClick={goSettings}>
                <IconSettings /> {user?.role === 'pharmacy' ? 'Dispensary Settings' : 'Settings'}
              </button>

              <div className="profile-menu-sep" />

              <button className="profile-menu-item" onClick={goHelp}>
                <IconHelp /> {user?.role === 'pharmacy' ? 'How to Use' : 'Help'}
                <span className="profile-menu-item-arrow"><IconChevronRight /></span>
              </button>

              <div className="profile-menu-sep" />

              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); navigate('/privacy-policy') }}>
                <IconShield /> Privacy Policy
              </button>
              <button className="profile-menu-item" onClick={() => { setProfileOpen(false); navigate('/terms') }}>
                <IconDoc /> Terms &amp; Conditions
              </button>

              <div className="profile-menu-sep" />

              <button className="profile-menu-item profile-menu-item--danger" onClick={handleLogout}>
                <IconLogout /> Log out
              </button>
            </div>
          )}

          {/* Clickable profile row — opens modal */}
          <button
            className="sidebar-profile-btn"
            onClick={() => setProfileOpen(o => !o)}
          >
            <UserAvatar imgSrc={imgSrc} name={user?.name} />
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{user?.name}</p>
              <p className="sidebar-user-role">
                {user?.role === 'pharmacy' ? 'Pharmacy' : 'Doctor'}
              </p>
            </div>
            <span className="sidebar-profile-arrow"><IconChevronRight /></span>
          </button>

          {/* Collapse button — hidden when already collapsed */}
          <button
            className="nav-link sidebar-collapse-row"
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
          >
            <IconPanelLeft collapsed={false} />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className={`shell-main${collapsed ? ' sidebar-collapsed' : ''}`}>
        <header className="shell-header">
          {/* Hamburger — mobile only */}
          <button
            className="icon-btn mobile-only"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <IconMenu />
          </button>

          <h1 className="shell-page-title">{pageTitle}</h1>

          {/* Search trigger */}
          <button
            className="gs-trigger-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Global search (Ctrl+K)"
            title="Search (Ctrl+K)"
          >
            <IconSearch />
            <span className="gs-trigger-label">Search</span>
            <kbd className="gs-trigger-kbd">Ctrl K</kbd>
          </button>

          {/* Theme toggle */}
          <button
            className="icon-btn"
            onClick={() => setIsDark(d => !d)}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
          >
            {isDark ? <IconSun /> : <IconMoon />}
          </button>

          {/* User chip */}
          <div className="shell-user-chip">
            <UserAvatar imgSrc={imgSrc} name={user?.name} />
            <span className="shell-user-name">{user?.name}</span>
          </div>
        </header>

        {dbError && (
          <div style={{
            background: '#fef2f2', borderBottom: '1px solid #fecaca',
            padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: '#7f1d1d', zIndex: 100, flexShrink: 0,
          }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span style={{ flex: 1 }}>
              <strong>Database connection lost.</strong> Check that MySQL is running, then refresh the app.
            </span>
            <button
              onClick={() => setDbError(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7f1d1d', lineHeight: 1 }}
              title="Dismiss"
            >×</button>
          </div>
        )}

        <main className="shell-content">
          <ErrorBoundary key={location.key}>
            <div className="page-enter">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {searchOpen && (
        <GlobalSearch
          role={user?.role}
          onClose={() => setSearchOpen(false)}
          onNavigate={(path) => { setSearchOpen(false); navigate(path) }}
        />
      )}
    </div>
  )
}

/* ─── Global Search Palette ──────────────────────────────────────────── */

function GlobalSearch({ role, onClose, onNavigate }) {
  const [q, setQ]           = useState('')
  const [patients, setPatients] = useState([])
  const [visits,   setVisits]   = useState([])
  const [busy,     setBusy]     = useState(false)
  const [cursor,   setCursor]   = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!q.trim()) { setPatients([]); setVisits([]); setBusy(false); return }
    setBusy(true)
    timerRef.current = setTimeout(async () => {
      try {
        const [pRes, vRes] = await Promise.all([
          searchPatients(q.trim()),
          role !== 'pharmacy'
            ? getClinicVisits({ q: q.trim(), per_page: 5 })
            : Promise.resolve({ data: { data: [] } }),
        ])
        setPatients(pRes.data?.data ?? [])
        setVisits(vRes.data?.data ?? [])
        setCursor(0)
      } catch { /* silent */ } finally {
        setBusy(false)
      }
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [q, role])

  const results = [
    ...patients.map(p => ({ type: 'patient', id: p.id, label: p.name, sub: p.mobile || (p.age ? `${p.age} yrs` : ''), path: `/patients/${p.id}` })),
    ...visits.map(v => ({ type: 'visit', id: v.id, label: v.patient?.name ?? '—', sub: v.visited_at ? new Date(v.visited_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '', path: `/patients/${v.patient_id}` })),
  ]

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) onNavigate(results[cursor].path)
  }

  return (
    <div className="gs-backdrop" onClick={onClose}>
      <div className="gs-palette" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Global search">
        <div className="gs-input-row">
          <svg className="gs-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="gs-input"
            type="search"
            placeholder="Search patients or visits…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            spellCheck={false}
          />
          {busy && <span className="gs-spinner" aria-hidden="true" />}
          <kbd className="gs-esc-hint" onClick={onClose}>Esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="gs-results">
            {patients.length > 0 && (
              <div className="gs-group-label">Patients</div>
            )}
            {patients.map((p, i) => {
              const item = results[i]
              return (
                <button key={`p-${p.id}`} className={`gs-item${cursor === i ? ' gs-item--on' : ''}`}
                  onClick={() => onNavigate(item.path)}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span className="gs-item-icon gs-item-icon--patient">🧑‍⚕️</span>
                  <span className="gs-item-label">{p.name}</span>
                  {item.sub && <span className="gs-item-sub">{item.sub}</span>}
                  <span className="gs-item-arrow">→</span>
                </button>
              )
            })}

            {visits.length > 0 && (
              <div className="gs-group-label">Visits</div>
            )}
            {visits.map((v, i) => {
              const idx = patients.length + i
              const item = results[idx]
              return (
                <button key={`v-${v.id}`} className={`gs-item${cursor === idx ? ' gs-item--on' : ''}`}
                  onClick={() => onNavigate(item.path)}
                  onMouseEnter={() => setCursor(idx)}
                >
                  <span className="gs-item-icon">📋</span>
                  <span className="gs-item-label">{v.patient?.name ?? '—'}</span>
                  {item.sub && <span className="gs-item-sub">{item.sub}</span>}
                  <span className="gs-item-arrow">→</span>
                </button>
              )
            })}
          </div>
        )}

        {q.trim() && !busy && results.length === 0 && (
          <div className="gs-empty">No results for "{q}"</div>
        )}

        {!q.trim() && (
          <div className="gs-hint-row">
            <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Top navigation progress bar ───────────────────────────────────── */

function NavProgress() {
  const location = useLocation()
  const [active, setActive] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    setActive(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActive(false), 550)
    return () => clearTimeout(timerRef.current)
  }, [location.key])

  return <div className={`nav-progress${active ? ' nav-progress--on' : ''}`} aria-hidden="true" />
}

/* ─── Avatar helper ──────────────────────────────────────────────────── */

function UserAvatar({ imgSrc, name, className = 'shell-avatar' }) {
  if (imgSrc) {
    return <img src={imgSrc} alt={name} className={`${className} shell-avatar--photo`} />
  }
  return <span className={className}>{name?.[0]?.toUpperCase() ?? '?'}</span>
}

/* ─── Icons ──────────────────────────────────────────────────────────── */

function IconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconChevron({ collapsed }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>
      <path d="M10 12L6 8l4-4" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 12l4-4-4-4" />
    </svg>
  )
}

/* Panel-left icon — indicates sidebar collapse direction */
function IconPanelLeft({ collapsed }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="1" width="16" height="16" rx="2" />
      <path d="M6 1v16" />
      {collapsed
        ? <path d="M10 6l3 3-3 3" />
        : <path d="M13 6l-3 3 3 3" />}
    </svg>
  )
}

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1"  x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function IconVisits() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="14" height="13" rx="2" />
      <path d="M6 1v4M12 1v4M2 8h14" />
      <path d="M6 12h2M10 12h2M6 14.5h1" />
    </svg>
  )
}

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="11" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  )
}

function IconPatients() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="5.5" r="3" />
      <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" />
    </svg>
  )
}

function IconPrescription() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="1" width="12" height="16" rx="2" />
      <path d="M6 6h6M6 9h6M6 12h4" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.05 3.05l1.41 1.41M13.54 13.54l1.41 1.41M3.05 14.95l1.41-1.41M13.54 4.46l1.41-1.41" />
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

function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="9" r="8" />
      <path d="M6.5 6.5a2.5 2.5 0 0 1 5 .833c0 1.667-2.5 2.083-2.5 2.917" />
      <circle cx="9" cy="13" r=".5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 16H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4" />
      <path d="M12 13l4-4-4-4" />
      <path d="M16 9H7" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 4h14M2 9h14M2 14h14" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

function IconQueue() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="14" height="4" rx="1.5" />
      <rect x="2" y="9" width="10" height="3" rx="1.5" />
      <circle cx="15" cy="10.5" r="2" strokeWidth="1.6" />
      <path d="M13.5 14.5 L16.5 14.5" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconMedicines() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="18" rx="4" />
      <rect x="13" y="3" width="8" height="18" rx="4" />
      <line x1="3" y1="12" x2="11" y2="12" />
      <line x1="13" y1="12" x2="21" y2="12" />
    </svg>
  )
}

function IconStock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function IconRevenue() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="5" width="16" height="11" rx="1.5" />
      <circle cx="9" cy="10.5" r="2" />
      <path d="M1 8.5h3M14 8.5h3" />
    </svg>
  )
}

function IconRx() {
  return (
    <svg width="17" height="17" viewBox="0 0 52 52" fill="none" stroke="currentColor"
      strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 8 v36" />
      <path d="M10 8 h16 a13 13 0 0 1 0 22 H10" />
      <path d="M26 30 L44 46" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconGames() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M8 12h4M10 10v4" />
      <circle cx="16" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconNotes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  )
}
