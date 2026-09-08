export enum TxType {
  Shaparak = 'shaparak',
  Fee = 'fee',
  Check = 'check',
  Transfer = 'transfer',
  Other = 'other'
}

export enum MatchStatus {
  Unmatched = 'unmatched',
  Pending = 'pending',
  Matched = 'matched',
  Manual = 'manual'
}

export enum MatchType {
  Auto = 'auto',
  Manual = 'manual',
  Suggested = 'suggested'
}

export enum ReconciliationLayer {
  Layer1 = 1,
  Layer2 = 2,
  Layer3 = 3,
  Layer4 = 4
}

export interface NormalizedBankTx {
  readonly id: number
  readonly fileId: number
  readonly dateJalali: string
  readonly time: string
  readonly branchCode: string
  readonly reference: string
  readonly depositor: string
  readonly depositRef: string
  readonly deposit: number
  readonly withdrawal: number
  readonly amount: number
  readonly txType: TxType
}

export interface NormalizedPosSummary {
  readonly branchId: string
  readonly branchName: string
  readonly terminalId: string
  readonly txCount: number
  readonly amount: number
  readonly dateJalali: string
}

export interface NormalizedPosTransaction {
  readonly trackingCode: string
  readonly cardNumber: string
  readonly branchName: string
  readonly time: string
  readonly amount: number
  readonly status: string
}

export interface NormalizedAccountingEntry {
  readonly entryId: number
  readonly dateJalali: string
  readonly debit: number
  readonly credit: number
  readonly description: string
}

export interface ReconciliationLink {
  readonly layer: ReconciliationLayer
  readonly matchType: MatchType
  readonly bankTxId?: number
  readonly posSummaryKey?: string
  readonly accountingEntryId?: number
  readonly matchedBy: string
}

export interface ReconciliationResult {
  readonly matched: number
  readonly pending: number
  readonly unmatched: number
  readonly links: ReconciliationLink[]
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string }

export enum TemplateType {
  Bank = 'bank',
  PosSummary = 'pos_summary',
  PosDetail = 'pos_detail',
  Accounting = 'accounting'
}

export interface CleanupRules {
  readonly skipTopRows: number[]
  readonly skipBottomRows: number
  readonly headerRow: number
}

export interface ExtractionRule {
  readonly field: string
  readonly pattern: string
  readonly mode: 'regex' | 'formula'
}

export interface Template {
  readonly id: number
  readonly name: string
  readonly type: TemplateType
  readonly bankId: number | null
  readonly columnMapping: Record<string, string>
  readonly cleanupRules: CleanupRules
  readonly extractionRules: ExtractionRule[]
  readonly createdBy: number | null
  readonly createdAt: string
}

export interface CreateTemplateInput {
  readonly name: string
  readonly type: TemplateType
  readonly bankId: number | null
  readonly columnMapping: Record<string, string>
  readonly cleanupRules: CleanupRules
  readonly extractionRules: ExtractionRule[]
}