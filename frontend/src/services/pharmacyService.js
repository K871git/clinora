import api from './api'

/** Live counts — pending, dispensing, today_done — no pagination cap */
export function getPharmacyStats() {
  return api.get('/pharmacy/stats')
}

/** Prescriptions sent to pharmacy and waiting to be dispensed */
export function getPharmacyPrescriptions() {
  return api.get('/pharmacy/prescriptions')
}

/** Single pharmacy prescription — full patient, visit, doctor, items */
export function getPharmacyPrescription(id) {
  return api.get(`/pharmacy/prescriptions/${id}`)
}

/** Move a prescription from pending → dispensing (pharmacy starts working on it) */
export function startDispensingPharmacyPrescription(id) {
  return api.post(`/pharmacy/prescriptions/${id}/start-dispensing`)
}

/** Mark a prescription as dispensed / completed. Pass items array with optional unit_price per item. */
export function completePharmacyPrescription(id, items = []) {
  return api.post(`/pharmacy/prescriptions/${id}/complete`, { items })
}

/** Completed prescriptions — pharmacy history. Pass search to filter by patient name/mobile */
export function getPharmacyHistory(search = '') {
  return api.get('/pharmacy/prescriptions/history', { params: search ? { q: search } : {} })
}
