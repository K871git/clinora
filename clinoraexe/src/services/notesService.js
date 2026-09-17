import { invoke } from '@tauri-apps/api/core'

export async function listNotes(role) {
  const result = await invoke('list_notes', { role: role || null })
  return { data: result.data }
}

export async function getNote(id) {
  const result = await invoke('get_note', { id: Number(id) })
  return { data: result.data }
}

export async function createNote(payload = {}) {
  const result = await invoke('create_note', {
    title:     payload.title      || null,
    body:      payload.body       || null,
    tags:      payload.tags       || null,
    role:      payload.role       || null,
    patientId: payload.patient_id ? Number(payload.patient_id) : null,
  })
  return { data: result.data }
}

export async function listPatientNotes(patientId) {
  const result = await invoke('list_patient_notes', { patientId: Number(patientId) })
  return { data: result.data }
}

export async function updateNote(id, payload = {}) {
  const result = await invoke('update_note', {
    id:    Number(id),
    title: payload.title ?? '',
    body:  payload.body  ?? null,
    tags:  payload.tags  ?? null,
  })
  return { data: result.data }
}

export async function deleteNote(id) {
  await invoke('delete_note', { id: Number(id) })
}

export async function saveNoteAttachment(noteId, filename, bytes) {
  const result = await invoke('save_note_attachment', {
    noteId:   Number(noteId),
    filename,
    bytes: Array.from(bytes),
  })
  return result
}

export async function deleteNoteAttachment(noteId, filename) {
  await invoke('delete_note_attachment', { noteId: Number(noteId), filename })
}

export async function readNoteAttachment(noteId, filename) {
  const bytes = await invoke('read_note_attachment', { noteId: Number(noteId), filename })
  return bytes
}

export function attachmentToDataUrl(bytes, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf' }
  const mime = mimeMap[ext] || 'application/octet-stream'
  const blob = new Blob([new Uint8Array(bytes)], { type: mime })
  return URL.createObjectURL(blob)
}

export function isImageFile(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
}
