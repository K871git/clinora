import { invoke } from '@tauri-apps/api/core'

export async function searchPatients(q) {
  const result = await invoke('list_patients', { q, page: 1, perPage: 8 })
  return { data: result }
}

export async function getRecentPatients() {
  const result = await invoke('list_patients', { page: 1, perPage: 5 })
  return { data: result }
}

export async function listPatients({ q = '', page = 1, per_page = 15, sort_by = 'name', sort_dir = 'asc', gender = '', is_new = false } = {}) {
  const result = await invoke('list_patients', {
    q, page,
    perPage: per_page,
    sortBy: sort_by,
    sortDir: sort_dir,
    gender,
    isNew: is_new,
  })
  return { data: result }
}

export async function getPatient(id) {
  const result = await invoke('get_patient', { id: Number(id) })
  return { data: result }
}

export async function createPatient(data) {
  const result = await invoke('create_patient', { data })
  return { data: result }
}

export async function updatePatient(id, data) {
  const result = await invoke('update_patient', { id: Number(id), data })
  return { data: result }
}

export async function getPatientVisits(id) {
  const result = await invoke('get_patient_visits', { id: Number(id) })
  return { data: result }
}

export async function getPatientPrescriptions(id, { page = 1 } = {}) {
  const result = await invoke('get_patient_prescriptions', { id: Number(id), page })
  return { data: result }
}
