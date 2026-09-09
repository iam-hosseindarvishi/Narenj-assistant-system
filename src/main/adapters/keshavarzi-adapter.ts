import type { SheetRow } from './excel-reader'
import type { Template } from '../../shared/types'
import { ExtractionEngine } from '../templates/extraction-engine'

export interface NormalizedBankRow {
  rowNumber: number
  dateJalali: string
  time: string
  branchCode: string
  reference: string
  payerPayee: string
  depositRef: string
  depositAmount: number
  withdrawalAmount: number
  balance: number
  description: string
  txType: string
}

export interface IBankAdapter {
  parse(rows: SheetRow[], template: Template): NormalizedBankRow[]
}

export class KeshavarziAdapter implements IBankAdapter {
  private extractionEngine: ExtractionEngine

  constructor() {
    this.extractionEngine = new ExtractionEngine()
  }

  parse(rows: SheetRow[], template: Template): NormalizedBankRow[] {
    const result: NormalizedBankRow[] = []
    const skipSet = new Set(template.cleanupRules.skipTopRows)
    const headerRow = template.cleanupRules.headerRow

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1
      if (skipSet.has(rowNum)) continue
      if (rowNum < headerRow) continue
      if (i >= rows.length - template.cleanupRules.skipBottomRows) continue

      const row = rows[i]
      if (!row || row.length === 0) continue

      const mapped = this.mapRow(row, template)
      if (!mapped.dateJalali && !mapped.reference) continue

      const normalized = this.normalize(mapped, rowNum)
      if (normalized) {
        result.push(normalized)
      }
    }

    return result
  }

  private mapRow(row: SheetRow, template: Template): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [field, colLetter] of Object.entries(template.columnMapping)) {
      const colIndex = this.colToIndex(colLetter)
      result[field] = row[colIndex] ?? null
    }
    return result
  }

  private colToIndex(letter: string): number {
    let col = 0
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64)
    }
    return col - 1
  }

  private normalize(mapped: Record<string, unknown>, rowNum: number): NormalizedBankRow | null {
    const dateJalali = String(mapped.date ?? '').trim()
    if (!dateJalali) return null

    const depositRef = String(mapped.depositRef ?? '').trim()
    const description = String(mapped.description ?? mapped.payerPayee ?? '').trim()

    let branchCode = ''
    if (depositRef && depositRef.startsWith('IR')) {
      const extracted = this.extractionEngine.applyRule(depositRef, {
        field: 'branchId',
        pattern: '^IR.*0{7,}(\\d{7,})',
        mode: 'regex'
      })
      if (extracted) {
        branchCode = extracted.substring(0, 7)
      }
    }

    const txType = this.detectTxType(description)

    return {
      rowNumber: Number(mapped.rowNumber ?? rowNum),
      dateJalali,
      time: String(mapped.time ?? '').trim(),
      branchCode,
      reference: String(mapped.reference ?? '').trim(),
      payerPayee: String(mapped.payerPayee ?? '').trim(),
      depositRef,
      depositAmount: Number(mapped.deposit ?? 0) || 0,
      withdrawalAmount: Number(mapped.withdrawal ?? 0) || 0,
      balance: Number(mapped.balance ?? 0) || 0,
      description,
      txType
    }
  }

  private detectTxType(description: string): string {
    if (description.includes('واريزپايا') || description.includes('شاپارک') || description.includes('مرکزشاپرک')) {
      return 'shaparak'
    }
    if (description.includes('کارمزد') || description.includes('ثبت چک')) {
      return 'fee'
    }
    if (description.includes('چک')) {
      return 'check'
    }
    if (description.includes('انتقال')) {
      return 'transfer'
    }
    return 'other'
  }
}