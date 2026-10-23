import Swal from 'sweetalert2'

function isDark() {
  return document.documentElement.dataset.theme === 'dark'
}

function base() {
  const dark = isDark()
  return {
    background:      dark ? '#1e293b' : '#ffffff',
    color:           dark ? '#f1f5f9' : '#0f172a',
    confirmButtonColor: '#3b82f6',
    cancelButtonColor:  dark ? '#334155' : '#e2e8f0',
    customClass: {
      cancelButton: dark ? 'swal-cancel-dark' : '',
    },
  }
}

export async function confirmDelete({ title = 'Delete?', text = 'This cannot be undone.' } = {}) {
  const result = await Swal.fire({
    ...base(),
    title,
    text,
    icon:                'warning',
    iconColor:           '#ef4444',
    showCancelButton:    true,
    confirmButtonText:   'Yes, delete',
    confirmButtonColor:  '#ef4444',
    cancelButtonText:    'Cancel',
    reverseButtons:      true,
    focusCancel:         true,
  })
  return result.isConfirmed
}

export async function confirmDiscard({ title = 'Discard changes?', text = 'Unsaved changes will be lost.' } = {}) {
  const result = await Swal.fire({
    ...base(),
    title,
    text,
    icon:               'question',
    iconColor:          '#f59e0b',
    showCancelButton:   true,
    confirmButtonText:  'Discard',
    confirmButtonColor: '#f59e0b',
    cancelButtonText:   'Keep editing',
    reverseButtons:     true,
    focusCancel:        true,
  })
  return result.isConfirmed
}
