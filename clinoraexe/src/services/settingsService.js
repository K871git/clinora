import { invoke } from '@tauri-apps/api/core'

export async function getSettings() {
  const result = await invoke('get_settings')
  return { data: result }
}

export async function updateClinic(data) {
  const result = await invoke('update_clinic', { data })
  return { data: result }
}

export async function updatePrescriptionSettings(data) {
  const result = await invoke('update_prescription_settings', { data })
  return { data: result }
}

export async function updateClinicName(name) {
  const result = await invoke('update_clinic_name', { data: { name } })
  return { data: result }
}

export async function getTemplates() {
  return { data: { data: [] } }
}
