import api from './api'

export function getStockItems(q = '') {
  return api.get('/stock-items', { params: q ? { q } : {} })
}

export function createStockItem(data) {
  return api.post('/stock-items', data)
}

export function updateStockItem(id, data) {
  return api.patch(`/stock-items/${id}`, data)
}

export function deleteStockItem(id) {
  return api.delete(`/stock-items/${id}`)
}
