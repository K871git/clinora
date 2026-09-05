import '../../styles/doctor-loader.css'

export default function DoctorLoader({ message = 'Loading', sub = '', isDark = false, fading = false }) {
  const cls = [
    'dr-lscreen',
    isDark ? 'dr-lscreen--dark' : 'dr-lscreen--light',
    fading  ? 'dr-lscreen--out'  : '',
  ].join(' ')

  return (
    <div className={cls}>
      <div className="dr-lring-wrap">
        <svg className="dr-lring" width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
          <circle className="dr-lhalo" cx="68" cy="68" r="62" />
          <circle className="dr-ltrack" cx="68" cy="68" r="52" />
          <circle className="dr-larc"   cx="68" cy="68" r="52" />
          <circle className="dr-larc-inner" cx="68" cy="68" r="38" />
          <circle className="dr-ldot" cx="68"  cy="16"  r="3.5" />
          <circle className="dr-ldot" cx="120" cy="68"  r="3" />
          <circle className="dr-ldot" cx="68"  cy="120" r="2.5" />
          <circle className="dr-ldot" cx="16"  cy="68"  r="2" />
        </svg>

        {/* Stethoscope icon centered in ring */}
        <div className="dr-lcenter">
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Earpieces */}
            <line x1="8"  y1="4" x2="8"  y2="10" />
            <line x1="24" y1="4" x2="24" y2="10" />
            {/* Arch */}
            <path d="M8 10 Q8 17 16 17 Q24 17 24 10" />
            {/* Tube */}
            <path d="M16 17 Q16 25 22 25" />
            {/* Chest piece */}
            <circle cx="22" cy="25" r="3" />
            {/* Earpiece tips */}
            <circle cx="8"  cy="3.5" r="1.8" fill="currentColor" stroke="none" />
            <circle cx="24" cy="3.5" r="1.8" fill="currentColor" stroke="none" />
          </svg>
        </div>
      </div>

      <div className="dr-ltext">
        <span className="dr-lmsg">{message}</span>
        {sub && <span className="dr-lsub">{sub}</span>}
      </div>
    </div>
  )
}
