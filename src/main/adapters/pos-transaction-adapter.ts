import type { SheetRow } from './excel-reader'
import type { Template } from '../../shared/types'

export interface NormalizedPosTransactionRow {
  trackingCode: string
  cardNumber: string
  branchName: string
  time: string
  amount: number
  status: string
  dateJalali: string
}

export interface IPosTransactionAdapter {
  parse(rows: SheetRow[], template: Template): NormalizedPosTransactionRow[]
}

export class PosTransactionAdapter implements IPosTransactionAdapter {
  parse(rows: SheetRow[], template: Template): NormalizedPosTransactionRow[] {
    const result: NormalizedPosTransactionRow[] = []
    const headerRow = template.cleanupRules.headerRow

    for (let i = headerRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue

      const mapped = this.mapRow(row, template)
      if (!mapped.trackingCode && !mapped.amount) continue

      result.push({
        trackingCode: String(mapped.trackingCode ?? '').trim(),
        cardNumber: String(mapped.cardNumber ?? '').trim(),
        branchName: String(mapped.branchName ?? '').trim(),
        time: String(mapped.time ?? '').trim(),
        amount: Number(mapped.amount ?? 0) || 0,
        status: String(mapped.status ?? '').trim(),
        dateJalali: String(mapped.date ?? '').trim()
      })
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
}