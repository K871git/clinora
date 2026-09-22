export default function EmptyState({ icon, title, description, action, compact }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact ? '28px 20px' : '60px 28px',
      textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: compact ? 40 : 56,
          height: compact ? 40 : 56,
          borderRadius: compact ? 10 : 14,
          background: 'color-mix(in srgb, var(--clr-primary) 9%, var(--clr-surface))',
          border: '1px solid color-mix(in srgb, var(--clr-primary) 18%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? 20 : 26,
          marginBottom: compact ? 14 : 20,
          flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
      <div style={{
        fontSize: compact ? 13.5 : 15,
        fontWeight: 600,
        color: 'var(--clr-text)',
        marginBottom: compact ? 5 : 7,
        letterSpacing: '-0.15px',
        lineHeight: 1.3,
      }}>
        {title}
      </div>
      {description && (
        <div style={{
          fontSize: compact ? 12 : 13.5,
          color: 'var(--clr-text-muted)',
          maxWidth: compact ? 240 : 360,
          lineHeight: 1.6,
        }}>
          {description}
        </div>
      )}
      {action && (
        <div style={{ marginTop: compact ? 14 : 22 }}>{action}</div>
      )}
    </div>
  )
}
