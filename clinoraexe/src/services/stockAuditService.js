import { invoke } from '@tauri-apps/api/core'

export function getStockAuditLog(itemType, itemId) {
  return invoke('get_stock_audit_log', { itemType, itemId }).then(data => ({ data }))
}
