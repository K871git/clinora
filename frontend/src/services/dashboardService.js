import api from './api'

export function getDashboardStats() {
  return api.get('/dashboard/stats')
}

export function getTodayPatients() {
  return api.get('/dashboard/today-patients')
}

export function getDashboardPendingRx() {
  return api.get('/dashboard/pending-rx')
}

export function getRevenueDetails() {
  return api.get('/dashboard/revenue')
}
