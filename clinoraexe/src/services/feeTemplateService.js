import { invoke } from '@tauri-apps/api/core'

export async function listFeeTemplates() {
  const result = await invoke('list_fee_templates')
  return { data: result.data ?? [] }
}

export async function saveFeeTemplate(id, data) {
  const result = await invoke('save_fee_template', { id: id ? Number(id) : null, data })
  return { data: result }
}

export async function deleteFeeTemplate(id) {
  const result = await invoke('delete_fee_template', { id: Number(id) })
  return { data: result }
}
