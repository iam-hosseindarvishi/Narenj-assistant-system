/// <reference types="vite/client" />

interface Window {
  api: {
    manual: {
      list: (query?: Record<string, string | undefined>) => Promise<Array<{ id: number; system: string; dateJalali: string; amount: number; label: string; suggestion?: boolean }>>
      link: (selection: Array<{ system: string; id: number }>, userId?: number | null) => Promise<number>
      unlink: (linkId: number, userId?: number | null) => Promise<void>
    }
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}