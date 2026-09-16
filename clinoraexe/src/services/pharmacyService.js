import { invoke } from '@tauri-apps/api/core'

export async function getPharmacyStats() {
  const result = await invoke('get_pharmacy_stats')
  return { data: result }
}

export async function getPharmacyPrescriptions() {
  const result = await invoke('list_pharmacy_prescriptions')
  return { data: result }
}

export async function getPharmacyPrescription(id) {
  const result = await invoke('get_pharmacy_prescription', { id: Number(id) })
  return { data: result }
}

export async function startDispensingPharmacyPrescription(id) {
  const result = await invoke('start_dispensing', { id: Number(id) })
  return { data: result }
}

export async function completePharmacyPrescription(id, items = [], extraItems = []) {
  const result = await invoke('complete_pharmacy_prescription', {
    id: Number(id),
    items,
    extraItems,
  })
  return { data: result }
}

export async function getPharmacyHistory(search = '') {
  const result = await invoke('get_pharmacy_history', { q: search || null })
  return { data: result }
}

export async function recordPrescriptionPayment(id, data) {
  const result = await invoke('record_prescription_payment', { id: Number(id), data })
  return { data: result }
}

export async function getPharmacyRevenue() {
  const result = await invoke('get_pharmacy_revenue')
  return { data: result }
}

export async function getPharmacyRevenueTransactions(period = 'this_month', filter = 'all') {
  const result = await invoke('get_pharmacy_revenue_transactions', { period, filter })
  return { data: result }
}

export async function savePharmacistNotes(id, notes) {
  const result = await invoke('save_pharmacist_notes', { id: Number(id), notes: notes || null })
  return { data: result }
}

export async function getPharmacyStockSummary() {
  const result = await invoke('get_pharmacy_stock_summary')
  return { data: result }
}

export async function getPatientDispenseHistory(patientId, excludeId) {
  const result = await invoke('get_patient_dispense_history', {
    patientId: Number(patientId),
    excludeId: Number(excludeId),
  })
  return { data: result }
}
