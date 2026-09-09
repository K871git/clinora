import { invoke } from '@tauri-apps/api/core'

export async function getDashboardStats() {
  const result = await invoke('get_dashboard_stats')
  return { data: result }
}

export async function getTodayPatients() {
  const result = await invoke('get_today_patients')
  return { data: result }
}

export async function getDashboardPendingRx() {
  const result = await invoke('get_pending_rx')
  return { data: result }
}

export async function getRevenueDetails() {
  const result = await invoke('get_revenue')
  return { data: result }
}
