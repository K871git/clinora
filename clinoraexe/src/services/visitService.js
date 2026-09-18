import { invoke } from '@tauri-apps/api/core'

export async function getClinicVisits(params = {}) {
  // remap snake_case keys to camelCase for Tauri 2
  const { per_page, sort_by, sort_dir, is_new, ...rest } = params
  const mapped = { ...rest }
  if (per_page !== undefined) mapped.perPage = per_page
  if (sort_by !== undefined) mapped.sortBy = sort_by
  if (sort_dir !== undefined) mapped.sortDir = sort_dir
  if (is_new !== undefined) mapped.isNew = is_new
  const result = await invoke('list_visits', mapped)
  return { data: result }
}

export async function createVisit(patientId, data) {
  const result = await invoke('create_visit', { patientId: Number(patientId), data })
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
  const result = await invoke('update_visit_fee', { id: Number(visitId), consultationFee })
  return { data: result }
}

export async function completeVisit(visitId, consultationFee = null) {
  const result = await invoke('complete_visit', { id: Number(visitId), consultationFee })
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

export const updateFollowup  = (id, followupDate, followupNotes) =>
  invoke('update_followup', { id: Number(id), followupDate, followupNotes })

export const listFollowups   = () => invoke('list_followups')

export const listOpdRegister = (date) => invoke('list_opd_register', { date })

export async function listVisitCharges(visitId) {
  const result = await invoke('list_visit_charges', { visitId: Number(visitId) })
  return { data: result }
}

export async function addVisitCharge(visitId, data) {
  const result = await invoke('add_visit_charge', { visitId: Number(visitId), data })
  return { data: result }
}

export async function deleteVisitCharge(id, visitId) {
  const result = await invoke('delete_visit_charge', { id: Number(id), visitId: Number(visitId) })
  return { data: result }
}
