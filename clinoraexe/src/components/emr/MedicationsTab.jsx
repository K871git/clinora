import { useNavigate } from 'react-router-dom'
import EmptyState from '../ui/EmptyState'

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
    return <EmptyState compact icon="💊" title="No prescriptions yet" description="Prescriptions from this clinic will appear here." />
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
