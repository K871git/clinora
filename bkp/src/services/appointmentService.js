import { invoke } from '@tauri-apps/api/core'

export const listAppointments           = (filters = {})   => invoke('list_appointments',            filters)
export const getAppointmentCalendarDays = (month)          => invoke('get_appointment_calendar_days', { month })
export const createAppointment          = (data)           => invoke('create_appointment',            { data })
export const updateAppointment          = (id, data)       => invoke('update_appointment',            { id: Number(id), data })
export const deleteAppointment          = (id)             => invoke('delete_appointment',            { id: Number(id) })
export const listPatientAppointments    = (patientId)      => invoke('list_patient_appointments',     { patientId: Number(patientId) })
