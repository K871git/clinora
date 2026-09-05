import api from './api'

export function searchMedicines(q = '', perPage = 15) {
  return api.get('/medicines', { params: { q, per_page: perPage } })
}

export function getMedicines(q = '', perPage = 500) {
  return api.get('/medicines', { params: { q, per_page: perPage } })
}

export function createMedicine(data) {
  return api.post('/medicines', data)
}

export function updateMedicine(id, data) {
  return api.put(`/medicines/${id}`, data)
}

export function patchMedicine(id, data) {
  return api.patch(`/medicines/${id}`, data)
}

export function deleteMedicine(id) {
  return api.delete(`/medicines/${id}`)
}

export function importMedicines(file) {
  const form = new FormData()
  form.append('file', file)
  return api.post('/medicines/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
