import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'

export type SheetRow = unknown[]

export class ExcelReader {
  readWorkbook(filePath: string): XLSX.WorkBook {
    const data = readFileSync(filePath)
    return XLSX.read(data, { type: 'buffer' })
  }

  readSheet(filePath: string, sheetIndex: number = 0): SheetRow[] {
    const wb = this.readWorkbook(filePath)
    const sheetName = wb.SheetNames[sheetIndex]
    const sheet = wb.Sheets[sheetName]
    this.fixDimension(sheet)
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as SheetRow[]
  }

  private fixDimension(sheet: XLSX.WorkSheet): void {
    const currentRef = sheet['!ref']
    if (currentRef) {
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][]
      if (rows.length > 1) return
    }

    delete sheet['!ref']

    let maxRow = 0
    let maxCol = 0
    for (const key in sheet) {
      if (key.startsWith('!')) continue
      const match = key.match(/^([A-Z]+)(\d+)$/)
      if (match) {
        const col = XLSX.utils.decode_col(match[1])
        const row = parseInt(match[2], 10)
        if (row > maxRow) maxRow = row
        if (col > maxCol) maxCol = col
      }
    }

    if (maxRow > 0) {
      sheet['!ref'] = `A1:${XLSX.utils.encode_col(maxCol)}${maxRow}`
    }
  }
}