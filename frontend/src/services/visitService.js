import api from './api'

export function getClinicVisits(params = {}) {
  return api.get('/visits', { params })
}

export function createVisit(patientId, data) {
  return api.post(`/patients/${patientId}/visits`, data)
}

export function getVisit(visitId) {
  return api.get(`/visits/${visitId}`)
}

export function updateVisit(visitId, data) {
  return api.put(`/visits/${visitId}`, data)
}

export function saveFee(visitId, consultationFee) {
  return api.patch(`/visits/${visitId}/fee`, { consultation_fee: consultationFee })
}

export function completeVisit(visitId, consultationFee = null) {
  return api.post(`/visits/${visitId}/complete`, { consultation_fee: consultationFee })
}

export function recordVisitPayment(visitId, data) {
  return api.patch(`/visits/${visitId}/payment`, data)
}

export function getRevenueTransactions(period = 'this_month', filter = 'all') {
  return api.get('/dashboard/revenue/transactions', { params: { period, filter } })
}
