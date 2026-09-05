import api from './api'

const profileService = {
  getProfile() {
    return api.get('/profile')
  },

  updateProfile(data) {
    return api.put('/profile', data)
  },

  changePassword(data) {
    return api.put('/profile/password', data)
  },

  uploadAvatar(file) {
    const form = new FormData()
    form.append('avatar', file)
    return api.post('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  removeAvatar() {
    return api.delete('/profile/avatar')
  },
}

export default profileService
