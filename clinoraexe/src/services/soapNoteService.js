import { invoke } from '@tauri-apps/api/core'

export const getSoapNotes  = (visitId)       => invoke('get_soap_notes',  { id: Number(visitId) })
export const saveSoapNotes = (visitId, data) => invoke('save_soap_notes', { id: Number(visitId), data })
