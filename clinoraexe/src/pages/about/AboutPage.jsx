import '../../styles/about.css'

/* ── Social icon SVGs ─────────────────────────────────────────────────────── */

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function IconLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function IconEmail() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconWhatsAppSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

/* ── Data ─────────────────────────────────────────────────────────────────── */

const SOCIALS = [
  { label: 'GitHub',    href: 'https://github.com/K871git',               Icon: IconGitHub,    cls: 'abt-social-btn--github'    },
  { label: 'LinkedIn',  href: 'https://linkedin.com/in/kishor-gangarde',  Icon: IconLinkedIn,  cls: 'abt-social-btn--linkedin'  },
  { label: 'WhatsApp',  href: 'https://wa.me/917499621927',               Icon: IconWhatsApp,  cls: 'abt-social-btn--whatsapp'  },
  { label: 'Instagram', href: 'https://instagram.com/_kishor_k871',       Icon: IconInstagram, cls: 'abt-social-btn--instagram' },
  { label: 'X',         href: 'https://twitter.com/KishorGangarde1',      Icon: IconX,         cls: 'abt-social-btn--x'         },
  { label: 'Facebook',  href: 'https://facebook.com/kishor.gangarde.773', Icon: IconFacebook,  cls: 'abt-social-btn--facebook'  },
]

const FEATURES = [
  { label: '🏥  Offline-first',    cls: 'abt-chip--teal'   },
  { label: '🇮🇳  Built for India',  cls: 'abt-chip--orange' },
  { label: '🔒  Privacy-first',    cls: 'abt-chip--green'  },
  { label: '⚡  Tauri + Rust',     cls: 'abt-chip--rust'   },
  { label: '🗄️  Local MySQL',      cls: 'abt-chip--blue'   },
  { label: '📄  PDF Prescriptions',cls: 'abt-chip--purple' },
]

export default function AboutPage() {
  return (
    <div className="abt-page">

      {/* ── Hero ── */}
      <div className="abt-hero">
        <img src="/logos/clinoraLogo.png" alt="Clinora" className="abt-logo-img" />
        <h1 className="abt-app-name">Clinora</h1>
        <div className="abt-version-row">
          <span className="abt-version-badge">v1.2.0</span>
          <span className="abt-pill">Clinic Management System</span>
          <span className="abt-pill">Desktop · Windows</span>
        </div>
        <p className="abt-tagline">
          A complete EMR for independent clinics — fast, offline, and built with care.
        </p>
      </div>

      {/* ── About Clinora ── */}
      <div className="abt-card">
        <div className="abt-card-head">
          <span className="abt-section-label">About Clinora</span>
        </div>
        <div className="abt-about-body">
          <p className="abt-desc">
            Clinora is a desktop Electronic Medical Record (EMR) system built for small to mid-size
            clinics in India. It runs entirely on your local machine — no cloud, no subscriptions,
            no internet required. Patient data never leaves your clinic.
          </p>
          <p className="abt-desc" style={{ marginBottom: 0 }}>
            From patient registration and OPD management to prescriptions, billing, pharmacy dispensing,
            and revenue analytics — everything a clinic needs, in one lightweight app.
          </p>
          <div className="abt-features">
            {FEATURES.map(({ label, cls }) => (
              <span key={label} className={`abt-feature-chip ${cls}`}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Built by ── */}
      <div className="abt-card">
        <div className="abt-card-head">
          <span className="abt-section-label">Built by</span>
        </div>

        {/* Bio block — tinted */}
        <div className="abt-builder">
          <div className="abt-avatar">K</div>
          <div>
            <div className="abt-builder-name">Kishor Gangarde</div>
            <div className="abt-builder-role">Founder &amp; Solo Developer</div>
            <div className="abt-builder-company">Thaelon · "Imagine. Engineer. Evolve."</div>
          </div>
        </div>

        {/* Socials block — separated */}
        <div className="abt-socials-zone">
          <div className="abt-socials-label">Connect</div>
          <div className="abt-socials">
            {SOCIALS.map(({ label, href, Icon, cls }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`abt-social-btn ${cls}`}
                aria-label={label}
              >
                <Icon />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Thaelon ── */}
      <div className="abt-card">
        <div className="abt-card-head">
          <span className="abt-section-label">Built at Thaelon</span>
        </div>
        <div className="abt-thaelon">
          <a
            href="https://k871git.github.io/thaelon"
            target="_blank"
            rel="noopener noreferrer"
            className="abt-thaelon-badge"
          >
            THAELON
          </a>
          <div className="abt-thaelon-content">
            <div className="abt-thaelon-motto">"Imagine. Engineer. Evolve."</div>
            <p className="abt-thaelon-desc">
              A future-facing engineering team building intelligent products — from AI pipelines
              and full-stack apps to desktop tools that actually ship. Clinora is one of them.
            </p>
          </div>
        </div>
      </div>

      {/* ── Contact ── */}
      <div className="abt-card">
        <div className="abt-card-head">
          <span className="abt-section-label">Get in Touch</span>
        </div>
        <div className="abt-contact-body">
          <div className="abt-contact-options">
            <a href="mailto:gangardekishor87@gmail.com" className="abt-contact-btn abt-contact-btn--email">
              <span className="abt-contact-btn-icon"><IconEmail /></span>
              <span className="abt-contact-btn-label">Email</span>
              <span className="abt-contact-btn-value">gangardekishor87@gmail.com</span>
            </a>
            <a href="https://wa.me/917499621927" target="_blank" rel="noopener noreferrer" className="abt-contact-btn abt-contact-btn--whatsapp">
              <span className="abt-contact-btn-icon"><IconWhatsAppSmall /></span>
              <span className="abt-contact-btn-label">WhatsApp</span>
              <span className="abt-contact-btn-value">+91 74996 21927</span>
            </a>
            <a href="tel:+917499621927" className="abt-contact-btn abt-contact-btn--call">
              <span className="abt-contact-btn-icon"><IconPhone /></span>
              <span className="abt-contact-btn-label">Call</span>
              <span className="abt-contact-btn-value">+91 74996 21927</span>
            </a>
          </div>
          <p className="abt-contact-note">
            Found a bug or have a suggestion? Reach out directly — there's no support team,
            just one developer who genuinely wants Clinora to work well for your clinic.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="abt-footer-strip">
        Made with focus by <strong>Kishor Gangarde</strong> · Clinora v1.2.0 · © 2026 Thaelon
      </div>

    </div>
  )
}
