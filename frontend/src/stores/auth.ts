import { defineStore } from 'pinia'
import { api, setTokens, clearTokens, getAccessToken } from '../api/client'

export interface UserInfo {
  id: number
  username: string
  role: string
  permissions: string[]
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserInfo | null,
    loading: false
  }),
  getters: {
    isAuthenticated: (state) => !!state.user && !!getAccessToken(),
    isAdmin: (state) => state.user?.role === 'admin',
    canEdit: (state) => state.user?.role === 'admin' || state.user?.role === 'operator',
    /** Whether the user may enter a named system module (admin always can). */
    hasModule: (state) => (moduleId: string) =>
      state.user?.role === 'admin' || (state.user?.permissions ?? []).includes(moduleId)
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
