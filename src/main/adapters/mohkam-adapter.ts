import type { SheetRow } from './excel-reader'
import type { Template } from '../../shared/types'
import { ExtractionEngine } from '../templates/extraction-engine'

export interface NormalizedAccountingRow {
  entryId: number
  dateJalali: string
  debit: number
  credit: number
  description: string
  entryType: string
  halavehRef: string | null
  cardLast4: string | null
  branchName: string | null
}

export interface IAccountingAdapter {
  parse(rows: SheetRow[], template: Template): NormalizedAccountingRow[]
}

export class MohkamAdapter implements IAccountingAdapter {
  private extractionEngine: ExtractionEngine

  constructor() {
    this.extractionEngine = new ExtractionEngine()
  }

  parse(rows: SheetRow[], template: Template): NormalizedAccountingRow[] {
    const result: NormalizedAccountingRow[] = []
    const headerRow = template.cleanupRules.headerRow

    for (let i = headerRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue

      const mapped = this.mapRow(row, template)
      if (!mapped.date && !mapped.description) continue

      const description = String(mapped.description ?? '').trim()
      const extractionResults = this.extractionEngine.applyAllRules(description, template.extractionRules)

      result.push({
        entryId: Number(mapped.entryId ?? 0) || 0,
        dateJalali: String(mapped.date ?? '').trim(),
        debit: Number(mapped.debit ?? 0) || 0,
        credit: Number(mapped.credit ?? 0) || 0,
        description,
        entryType: this.detectEntryType(description),
        halavehRef: extractionResults.halavehRef ?? null,
        cardLast4: extractionResults.cardLast4 ?? null,
        branchName: extractionResults.branchName ?? null
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

  private detectEntryType(description: string): string {
    if (description.includes('سند دریافت')) return 'receipt'
    if (description.includes('سند پرداخت')) return 'payment'
    if (description.includes('کارمزد')) return 'fee'
    if (description.includes('چک')) return 'check'
    return 'other'
  }
}