import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.jsx'

// PerformanceObserver callbacks in bundled libs (datatables-buttons, etc.)
// sometimes receive a null/GC'd PerformanceEntry after SPA navigation, causing
// "Cannot read properties of undefined (reading 'startTime')". Wrap the
// constructor to catch only that specific TypeError; all others still throw.
if (typeof window !== 'undefined' && window.PerformanceObserver) {
  const _NativePO = window.PerformanceObserver
  class SafePerformanceObserver extends _NativePO {
    constructor(callback) {
      super(function (list, observer) {
        try {
          callback(list, observer)
        } catch (err) {
          if (err instanceof TypeError && err.message.includes('startTime')) return
          throw err
        }
      })
    }
  }
  try {
    Object.defineProperty(SafePerformanceObserver, 'supportedEntryTypes', {
      get: () => _NativePO.supportedEntryTypes,
    })
  } catch { /* some browsers don't allow redefining — safe to skip */ }
  window.PerformanceObserver = SafePerformanceObserver
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
