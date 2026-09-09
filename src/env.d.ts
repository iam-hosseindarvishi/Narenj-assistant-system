/// <reference types="vite/client" />

interface Window {
  api: {
    manual: {
      list: (query?: Record<string, string | undefined>) => Promise<Array<{ id: number; system: string; dateJalali: string; amount: number; label: string; suggestion?: boolean }>>
      link: (selection: Array<{ system: string; id: number }>, userId?: number | null) => Promise<number>
      unlink: (linkId: number, userId?: number | null) => Promise<void>
    }
    auth: { login: (username: string, password: string) => Promise<unknown>; logout: (token: string) => Promise<void> }
    users: { list: () => Promise<Array<{ id: number; username: string; role: string; createdAt: string }>> }
    audit: { list: (filter?: Record<string, string | number | undefined>) => Promise<Array<{ id: number; userId: number | null; action: string; entityType: string; entityId: number | null; timestamp: string }>> }
  }
}

declare module 'jalaali-js' {
  export function toGregorian(year: number, month: number, day: number): { gy: number; gm: number; gd: number }
  export function toJalaali(year: number, month: number, day: number): { jy: number; jm: number; jd: number }
  export function isValidJalaaliDate(year: number, month: number, day: number): boolean
  export function j2d(year: number, month: number, day: number): number
  export function d2j(jdn: number): { jy: number; jm: number; jd: number }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
