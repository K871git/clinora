import api from './api'

/* ── Prescription templates ──────────────────────────────────────────── */

export function listTemplates() {
  return api.get('/prescription-templates')
}

export function uploadTemplate(file, onProgress) {
  const fd = new FormData()
  fd.append('template', file)
  return api.post('/prescription-templates', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  })
}

export function deleteTemplate(filename) {
  return api.delete(`/prescription-templates/${encodeURIComponent(filename)}`)
}

export function setActiveTemplate(templateName) {
  return api.put('/settings/prescriptions', { prescription_template: templateName ?? '' })
}

/* ── Prescriptions listing ───────────────────────────────────────────── */

/** Prescriptions listing — filterable by status/search, paginated */
export function getClinicPrescriptions({ status = '', q = '', page = 1, per_page } = {}) {
  const params = { page }
  if (status) params.status = status
  if (q.trim()) params.q = q.trim()
  if (per_page) params.per_page = per_page
  return api.get('/prescriptions', { params })
}

/** Create a prescription for a visit (saves as draft) */
export function createPrescription(visitId, data) {
  return api.post(`/visits/${visitId}/prescriptions`, data)
}

/** Fetch a single prescription with patient, visit, doctor, items */
export function getPrescription(id) {
  return api.get(`/prescriptions/${id}`)
}

/** Update a draft prescription (only drafts can be updated) */
export function updatePrescription(id, data) {
  return api.put(`/prescriptions/${id}`, data)
}

/** Send a draft prescription to the pharmacy */
export function sendPrescription(id) {
  return api.post(`/prescriptions/${id}/send`)
}

/** Delete a draft prescription (only drafts) */
export function deletePrescription(id) {
  return api.delete(`/prescriptions/${id}`)
}

/** Fetch the generated PDF blob for a prescription */
export function getPrescriptionPdf(id) {
  return api.get(`/prescriptions/${id}/pdf`, { responseType: 'blob' })
}
