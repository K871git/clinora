import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import {
  listNotes, getNote, createNote, updateNote, deleteNote,
  saveNoteAttachment, deleteNoteAttachment,
  readNoteAttachment, attachmentToDataUrl, isImageFile,
} from '../../services/notesService'
import '../../styles/notes-page.css'

/* ── Icons ─────────────────────────────────────────────────────────── */

function IconNote() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}
function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}
function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
function IconPrint() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  )
}
function IconPaperclip() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function fmtDate(iso) {
  if (!iso) return ''
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  const utc = iso.endsWith('Z') ? iso : iso + 'Z'
  return new Date(utc).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function bodyPreview(body) {
  if (!body) return 'No content'
  return body.replace(/\n/g, ' ').slice(0, 100)
}

/* ── Main component ─────────────────────────────────────────────────── */

export default function NotesPage({ userRole }) {
  const role = userRole || 'doctor'

  const [notes,        setNotes]        = useState([])
  const [activeId,     setActiveId]     = useState(null)
  const [note,         setNote]         = useState(null)
  const [title,        setTitle]        = useState('')
  const [body,         setBody]         = useState('')
  const [tags,         setTags]         = useState('')
  const [attachUrls,   setAttachUrls]   = useState({})   // filename -> object url
  const [saving,       setSaving]       = useState(false)
  const [savingLabel,  setSavingLabel]  = useState('')
  const [search,       setSearch]       = useState('')
  const [delConfirm,   setDelConfirm]   = useState(false)
  const [loadingNote,  setLoadingNote]  = useState(false)

  const saveTimer = useRef(null)
  const fileInput = useRef(null)
  const bodyRef   = useRef(null)

  /* Load list */
  useEffect(() => {
    listNotes(role).then(({ data }) => setNotes(data)).catch(() => {})
  }, [role])

  /* Load full note when activeId changes */
  useEffect(() => {
    if (!activeId) { setNote(null); setTitle(''); setBody(''); setTags(''); setAttachUrls({}); return }
    setLoadingNote(true)
    getNote(activeId)
      .then(({ data }) => {
        setNote(data)
        setTitle(data.title || '')
        setBody(data.body || '')
        setTags(data.tags || '')
        setAttachUrls({})
        loadAttachmentPreviews(data)
      })
      .catch(() => toast.error('Could not load note'))
      .finally(() => setLoadingNote(false))
  }, [activeId])

  async function loadAttachmentPreviews(n) {
    if (!n?.attachments?.length) return
    const urls = {}
    for (const fname of n.attachments) {
      if (isImageFile(fname)) {
        try {
          const bytes = await readNoteAttachment(n.id, fname)
          urls[fname] = attachmentToDataUrl(bytes, fname)
        } catch { /* skip */ }
      }
    }
    setAttachUrls(urls)
  }

  /* Auto-save body/title/tags after 800ms idle */
  const scheduleAutoSave = useCallback((newTitle, newBody, newTags) => {
    if (!activeId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSavingLabel('saving…')
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        const { data } = await updateNote(activeId, { title: newTitle, body: newBody, tags: newTags })
        setNotes(prev => prev.map(n => n.id === activeId
          ? { ...n, title: newTitle, body: newBody, updated_at: data.updated_at }
          : n
        ))
        setSavingLabel('saved')
        setTimeout(() => setSavingLabel(''), 1800)
      } catch {
        setSavingLabel('error')
        toast.error('Auto-save failed')
      } finally { setSaving(false) }
    }, 800)
  }, [activeId])

  function handleTitleChange(val) { setTitle(val); scheduleAutoSave(val, body, tags) }
  function handleBodyChange(val)  { setBody(val);  scheduleAutoSave(title, val, tags) }
  function handleTagsChange(val)  { setTags(val);  scheduleAutoSave(title, body, val) }

  /* Create new note */
  async function handleNew() {
    try {
      const { data } = await createNote({ title: 'Untitled Note', role })
      setNotes(prev => [data, ...prev])
      setActiveId(data.id)
    } catch { toast.error('Could not create note') }
  }

  /* Delete note */
  async function handleDelete() {
    if (!activeId) return
    try {
      await deleteNote(activeId)
      setNotes(prev => prev.filter(n => n.id !== activeId))
      setActiveId(null)
      setDelConfirm(false)
      toast.success('Note deleted')
    } catch { toast.error('Could not delete note') }
  }

  /* Attach file */
  async function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file || !activeId) return
    fileInput.current.value = ''

    const MAX = 10 * 1024 * 1024 // 10 MB
    if (file.size > MAX) { toast.error('File too large (max 10 MB)'); return }

    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      await saveNoteAttachment(activeId, file.name, bytes)
      // Refresh note to get updated attachments
      const { data } = await getNote(activeId)
      setNote(data)
      if (isImageFile(file.name)) {
        const url = attachmentToDataUrl(bytes, file.name)
        setAttachUrls(prev => ({ ...prev, [file.name]: url }))
      }
      toast.success(`${file.name} attached`)
    } catch (err) { toast.error('Could not attach file: ' + err) }
  }

  /* Remove attachment */
  async function handleRemoveAttachment(fname) {
    if (!activeId) return
    try {
      await deleteNoteAttachment(activeId, fname)
      const { data } = await getNote(activeId)
      setNote(data)
      setAttachUrls(prev => { const n = { ...prev }; delete n[fname]; return n })
    } catch { toast.error('Could not remove attachment') }
  }

  /* Export as text */
  async function handleExportText() {
    if (!note) return
    const lines = [
      `NOTE: ${title || 'Untitled'}`,
      `Date: ${fmtDate(note.created_at)}`,
      tags ? `Tags: ${tags}` : '',
      '',
      body || '(no content)',
      '',
      note.attachments?.length ? `Attachments: ${note.attachments.join(', ')}` : '',
    ].filter(l => l !== undefined)

    const content = lines.join('\n')
    const filename = `Note_${(title || 'note').replace(/\s+/g, '_').slice(0,40)}.txt`
    try {
      await invoke('write_text_to_downloads', { content, filename })
      toast.success(`Saved to Downloads as ${filename}`)
    } catch { toast.error('Could not export') }
  }

  /* Print note */
  function handlePrint() {
    window.print()
  }

  /* Filtered list */
  const q = search.toLowerCase().trim()
  const filteredNotes = q
    ? notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.body  || '').toLowerCase().includes(q) ||
        (n.tags  || '').toLowerCase().includes(q)
      )
    : notes

  return (
    <div className="notes-shell">

      {/* ── Sidebar list ─────────────────────────────────────────────── */}
      <aside className="notes-sidebar">
        <div className="notes-sidebar-header">
          <span className="notes-sidebar-title">My Notes</span>
          <button className="notes-new-btn" onClick={handleNew} title="New note">
            <IconPlus /> New
          </button>
        </div>

        <div className="notes-search-wrap">
          <IconSearch />
          <input
            className="notes-search"
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="notes-list">
          {filteredNotes.length === 0 && (
            <div className="notes-list-empty">
              {search ? 'No notes match your search.' : 'No notes yet. Click + New to start.'}
            </div>
          )}
          {filteredNotes.map(n => (
            <button
              key={n.id}
              className={`notes-list-item${activeId === n.id ? ' notes-list-item--active' : ''}`}
              onClick={() => { setDelConfirm(false); setActiveId(n.id) }}
            >
              <div className="notes-list-title">{n.title || 'Untitled'}</div>
              <div className="notes-list-preview">{bodyPreview(n.body)}</div>
              <div className="notes-list-date">{fmtDate(n.updated_at)}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Editor pane ──────────────────────────────────────────────── */}
      <main className="notes-editor-pane">
        {!activeId && (
          <div className="notes-empty-state">
            <IconNote />
            <div className="notes-empty-title">Select a note or create one</div>
            <button className="btn-primary notes-empty-btn" onClick={handleNew}>
              <IconPlus /> New Note
            </button>
          </div>
        )}

        {activeId && loadingNote && (
          <div className="notes-loading">Loading…</div>
        )}

        {activeId && !loadingNote && (
          <>
            {/* ── Toolbar ────────────────────────────────────────────── */}
            <div className="notes-toolbar">
              <div className="notes-save-status">
                {savingLabel === 'saving…' && <span className="notes-saving">saving…</span>}
                {savingLabel === 'saved'   && <span className="notes-saved">Saved</span>}
                {savingLabel === 'error'   && <span className="notes-save-err">Save failed</span>}
                {!savingLabel && note && <span className="notes-date-info">{fmtDate(note.updated_at)} {fmtTime(note.updated_at)}</span>}
              </div>

              <div className="notes-toolbar-actions">
                <button className="notes-tool-btn" onClick={() => fileInput.current.click()} title="Attach file">
                  <IconPaperclip /> Attach
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button className="notes-tool-btn" onClick={handleExportText} title="Export as text">
                  <IconDownload /> Export
                </button>
                <button className="notes-tool-btn notes-print-btn" onClick={handlePrint} title="Print / Save as PDF">
                  <IconPrint /> Print / PDF
                </button>
                {!delConfirm ? (
                  <button className="notes-tool-btn notes-del-btn" onClick={() => setDelConfirm(true)} title="Delete note">
                    <IconTrash />
                  </button>
                ) : (
                  <div className="notes-del-confirm">
                    <span>Delete?</span>
                    <button className="notes-del-yes" onClick={handleDelete}>Yes</button>
                    <button className="notes-del-no"  onClick={() => setDelConfirm(false)}>No</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Title ──────────────────────────────────────────────── */}
            <input
              className="notes-title-input"
              placeholder="Note title…"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
            />

            {/* ── Tags ───────────────────────────────────────────────── */}
            <input
              className="notes-tags-input"
              placeholder="Tags (comma separated, e.g. patient, followup)…"
              value={tags}
              onChange={e => handleTagsChange(e.target.value)}
            />

            {/* ── Body textarea ──────────────────────────────────────── */}
            <textarea
              ref={bodyRef}
              className="notes-body"
              placeholder="Write your note here… supports Marathi, Hindi, English and any language."
              value={body}
              onChange={e => handleBodyChange(e.target.value)}
              spellCheck={false}
            />

            {/* ── Attachments ────────────────────────────────────────── */}
            {note?.attachments?.length > 0 && (
              <div className="notes-attachments">
                <div className="notes-attach-label">Attachments</div>
                <div className="notes-attach-grid">
                  {note.attachments.map(fname => (
                    <div key={fname} className="notes-attach-item">
                      {isImageFile(fname) && attachUrls[fname] ? (
                        <div className="notes-attach-img-wrap">
                          <img
                            src={attachUrls[fname]}
                            alt={fname}
                            className="notes-attach-img"
                            onClick={() => window.open(attachUrls[fname])}
                          />
                        </div>
                      ) : (
                        <div className="notes-attach-file">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                      )}
                      <div className="notes-attach-name">{fname}</div>
                      <button
                        className="notes-attach-remove"
                        onClick={() => handleRemoveAttachment(fname)}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Hidden print layout ──────────────────────────────────────── */}
      {note && (
        <div className="notes-print-area">
          <h2 className="notes-print-title">{title || 'Untitled'}</h2>
          {tags && <div className="notes-print-tags">Tags: {tags}</div>}
          <div className="notes-print-date">{fmtDate(note.created_at)}</div>
          <hr />
          <pre className="notes-print-body">{body}</pre>
          {note.attachments?.filter(isImageFile).map(fname => (
            attachUrls[fname] && (
              <div key={fname} style={{ marginTop: 12 }}>
                <img src={attachUrls[fname]} alt={fname} style={{ maxWidth: '100%' }} />
                <div style={{ fontSize: 10, color: '#888' }}>{fname}</div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
