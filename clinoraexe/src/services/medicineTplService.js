import { invoke } from '@tauri-apps/api/core'

export async function searchMedicineTemplates(q) {
  const result = await invoke('search_medicine_templates', { q })
  return { data: result.data ?? [] }
}

export async function listMedicineTemplates() {
  const result = await invoke('list_medicine_templates')
  return { data: result.data ?? [] }
}

export async function saveMedicineTemplate(data) {
  const result = await invoke('save_medicine_template', { data })
  return { data: result }
}

export async function deleteMedicineTemplate(id) {
  await invoke('delete_medicine_template', { id: Number(id) })
}
