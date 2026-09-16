import { invoke } from '@tauri-apps/api/core'

export const getPatientTimeline = (patientId) =>
  invoke('get_patient_timeline', { patientId: Number(patientId) })
