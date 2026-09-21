export default function EmptyState({ icon, title, description, action, compact }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: compact ? '20px 16px' : '48px 24px',
      textAlign: 'center', color: 'var(--clr-text-muted)',
    }}>
      {icon && (
        <div style={{ fontSize: compact ? 22 : 36, marginBottom: compact ? 6 : 12, opacity: 0.35 }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: compact ? 12.5 : 14, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 4 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: compact ? 11.5 : 13, color: 'var(--clr-text-muted)', maxWidth: compact ? 220 : 320, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && (
        <div style={{ marginTop: compact ? 10 : 16 }}>{action}</div>
      )}
    </div>
  )
}
