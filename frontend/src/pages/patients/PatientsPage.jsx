import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from 'datatables.net-react'
import DT from 'datatables.net-bs5'
import 'datatables.net-bs5/css/dataTables.bootstrap5.min.css'
import 'datatables.net-buttons-bs5'
import 'datatables.net-buttons-bs5/css/buttons.bootstrap5.min.css'
import 'datatables.net-buttons/js/buttons.html5.mjs'
import 'datatables.net-buttons/js/buttons.print.mjs'
import JSZip from 'jszip'
import { listPatients } from '../../services/patientService'
import PatientFormModal from './PatientFormModal'
import Spinner from '../../components/ui/Spinner'
import '../../styles/patients.css'

DataTable.use(DT)
window.JSZip = JSZip

/* ── Helpers ─────────────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6']
const avatarColor  = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const isNew        = (d)    => Date.now() - new Date(d).getTime() < 2 * 24 * 60 * 60 * 1000
const fmtDate      = (s)    => s
  ? new Date(s).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })
  : null
const capitalize   = (s)    => s ? s[0].toUpperCase() + s.slice(1) : null
const stripHtml    = (s)    => s.replace(/<[^>]+>/g, '').trim()

/* ── DataTables column definitions ──────────────────────────────────── */

const COLUMNS = [
  {
    title: 'Patient',
    data:  null,
    render(data, type, row) {
      if (type !== 'display') return row.name
      const color = avatarColor(row.name)
      const badge = isNew(row.created_at)
        ? '<span class="badge bg-success ms-2 fw-normal" style="font-size:.62rem;letter-spacing:.02em">New</span>'
        : ''
      return `<div class="d-flex align-items-center gap-2">
        <div class="pt-avatar" style="background:${color}">${row.name[0].toUpperCase()}</div>
        <span class="fw-semibold">${row.name}${badge}</span>
      </div>`
    },
  },
  {
    title: 'Contact',
    data:  'mobile',
    defaultContent: '<span class="text-muted">—</span>',
  },
  {
    title: 'Age',
    data:  'age',
    render(d, type) {
      if (type !== 'display') return d ?? ''
      return d != null ? `${d} yrs` : '<span class="text-muted">—</span>'
    },
  },
  {
    title: 'Gender',
    data:  'gender',
    render(d, type) {
      if (type !== 'display') return d ?? ''
      return capitalize(d) ?? '<span class="text-muted">—</span>'
    },
  },
  {
    title: 'Last Visit',
    data:  'last_visit_at',
    render(d, type) {
      if (type !== 'display') return d ?? ''
      return d ? fmtDate(d) : '<span class="text-muted">Never</span>'
    },
  },
]

/* strip HTML so exports are clean */
const exportFormat = {
  body: (d) => typeof d === 'string' ? stripHtml(d) : d,
}

const DT_OPTIONS = {
  dom: "<'pt-dt-top'Bf>rt<'pt-dt-bottom'lip>",

  buttons: [
    {
      extend:        'copy',
      text:          '⎘ Copy',
      className:     'pt-exp-btn',
      exportOptions: { format: exportFormat },
    },
    {
      extend:        'csv',
      text:          '↓ CSV',
      className:     'pt-exp-btn',
      exportOptions: { format: exportFormat },
    },
    {
      extend:        'excel',
      text:          '↓ Excel',
      className:     'pt-exp-btn pt-exp-btn--excel',
      exportOptions: { format: exportFormat },
    },
    {
      extend:    'print',
      text:      '⎙ Print',
      className: 'pt-exp-btn',
    },
  ],

  pageLength:  15,
  lengthMenu:  [10, 15, 25, 50, 100],
  order:       [[0, 'asc']],

  language: {
    search:         '',
    searchPlaceholder: 'Search patients…',
    lengthMenu:     'Show _MENU_',
    info:           'Showing _START_–_END_ of _TOTAL_',
    infoEmpty:      'No patients',
    infoFiltered:   '(filtered from _MAX_)',
    paginate:       { previous: '‹ Prev', next: 'Next ›' },
    emptyTable:     'No patients registered yet.',
    zeroRecords:    'No patients match your search.',
  },

  columnDefs: [
    { targets: [2, 3, 4], className: 'text-muted' },
  ],
}

/* ── Page ───────────────────────────────────────────────────────────── */

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [status,   setStatus]   = useState('loading')
  const [showAdd,  setShowAdd]  = useState(
    () => new URLSearchParams(window.location.search).get('new') === '1'
  )

  useEffect(() => {
    if (window.location.search.includes('new=1'))
      window.history.replaceState({}, '', window.location.pathname)

    listPatients({ per_page: 1000 })
      .then(({ data }) => {
        setPatients(data.data ?? [])
        setStatus('done')
      })
      .catch(() => setStatus('error'))
  }, [])

  /* row click → patient detail */
  const createdRow = (row, data) => {
    row.style.cursor = 'pointer'
    row.tabIndex = 0
    row.addEventListener('click', () => navigate(`/patients/${data.id}`))
    row.addEventListener('keydown', (e) => e.key === 'Enter' && navigate(`/patients/${data.id}`))
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pt-header">
        <div className="pt-header-left">
          <h1 className="pt-title">Patients</h1>
          {patients.length > 0 && (
            <span className="pt-count-badge">{patients.length.toLocaleString()}</span>
          )}
        </div>
        <button className="btn-primary pt-add-btn" onClick={() => setShowAdd(true)}>
          <IconPlus /> Add Patient
        </button>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {status === 'loading' && (
        <div className="d-flex justify-content-center align-items-center py-5">
          <Spinner size={28} />
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="card state-panel">
          Could not load patients — check your connection.
        </div>
      )}

      {/* ── DataTable ──────────────────────────────────────────────────── */}
      {status === 'done' && (
        <div className="card p-3 pt-table-wrap">
          <DataTable
            className="table table-hover align-middle w-100"
            data={patients}
            columns={COLUMNS}
            options={{ ...DT_OPTIONS, createdRow }}
          >
            <thead>
              <tr>
                <th>Patient</th>
                <th>Contact</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Last Visit</th>
              </tr>
            </thead>
          </DataTable>
        </div>
      )}

      {/* ── Add modal ──────────────────────────────────────────────────── */}
      {showAdd && (
        <PatientFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(p) => { setShowAdd(false); navigate(`/patients/${p.id}`) }}
        />
      )}
    </div>
  )
}

function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M7.5 1v13M1 7.5h13" />
    </svg>
  )
}
