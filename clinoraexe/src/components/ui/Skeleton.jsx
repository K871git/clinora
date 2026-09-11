export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonTable({ rows = 6, cols = 4 }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {/* Header */}
      <div className="skeleton-table-head">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={i === 0 ? '30%' : `${Math.floor(60 / cols)}%`} height={12} radius={4} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              width={c === 0 ? `${55 + ((r * 7 + c * 13) % 30)}%` : `${30 + ((r * 11 + c * 17) % 40)}%`}
              height={13}
              radius={4}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <Skeleton width="40%" height={14} radius={4} style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={11} radius={4} style={{ marginTop: 8 }} />
      ))}
    </div>
  )
}
