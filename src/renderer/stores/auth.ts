import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

interface AuthUser {
  id: number
  username: string
  role: string
  forcePasswordChange: boolean
}

const STORAGE_KEY = 'narenj.auth'

/** Session state shared by the app shell (user, token, role helpers). */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const token = ref<string | null>(null)
  const isLoggedIn = computed(() => user.value !== null && token.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

  /** Logs in via IPC and persists the session in localStorage. */
  async function login(username: string, password: string): Promise<void> {
    const result = await window.api.auth.login(username, password)
    user.value = result.user
    token.value = result.token
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: result.user, token: result.token }))
  }

  /** Restores a persisted session, if any. */
  function checkSession(): void {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { user: AuthUser; token: string }
      user.value = parsed.user
      token.value = parsed.token
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  /** Ends the session in main and locally. */
  async function logout(): Promise<void> {
    if (token.value !== null) {
      try { await window.api.auth.logout(token.value) } catch { /* session already gone */ }
    }
    user.value = null
    token.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { user, token, isLoggedIn, isAdmin, login, checkSession, logout }
})
