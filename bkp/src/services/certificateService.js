import { invoke } from '@tauri-apps/api/core'

export async function createCertificate(data) {
  const result = await invoke('create_certificate', { data })
  return { data: result }
}

export async function getCertificate(id) {
  const result = await invoke('get_certificate', { id: Number(id) })
  return { data: result }
}

export async function listPatientCertificates(patientId) {
  const result = await invoke('list_patient_certificates', { patientId: Number(patientId) })
  return { data: result }
}

export async function deleteCertificate(id) {
  const result = await invoke('delete_certificate', { id: Number(id) })
  return { data: result }
}
