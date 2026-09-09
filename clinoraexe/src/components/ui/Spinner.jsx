export default function Spinner({ size = 20, thickness }) {
  const t    = thickness ?? Math.max(2, Math.round(size * 0.1))
  const r    = (size - t * 2) / 2
  const circ = 2 * Math.PI * r
  const arc  = circ * 0.65
  const cx   = size / 2

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
      className="ui-spinner"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* Track */}
      <circle cx={cx} cy={cx} r={r} stroke="currentColor" strokeWidth={t} opacity="0.12" />
      {/* Arc */}
      <circle
        cx={cx} cy={cx} r={r}
        stroke="currentColor" strokeWidth={t}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${circ - arc}`}
        style={{ transformOrigin: `${cx}px ${cx}px`, animation: 'ui-spin 0.72s linear infinite' }}
      />
    </svg>
  )
}
