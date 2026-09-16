import { invoke } from '@tauri-apps/api/core'

export const listVitals      = (patientId)       => invoke('list_vitals',       { patientId: Number(patientId) })
export const getLatestVitals = (patientId)       => invoke('get_latest_vitals', { patientId: Number(patientId) })
export const createVital     = (patientId, data) => invoke('create_vital',      { patientId: Number(patientId), data })
export const updateVital     = (id, data)        => invoke('update_vital',      { id: Number(id), data })
export const deleteVital     = (id)              => invoke('delete_vital',      { id: Number(id) })
