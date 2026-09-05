import api from './api'

export function createVisit(patientId, data) {
  return api.post(`/patients/${patientId}/visits`, data)
}

export function getVisit(visitId) {
  return api.get(`/visits/${visitId}`)
}

export function updateVisit(visitId, data) {
  return api.put(`/visits/${visitId}`, data)
}

export function completeVisit(visitId, consultationFee = null) {
  return api.post(`/visits/${visitId}/complete`, { consultation_fee: consultationFee })
}
