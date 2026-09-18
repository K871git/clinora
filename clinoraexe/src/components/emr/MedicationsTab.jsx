import { useNavigate } from 'react-router-dom'

const STATUS_LABEL = {
  draft:            'Draft',
  sent_to_pharmacy: 'Sent to Pharmacy',
  completed:        'Completed',
}
const STATUS_COLOR = {
  draft:            '#3b82f6',
  sent_to_pharmacy: '#f59e0b',
  completed:        '#10b981',
}

function fmtDate(str) {
  if (!str) return '—'
  const utc = str.endsWith('Z') ? str : str + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function MedicationsTab({ prescriptions = [], status }) {
  const navigate = useNavigate()

  if (status === 'loading') {
    return <div className="emr-loading">Loading medications…</div>
  }

  if (!prescriptions.length) {
    return (
      <div className="emr-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 8 }}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
        No prescriptions issued yet.
      </div>
    )
  }

  return (
    <div className="meds-tab">
      {prescriptions.map(rx => {
        const items = rx.items ?? []
        return (
          <div
            key={rx.id}
            className="meds-rx-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/prescriptions/${rx.id}`)}
            onKeyDown={e => e.key === 'Enter' && navigate(`/prescriptions/${rx.id}`)}
          >
            {/* Header row */}
            <div className="meds-rx-header">
              <div className="meds-rx-date">{fmtDate(rx.prescribed_at)}</div>
              <span
                className="meds-rx-status"
                style={{ color: STATUS_COLOR[rx.status] ?? '#6b7280' }}
              >
                {STATUS_LABEL[rx.status] ?? rx.status}
              </span>
            </div>

            {/* Medicine list */}
            {items.length === 0 ? (
              <div className="meds-rx-empty">No medicines recorded</div>
            ) : (
              <ol className="meds-list">
                {items.map((item, idx) => (
                  <li key={item.id ?? idx} className="meds-item">
                    <div className="meds-item-name">{item.medicine_name}</div>
                    {(item.dosage || item.frequency || item.duration) && (
                      <div className="meds-item-meta">
                        {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {item.instructions && (
                      <div className="meds-item-note">{item.instructions}</div>
                    )}
                  </li>
                ))}
              </ol>
            )}

            <div className="meds-rx-footer">
              View prescription →
            </div>
          </div>
        )
      })}
    </div>
  )
}
