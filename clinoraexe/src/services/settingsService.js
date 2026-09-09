import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'

export async function getSettings() {
  const result = await invoke('get_settings')
  // Convert absolute template path to asset:// URL the WebView can load
  if (result.prescription_template_path) {
    result.prescription_template_url = convertFileSrc(result.prescription_template_path)
  }
  return { data: result }
}

export async function updateClinic(data) {
  const result = await invoke('update_clinic', { data })
  return { data: result }
}

export async function updatePrescriptionSettings(data) {
  const result = await invoke('update_prescription_settings', { data })
  return { data: result }
}

export async function updateClinicName(name) {
  const result = await invoke('update_clinic_name', { data: { name } })
  return { data: result }
}

export async function getTemplates() {
  const result = await invoke('list_templates')
  if (Array.isArray(result.data)) {
    result.data = result.data.map(t => ({
      ...t,
      url: t.path ? convertFileSrc(t.path) : null,
    }))
  }
  return { data: result }
}

export async function uploadTemplate(file) {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const result = await invoke('upload_template', {
    data: { data: base64, filename: file.name },
  })
  return { data: { ...result, url: result.path ? convertFileSrc(result.path) : null } }
}

export async function deleteTemplate(name) {
  await invoke('delete_template', { name })
  return { data: {} }
}

export async function setActiveTemplate(name) {
  const result = await invoke('set_active_template', { name })
  return { data: result }
}
