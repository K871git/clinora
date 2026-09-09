import { invoke } from '@tauri-apps/api/core'

const profileService = {
  async getProfile() {
    const result = await invoke('get_profile')
    return { data: result }
  },

  async updateProfile(data) {
    const result = await invoke('update_profile', { data })
    return { data: result }
  },

  async changePassword(data) {
    await invoke('update_password', { data })
    return { data: {} }
  },

  async uploadAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const ext = file.name.split('.').pop() || 'jpg'
          const result = await invoke('upload_avatar', { data: { data: e.target.result, ext } })
          resolve({ data: result })
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  },

  async removeAvatar() {
    const result = await invoke('remove_avatar')
    return { data: result }
  },
}

export default profileService
