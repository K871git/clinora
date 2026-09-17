export default function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center', color: 'var(--clr-text-muted)',
    }}>
      {icon && (
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-text)', marginBottom: 4 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--clr-text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && (
        <div style={{ marginTop: 16 }}>{action}</div>
      )}
    </div>
  )
}
