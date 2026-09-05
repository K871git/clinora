import api from './api'

export function getSettings() {
  return api.get('/settings')
}

export function updateClinic(data) {
  return api.put('/settings/clinic', data)
}

export function updatePrescriptionSettings(data) {
  return api.put('/settings/prescriptions', data)
}

export function updateClinicName(name) {
  return api.put('/settings/clinic-name', { name })
}

export function getTemplates() {
  return api.get('/prescription-templates')
}
