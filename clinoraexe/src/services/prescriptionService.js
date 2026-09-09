import { invoke } from '@tauri-apps/api/core'

export async function getClinicPrescriptions({ status = '', q = '', page = 1, per_page } = {}) {
  const result = await invoke('list_prescriptions', { status, q, page, per_page })
  return { data: result }
}

export async function createPrescription(visitId, data) {
  const result = await invoke('create_prescription', { visit_id: Number(visitId), data })
  return { data: result }
}

export async function getPrescription(id) {
  const result = await invoke('get_prescription', { id: Number(id) })
  return { data: result }
}

export async function updatePrescription(id, data) {
  const result = await invoke('update_prescription', { id: Number(id), data })
  return { data: result }
}

export async function sendPrescription(id) {
  const result = await invoke('send_prescription', { id: Number(id) })
  return { data: result }
}

export async function deletePrescription(id) {
  await invoke('delete_prescription', { id: Number(id) })
  return { data: {} }
}

export async function getPrescriptionPdf(id) {
  // PDF handled separately via print window
  return { data: null }
}

// Template methods — not applicable in desktop app
export function listTemplates() { return Promise.resolve({ data: { data: [] } }) }
export function uploadTemplate() { return Promise.resolve({ data: {} }) }
export function deleteTemplate() { return Promise.resolve({ data: {} }) }
export function setActiveTemplate() { return Promise.resolve({ data: {} }) }
