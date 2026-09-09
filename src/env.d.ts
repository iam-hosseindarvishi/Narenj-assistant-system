/// <reference types="vite/client" />

interface ImportResultDto {
  totalRows: number
  parsedRows: number
  skippedRows: number
  errors: string[]
  fileId: number
}

interface TemplateDto {
  id: number
  name: string
  type: string
  bankId: number | null
  columnMapping: Record<string, string>
  cleanupRules: { skipTopRows: number[]; skipBottomRows: number; headerRow: number }
  extractionRules: Array<{ field: string; pattern: string; mode: string }>
  createdBy: number | null
  createdAt: string
}

interface Layer1RowDto {
  id: number
  dateJalali: string
  branchId: string
  branchName: string
  terminalId: string
  txCount: number
  posAmount: number
  bankAmount: number | null
  diff: number | null
  status: string
  matchType: string | null
  confidence: number | null
  daysWaiting: number | null
}

interface Layer2RowDto {
  dateJalali: string
  totalAmount: number
  linkedCount: number
  unlinkedCount: number
  registered: boolean
  registeredBy: number | null
  registeredAt: string | null
  fees: Array<{ id: number; amount: number; description: string; status: string }>
}

interface Layer3RowDto {
  bankTxId: number
  dateJalali: string
  amount: number
  bankDescription: string
  status: string
  accountingId: number | null
  accountingEntryId: number | null
  accountingDescription: string | null
  linkId: number | null
  matchType: string | null
  confidence: number | null
}

interface Layer4RowDto {
  posTxId: number
  refNumber: string
  cardNumberMasked: string
  branchName: string
  dateJalali: string
  amount: number
  status: string
  accountingId: number | null
  entryId: number | null
  accountingDescription: string | null
  matchType: string | null
  aggregated: boolean
}

interface UploadedFileDto {
  id: number
  templateId: number
  originalFilename: string
  uploadDate: string
  uploadedBy: number | null
  rowCount: number | null
}

interface DashboardStatsDto {
  layer1: { matched: number; pending: number; unmatched: number; manual: number; total: number }
  layer2: { matched: number; pending: number; unmatched: number; manual: number; total: number }
  layer3: { matched: number; pending: number; unmatched: number; manual: number; total: number }
  layer4: { matched: number; pending: number; unmatched: number; manual: number; total: number }
  unregisteredFeeTotal: number
  dateFeeTotal: number | null
}

interface ReportDataDto {
  generatedAt: string
  from: string | null
  to: string | null
  sections: Array<{ section: string; total: number; matched: number }>
  fees: Array<{ dateJalali: string; totalAmount: number; linkedCount: number; unlinkedCount: number; registered: boolean }>
  unmatched: {
    bank: Array<{ dateJalali: string; amount: number; label: string }>
    accounting: Array<{ dateJalali: string; amount: number; label: string }>
    pos: Array<{ dateJalali: string; amount: number; label: string }>
    posSummary: Array<{ dateJalali: string; amount: number; label: string }>
  }
  unregisteredFeeTotal: number
  auditTrail: Array<{ timestamp: string; username: string | null; action: string; entityType: string; entityId: number | null }>
}

interface Window {
  api: {
    electronVersion: string
    auth: {
      login: (username: string, password: string) => Promise<{ user: { id: number; username: string; role: string; forcePasswordChange: boolean }; token: string }>
      logout: (token: string) => Promise<void>
    }
    users: {
      list: () => Promise<Array<{ id: number; username: string; role: string; createdAt: string }>>
      create: (username: string, password: string, role: string) => Promise<number>
      update: (userId: number, role: string) => Promise<void>
      resetPassword: (userId: number, password: string) => Promise<void>
      remove: (userId: number) => Promise<void>
    }
    audit: { list: (filter?: Record<string, string | number | undefined>) => Promise<Array<{ id: number; userId: number | null; action: string; entityType: string; entityId: number | null; oldValue: string | null; newValue: string | null; timestamp: string }>> }
    templates: {
      list: () => Promise<TemplateDto[]>
      get: (id: number) => Promise<TemplateDto | null>
      save: (input: Partial<TemplateDto> & { name: string; type: string }) => Promise<TemplateDto | null>
      remove: (id: number) => Promise<boolean>
    }
    import: {
      upload: (templateId: number, userId?: number | null) => Promise<ImportResultDto | null>
      list: () => Promise<UploadedFileDto[]>
      remove: (fileId: number) => Promise<boolean>
    }
    layer1: { reconcile: () => Promise<{ matched: number; pending: number; unmatched: number }>; list: () => Promise<Layer1RowDto[]> }
    layer2: {
      reconcile: () => Promise<{ matched: number; aggregated: number }>
      list: () => Promise<Layer2RowDto[]>
      register: (dateJalali: string, registered: boolean, userId?: number | null) => Promise<void>
    }
    layer3: {
      reconcile: () => Promise<{ ok: boolean; data?: { matched: number; pending: number; unmatched: number }; error?: string }>
      list: () => Promise<Layer3RowDto[]>
      accept: (linkId: number, userId?: number | null) => Promise<boolean>
      reject: (linkId: number) => Promise<boolean>
    }
    layer4: {
      reconcile: () => Promise<{ ok: boolean; data?: { matched: number; pending: number; unmatched: number }; error?: string }>
      list: () => Promise<Layer4RowDto[]>
    }
    manual: {
      list: (query?: Record<string, string | undefined>) => Promise<Array<{ id: number; system: string; dateJalali: string; amount: number; label: string; suggestion?: boolean }>>
      link: (selection: Array<{ system: string; id: number }>, userId?: number | null) => Promise<number>
      unlink: (linkId: number, userId?: number | null) => Promise<void>
    }
    reports: {
      generate: (from?: string, to?: string) => Promise<ReportDataDto>
      exportPdf: () => Promise<string>
      exportExcel: () => Promise<string>
    }
    dashboard: { stats: (dateJalali?: string) => Promise<DashboardStatsDto> }
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
