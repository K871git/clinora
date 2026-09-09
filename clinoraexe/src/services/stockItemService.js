import { invoke } from '@tauri-apps/api/core'

export async function getStockItems(q = '') {
  const result = await invoke('list_stock_items', { q: q || null })
  return { data: result }
}

export async function createStockItem(data) {
  const result = await invoke('create_stock_item', { data })
  return { data: result }
}

export async function updateStockItem(id, data) {
  const result = await invoke('update_stock_item', { id, data })
  return { data: result }
}

export async function deleteStockItem(id) {
  await invoke('delete_stock_item', { id })
  return { data: {} }
}
