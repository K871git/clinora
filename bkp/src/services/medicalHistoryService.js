import { invoke } from '@tauri-apps/api/core'

export const listMedicalHistory    = (patientId)       => invoke('list_medical_history',    { patientId: Number(patientId) })
export const createMedicalHistory  = (patientId, data) => invoke('create_medical_history',  { patientId: Number(patientId), data })
export const updateMedicalHistory  = (id, data)        => invoke('update_medical_history',  { id: Number(id), data })
export const deleteMedicalHistory  = (id)              => invoke('delete_medical_history',  { id: Number(id) })
export const getPatientAllergies   = (patientId)       => invoke('get_patient_allergies',   { patientId: Number(patientId) })
