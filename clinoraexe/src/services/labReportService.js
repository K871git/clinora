import { invoke } from '@tauri-apps/api/core'

export const listLabReports   = (patientId)       => invoke('list_lab_reports',   { patientId: Number(patientId) })
export const createLabReport  = (patientId, data) => invoke('create_lab_report',  { patientId: Number(patientId), data })
export const updateLabReport  = (id, data)        => invoke('update_lab_report',  { id: Number(id), data })
export const deleteLabReport  = (id)              => invoke('delete_lab_report',  { id: Number(id) })
