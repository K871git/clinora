import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { listPatientNotes, createNote, updateNote, deleteNote } from '../../services/notesService'

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PatientNotesTab({ patientId, userRole }) {
  const [notes,   setNotes]   = useState([])
  const [loading, setLoading] = useState(true)
  const [active,  setActive]  = useState(null)
  const [body,    setBody]    = useState('')
  const [title,   setTitle]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [adding,  setAdding]  = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    listPatientNotes(patientId)
      .then(({ data }) => { setNotes(data); setLoading(false) })
      .catch(() => { toast.error('Could not load notes'); setLoading(false) })
  }, [patientId])

  function openNote(note) {
    setActive(note)
    setTitle(note.title || '')
    setBody(note.body || '')
    setAdding(false)
  }

  function startNew() {
    setActive(null)
    setTitle('')
    setBody('')
    setAdding(true)
  }

  async function handleCreate() {
    if (!title.trim() && !body.trim()) { toast.error('Note cannot be empty'); return }
    setSaving(true)
    try {
      const { data } = await createNote({ title: title.trim(), body, role: userRole || 'doctor', patient_id: patientId })
      setNotes(prev => [data, ...prev])
      setActive(data)
      setAdding(false)
      toast.success('Note saved')
    } catch { toast.error('Could not save note') }
    finally { setSaving(false) }
  }

  function scheduleAutoSave(noteId, newTitle, newBody) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        const { data } = await updateNote(noteId, { title: newTitle, body: newBody })
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...data } : n))
      } catch { /* silent */ }
      finally { setSaving(false) }
    }, 900)
  }

  function handleBodyChange(val) {
    setBody(val)
    if (active) scheduleAutoSave(active.id, title, val)
  }

  function handleTitleChange(val) {
    setTitle(val)
    if (active) scheduleAutoSave(active.id, val, body)
  }

  async function handleDelete(noteId) {
    if (!window.confirm('Delete this note?')) return
    try {
      await deleteNote(noteId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
      if (active?.id === noteId) { setActive(null); setAdding(false) }
      toast.success('Deleted')
    } catch { toast.error('Could not delete') }
  }

  const showEditor = adding || active !== null

  return (
    <div className="emr-panel" style={{ padding: 0 }}>
      <div style={{ display: 'flex', height: 420, border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 220, borderRight: '1px solid var(--clr-border)', display: 'flex', flexDirection: 'column', background: 'var(--clr-surface)', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
              Notes {notes.length > 0 && `(${notes.length})`}
            </span>
            <button onClick={startNew}
              style={{ fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-primary)', padding: 0 }}
              title="New note">+</button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--clr-text-muted)' }}>Loading…</div>}
            {!loading && notes.length === 0 && (
              <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--clr-text-muted)', textAlign: 'center' }}>
                No notes yet.<br />
                <button onClick={startNew} style={{ marginTop: 6, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-primary)' }}>
                  Add first note
                </button>
              </div>
            )}
            {notes.map(n => (
              <div key={n.id}
                onClick={() => openNote(n)}
                style={{
                  padding: '9px 12px', borderBottom: '1px solid var(--clr-border)', cursor: 'pointer',
                  background: active?.id === n.id ? 'var(--clr-primary-subtle, #eff6ff)' : 'transparent',
                  borderLeft: active?.id === n.id ? '3px solid var(--clr-primary)' : '3px solid transparent',
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.title || 'Untitled'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.body || '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{n.author_name || ''}</span>
                  <span>{fmtDate(n.updated_at || n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!showEditor ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--clr-text-muted)', fontSize: 13 }}>
              Select a note or{' '}
              <button onClick={startNew} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-primary)', fontSize: 13, marginLeft: 4 }}>
                create a new one
              </button>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--clr-border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--clr-surface)' }}>
                <input
                  style={{ flex: 1, fontSize: 14, fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', color: 'var(--clr-text)' }}
                  placeholder="Title…"
                  value={title}
                  onChange={e => handleTitleChange(e.target.value)}
                />
                {saving && <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>saving…</span>}
                {adding && (
                  <>
                    <button onClick={handleCreate} disabled={saving}
                      style={{ fontSize: 12, padding: '4px 12px', background: 'var(--clr-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setAdding(false)}
                      style={{ fontSize: 12, padding: '4px 10px', background: 'none', border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--clr-text)' }}>
                      Cancel
                    </button>
                  </>
                )}
                {active && (
                  <button onClick={() => handleDelete(active.id)}
                    style={{ fontSize: 12, padding: '4px 10px', background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    Delete
                  </button>
                )}
              </div>

              {/* Body */}
              <textarea
                style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '12px 14px', fontSize: 13, lineHeight: 1.7, color: 'var(--clr-text)', background: 'var(--clr-bg)', fontFamily: 'inherit' }}
                placeholder="Write your note here…"
                value={body}
                onChange={e => handleBodyChange(e.target.value)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
