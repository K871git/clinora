import { invoke } from '@tauri-apps/api/core'

export async function createPharmacyReturn(prescriptionId, items, reason, notes) {
  const result = await invoke('create_pharmacy_return', {
    prescriptionId: Number(prescriptionId),
    items,
    reason: reason || null,
    notes: notes || null,
  })
  return { data: result }
}

export async function listPharmacyReturns(page = 1, perPage = 30) {
  const result = await invoke('list_pharmacy_returns', {
    page: Number(page),
    perPage: Number(perPage),
  })
  return { data: result }
}

export async function getPharmacyReturn(id) {
  const result = await invoke('get_pharmacy_return', { id: Number(id) })
  return { data: result }
}
