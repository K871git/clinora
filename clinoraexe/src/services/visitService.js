import { invoke } from '@tauri-apps/api/core'

export async function getClinicVisits(params = {}) {
  const result = await invoke('list_visits', params)
  return { data: result }
}

export async function createVisit(patientId, data) {
  const result = await invoke('create_visit', { patient_id: Number(patientId), data })
  return { data: result }
}

export async function getVisit(visitId) {
  const result = await invoke('get_visit', { id: Number(visitId) })
  return { data: result }
}

export async function updateVisit(visitId, data) {
  const result = await invoke('update_visit', { id: Number(visitId), data })
  return { data: result }
}

export async function saveFee(visitId, consultationFee) {
  const result = await invoke('update_visit_fee', { id: Number(visitId), consultation_fee: consultationFee })
  return { data: result }
}

export async function completeVisit(visitId, consultationFee = null) {
  const result = await invoke('complete_visit', { id: Number(visitId), consultation_fee: consultationFee })
  return { data: result }
}

export async function recordVisitPayment(visitId, data) {
  const result = await invoke('record_visit_payment', { id: Number(visitId), data })
  return { data: result }
}

export async function getRevenueTransactions(period = 'this_month', filter = 'all') {
  const result = await invoke('get_revenue_transactions', { period, filter })
  return { data: result }
}
