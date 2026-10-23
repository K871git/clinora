import '../../styles/pharmacy-loader.css'

/**
 * Full-screen pharmacy transition overlay.
 * Used for login welcome and logout farewell animations.
 * isDark: matches current theme so bg color aligns.
 * fading: add the --out class to trigger exit animation.
 */
export default function PharmacyLoader({ message = 'Loading', sub = '', isDark = false, fading = false }) {
  const cls = [
    'pharma-lscreen',
    isDark ? 'pharma-lscreen--dark' : 'pharma-lscreen--light',
    fading ? 'pharma-lscreen--out' : '',
  ].join(' ')

  return (
    <div className={cls}>
      <div className="pharma-lring-wrap">
        <svg className="pharma-lring" width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
          {/* Outer halo */}
          <circle className="pharma-lhalo" cx="68" cy="68" r="62" />
          {/* Main track */}
          <circle className="pharma-ltrack" cx="68" cy="68" r="52" />
          {/* Primary rotating arc */}
          <circle className="pharma-larc"  cx="68" cy="68" r="52" />
          {/* Inner counter-rotating accent */}
          <circle className="pharma-larc-inner" cx="68" cy="68" r="38" />
          {/* Static accent dots at cardinal positions */}
          <circle className="pharma-ldot" cx="68"  cy="16"  r="3.5" />
          <circle className="pharma-ldot" cx="120" cy="68"  r="3" />
          <circle className="pharma-ldot" cx="68"  cy="120" r="2.5" />
          <circle className="pharma-ldot" cx="16"  cy="68"  r="2" />
        </svg>

        {/* Rx symbol centered in ring */}
        <div className="pharma-lcenter">
          <svg width="34" height="34" viewBox="0 0 52 52" fill="none" stroke="currentColor"
            strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 8 v36" />
            <path d="M10 8 h16 a13 13 0 0 1 0 22 H10" />
            <path d="M26 30 L44 46" />
          </svg>
        </div>
      </div>

      <div className="pharma-ltext">
        <span className="pharma-lmsg">{message}</span>
        {sub && <span className="pharma-lsub">{sub}</span>}
      </div>
    </div>
  )
}
