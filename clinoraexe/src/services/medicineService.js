import { invoke } from '@tauri-apps/api/core'

export async function searchMedicines(q = '', perPage = 15) {
  const result = await invoke('list_medicines', { q, per_page: perPage })
  return { data: result }
}

export async function getMedicines(q = '', perPage = 500) {
  const result = await invoke('list_medicines', { q, per_page: perPage })
  return { data: result }
}

export async function createMedicine(data) {
  const result = await invoke('create_medicine', { data })
  return { data: result }
}

export async function updateMedicine(id, data) {
  const result = await invoke('update_medicine', { id, data })
  return { data: result }
}

export async function patchMedicine(id, data) {
  const result = await invoke('update_medicine', { id, data })
  return { data: result }
}

export async function deleteMedicine(id) {
  await invoke('delete_medicine', { id })
  return { data: {} }
}

export async function importMedicines(items) {
  const result = await invoke('import_medicines', { items })
  return { data: result }
}
