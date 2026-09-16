import { defineStore } from 'pinia'

const KEY = 'narenj-theme'

function initialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useThemeStore = defineStore('theme', {
  state: () => {
    const theme = initialTheme()
    apply(theme)
    return { theme }
  },
  getters: {
    isDark: (state) => state.theme === 'dark'
  },
  actions: {
    toggle() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(KEY, this.theme)
      apply(this.theme)
    }
  }
})
