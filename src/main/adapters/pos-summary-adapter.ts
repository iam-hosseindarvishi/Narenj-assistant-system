import type { SheetRow } from './excel-reader'
import type { Template } from '../../shared/types'

export interface NormalizedPosSummaryRow {
  branchId: string
  branchName: string
  terminalId: string
  txCount: number
  amount: number
  dateJalali: string
}

export interface IPosSummaryAdapter {
  parse(rows: SheetRow[], template: Template): NormalizedPosSummaryRow[]
}

export class PosSummaryAdapter implements IPosSummaryAdapter {
  parse(rows: SheetRow[], template: Template): NormalizedPosSummaryRow[] {
    const result: NormalizedPosSummaryRow[] = []
    const headerRow = template.cleanupRules.headerRow

    for (let i = headerRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue

      const mapped = this.mapRow(row, template)
      if (!mapped.branchId && !mapped.amount) continue

      result.push({
        branchId: String(mapped.branchId ?? '').trim(),
        branchName: String(mapped.branchName ?? '').trim(),
        terminalId: String(mapped.terminalId ?? '').trim(),
        txCount: Number(mapped.txCount ?? 0) || 0,
        amount: Number(mapped.amount ?? 0) || 0,
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