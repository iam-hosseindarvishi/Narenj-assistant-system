import type { SheetRow } from './excel-reader'
import type { Template, CleanupRules } from '../../shared/types'

export class TemplateApplier {
  applyCleanupRules(rows: SheetRow[], rules: CleanupRules): SheetRow[] {
    let result = [...rows]

    const skipSet = new Set(rules.skipTopRows)
    result = result.filter((_, index) => !skipSet.has(index + 1))

    if (rules.skipBottomRows > 0) {
      result = result.slice(0, result.length - rules.skipBottomRows)
    }

    return result
  }

  getColumnLetter(letter: string): number {
    let col = 0
    for (let i = 0; i < letter.length; i++) {
      col = col * 26 + (letter.charCodeAt(i) - 64)
    }
    return col - 1
  }

  mapRow(row: SheetRow, template: Template): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [field, colLetter] of Object.entries(template.columnMapping)) {
      const colIndex = this.getColumnLetter(colLetter)
      result[field] = row[colIndex] ?? null
    }
    return result
  }

  mapRows(rows: SheetRow[], template: Template): Record<string, unknown>[] {
    const cleaned = this.applyCleanupRules(rows, template.cleanupRules)
    const dataRows = cleaned.slice(template.cleanupRules.headerRow > 0 ? template.cleanupRules.headerRow - 1 : 0)
    return dataRows.map(row => this.mapRow(row, template))
  }
}