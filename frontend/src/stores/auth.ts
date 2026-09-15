import { defineStore } from 'pinia'
import { api, setTokens, clearTokens, getAccessToken } from '../api/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as { id: number; username: string; role: string } | null,
    loading: false
  }),
  getters: {
    isAuthenticated: (state) => !!state.user && !!getAccessToken(),
    isAdmin: (state) => state.user?.role === 'admin',
    canEdit: (state) => state.user?.role === 'admin' || state.user?.role === 'operator'
  },
  actions: {
    async login(username: string, password: string) {
      this.loading = true
      try {
        const resp = await api.post('/auth/login', { username, password })
        setTokens(resp.data.access_token, resp.data.refresh_token)
        await this.fetchMe()
        return true
      } finally {
        this.loading = false
      }
    },
    async fetchMe() {
      try {
        const resp = await api.get('/auth/me')
        this.user = resp.data
      } catch {
        this.user = null
      }
    },
    async logout() {
      try {
        await api.post('/auth/logout')
      } catch {
        /* ignore */
      }
      clearTokens()
      this.user = null
    }
  }
})
