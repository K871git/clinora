import api from './api'

/** Dashboard hero search — dropdown results */
export function searchPatients(q) {
  return api.get('/patients', { params: { q, per_page: 8 } })
}

/** Dashboard panel — 5 most recent patients */
export function getRecentPatients() {
  return api.get('/patients', { params: { per_page: 5 } })
}

/** Patient list page — searchable, sortable, filterable, paginated */
export function listPatients({ q = '', page = 1, per_page = 15, sort_by = 'name', sort_dir = 'asc', gender = '', is_new = false } = {}) {
  const params = { page, per_page, sort_by, sort_dir }
  if (q.trim())  params.q      = q.trim()
  if (gender)    params.gender = gender
  if (is_new)    params.is_new = 1
  return api.get('/patients', { params })
}

/** Single patient record */
export function getPatient(id) {
  return api.get(`/patients/${id}`)
}

/** Create — may return 409 with { message, duplicate } when mobile already exists */
export function createPatient(data) {
  return api.post('/patients', data)
}

/** Update patient fields */
export function updatePatient(id, data) {
  return api.put(`/patients/${id}`, data)
}

/** Visit history for a patient */
export function getPatientVisits(id) {
  return api.get(`/patients/${id}/visits`)
}

/** Prescription history for a patient */
export function getPatientPrescriptions(id, { page = 1 } = {}) {
  return api.get(`/patients/${id}/prescriptions`, { params: { page } })
}
