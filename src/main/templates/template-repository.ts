import type { IDatabaseConnection } from '../database/connection'
import type { Template, CreateTemplateInput, CleanupRules, ExtractionRule } from '../../shared/types'
import { TemplateType } from '../../shared/types'

interface TemplateRow {
  id: number
  name: string
  type: string
  bank_id: number | null
  column_mapping: string
  cleanup_rules: string
  extraction_rules: string
  created_by: number | null
  created_at: string
}

export class TemplateRepository {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
  }

  create(input: CreateTemplateInput, createdBy: number | null = null): Template {
    const columnMapping = JSON.stringify(input.columnMapping)
    const cleanupRules = JSON.stringify(input.cleanupRules)
    const extractionRules = JSON.stringify(input.extractionRules)

    const result = this.conn.prepare(
      `INSERT INTO templates (name, type, bank_id, column_mapping, cleanup_rules, extraction_rules, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(input.name, input.type, input.bankId, columnMapping, cleanupRules, extractionRules, createdBy)

    return this.getById(Number(result.lastInsertRowid)) as Template
  }

  getById(id: number): Template | null {
    const rows = this.conn.prepare('SELECT * FROM templates WHERE id = ?').all(id) as TemplateRow[]
    if (!rows || rows.length === 0) return null
    const row = rows[0]
    if (!row || row.id === undefined || row.id === null) return null
    return this.mapRow(row)
  }

  getAll(): Template[] {
    const rows = this.conn.prepare('SELECT * FROM templates ORDER BY id').all() as TemplateRow[]
    return rows.map(r => this.mapRow(r))
  }

  update(id: number, input: Partial<CreateTemplateInput>): Template | null {
    const existing = this.getById(id)
    if (!existing) return null

    const columnMapping = input.columnMapping ? JSON.stringify(input.columnMapping) : JSON.stringify(existing.columnMapping)
    const cleanupRules = input.cleanupRules ? JSON.stringify(input.cleanupRules) : JSON.stringify(existing.cleanupRules)
    const extractionRules = input.extractionRules ? JSON.stringify(input.extractionRules) : JSON.stringify(existing.extractionRules)
    const name = input.name ?? existing.name
    const type = input.type ?? existing.type
    const bankId = input.bankId !== undefined ? input.bankId : existing.bankId

    this.conn.prepare(
      `UPDATE templates SET name = ?, type = ?, bank_id = ?, column_mapping = ?, cleanup_rules = ?, extraction_rules = ? WHERE id = ?`
    ).run(name, type, bankId, columnMapping, cleanupRules, extractionRules, id)

    return this.getById(id)
  }

  delete(id: number): boolean {
    const result = this.conn.prepare('DELETE FROM templates WHERE id = ?').run(id)
    return result.changes > 0
  }

  private mapRow(row: TemplateRow): Template {
    return {
      id: row.id,
      name: row.name,
      type: row.type as TemplateType,
      bankId: row.bank_id,
      columnMapping: JSON.parse(row.column_mapping) as Record<string, string>,
      cleanupRules: JSON.parse(row.cleanup_rules) as CleanupRules,
      extractionRules: JSON.parse(row.extraction_rules) as ExtractionRule[],
      createdBy: row.created_by,
      createdAt: row.created_at
    }
  }
}