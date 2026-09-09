import type { IDatabaseConnection } from '../database/connection'
import type { Template, CreateTemplateInput } from '../../shared/types'
import { TemplateType } from '../../shared/types'
import { ExcelReader } from '../adapters/excel-reader'
import { KeshavarziAdapter } from '../adapters/keshavarzi-adapter'
import { PosSummaryAdapter } from '../adapters/pos-summary-adapter'
import { PosTransactionAdapter } from '../adapters/pos-transaction-adapter'
import { MohkamAdapter } from '../adapters/mohkam-adapter'

export interface ImportResult {
  totalRows: number
  parsedRows: number
  skippedRows: number
  errors: string[]
  fileId: number
}

export class FileImporter {
  private conn: IDatabaseConnection
  private excelReader: ExcelReader

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
    this.excelReader = new ExcelReader()
  }

  importFile(filePath: string, template: Template, uploadedBy: number | null = null): ImportResult {
    const errors: string[] = []
    let totalRows = 0
    let parsedRows = 0

    try {
      const rows = this.excelReader.readSheet(filePath)
      totalRows = rows.length

      const templateId = template.id
      const fileResult = this.conn.prepare(
        'INSERT INTO uploaded_files (template_id, original_filename, stored_path, uploaded_by) VALUES (?, ?, ?, ?)'
      ).run(templateId, filePath, filePath, uploadedBy)
      const fileId = Number(fileResult.lastInsertRowid)

      if (template.type === TemplateType.Bank) {
        parsedRows = this.importBank(rows, template, fileId)
      } else if (template.type === TemplateType.PosSummary) {
        parsedRows = this.importPosSummary(rows, template, fileId)
      } else if (template.type === TemplateType.PosDetail) {
        parsedRows = this.importPosTransactions(rows, template, fileId)
      } else if (template.type === TemplateType.Accounting) {
        parsedRows = this.importAccounting(rows, template, fileId)
      }

      this.conn.prepare('UPDATE uploaded_files SET row_count = ? WHERE id = ?').run(parsedRows, fileId)

      return {
        totalRows,
        parsedRows,
        skippedRows: totalRows - parsedRows,
        errors,
        fileId
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
      return { totalRows, parsedRows, skippedRows: totalRows - parsedRows, errors, fileId: 0 }
    }
  }

  /**
   * Removes an uploaded file and every dependent record inside a transaction.
   */
  removeFile(fileId: number): boolean {
    const file = this.conn.prepare('SELECT id FROM uploaded_files WHERE id = ?').get(fileId) as { id: number } | undefined
    if (!file) return false
    this.conn.transaction(() => {
      this.conn.prepare(`
        DELETE FROM reconciliation_links WHERE
          bank_tx_id IN (SELECT id FROM bank_transactions WHERE file_id = ?) OR
          pos_summary_id IN (SELECT id FROM pos_summaries WHERE file_id = ?) OR
          pos_tx_id IN (SELECT id FROM pos_transactions WHERE file_id = ?) OR
          accounting_id IN (SELECT id FROM accounting_entries WHERE file_id = ?)
      `).run(fileId, fileId, fileId, fileId)
      this.conn.prepare('DELETE FROM bank_transactions WHERE file_id = ?').run(fileId)
      this.conn.prepare('DELETE FROM pos_summaries WHERE file_id = ?').run(fileId)
      this.conn.prepare('DELETE FROM pos_transactions WHERE file_id = ?').run(fileId)
      this.conn.prepare('DELETE FROM accounting_entries WHERE file_id = ?').run(fileId)
      this.conn.prepare('DELETE FROM uploaded_files WHERE id = ?').run(fileId)
    })
    return true
  }

  private importBank(rows: unknown[][], template: Template, fileId: number): number {
    const adapter = new KeshavarziAdapter()
    const normalized = adapter.parse(rows, template)

    const stmt = this.conn.prepare(
      `INSERT INTO bank_transactions (file_id, row_number, date_jalali, time, branch_code, reference, payer_payee, deposit_ref, deposit_amount, withdrawal_amount, balance, description, tx_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    for (const tx of normalized) {
      stmt.run(fileId, tx.rowNumber, tx.dateJalali, tx.time, tx.branchCode, tx.reference, tx.payerPayee, tx.depositRef, tx.depositAmount, tx.withdrawalAmount, tx.balance, tx.description, tx.txType, 'unmatched')
    }

    return normalized.length
  }

  private importPosSummary(rows: unknown[][], template: Template, fileId: number): number {
    const adapter = new PosSummaryAdapter()
    const normalized = adapter.parse(rows, template)

    const stmt = this.conn.prepare(
      `INSERT INTO pos_summaries (file_id, branch_id, branch_name, terminal_id, tx_count, amount, date_jalali, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )

    for (const s of normalized) {
      stmt.run(fileId, s.branchId, s.branchName, s.terminalId, s.txCount, s.amount, s.dateJalali, 'unmatched')
    }

    return normalized.length
  }

  private importPosTransactions(rows: unknown[][], template: Template, fileId: number): number {
    const adapter = new PosTransactionAdapter()
    const normalized = adapter.parse(rows, template)

    const stmt = this.conn.prepare(
      `INSERT INTO pos_transactions (file_id, ref_number, card_number_masked, branch_name, time, amount, pos_status, date_jalali, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    for (const t of normalized) {
      stmt.run(fileId, t.trackingCode, t.cardNumber, t.branchName, t.time, t.amount, t.status, t.dateJalali, 'unmatched')
    }

    return normalized.length
  }

  private importAccounting(rows: unknown[][], template: Template, fileId: number): number {
    const adapter = new MohkamAdapter()
    const normalized = adapter.parse(rows, template)

    const stmt = this.conn.prepare(
      `INSERT INTO accounting_entries (file_id, entry_id, date_jalali, debit, credit, description, entry_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )

    for (const e of normalized) {
      stmt.run(fileId, e.entryId, e.dateJalali, e.debit, e.credit, e.description, e.entryType, 'unmatched')
    }

    return normalized.length
  }
}