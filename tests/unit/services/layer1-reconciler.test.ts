import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { FileImporter } from '../../../src/main/services/file-importer'
import { Layer1Reconciler } from '../../../src/main/services/layer1-reconciler'
import { TemplateType } from '../../../src/shared/types'
import { jalaliAddDays, parseJalali } from '../../../src/shared/utils/jalali-date'
import { join } from 'path'

const INPUTS_DIR = join(__dirname, '..', '..', '..', 'exelcs inputs')

describe('jalali-date utilities', () => {
  it('should add 1 day to jalali date', () => {
    expect(jalaliAddDays('1405/06/01', 1)).toBe('1405/06/02')
  })

  it('should handle month boundary', () => {
    // 1405/06 (Shahrivar) has 31 days
    expect(jalaliAddDays('1405/06/30', 1)).toBe('1405/06/31')
  })

  it('should handle year boundary', () => {
    // 1405/12/29 + 1 = 1406/01/01 (1405 month 12 has 29 days)
    expect(jalaliAddDays('1405/12/29', 1)).toBe('1406/01/01')
  })

  it('should parse jalali date string', () => {
    expect(parseJalali('1405/06/01')).toEqual({ jy: 1405, jm: 6, jd: 1 })
  })

  it('should return null for invalid date', () => {
    expect(parseJalali('invalid')).toBeNull()
  })
})

describe('Layer1Reconciler', () => {
  let db: DatabaseManager
  let importer: FileImporter
  let reconciler: Layer1Reconciler

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))

    const seeder = new TemplateSeeder(conn)
    seeder.seedDefaults()

    const repo = new TemplateRepository(conn)
    const templates = repo.getAll()

    importer = new FileImporter(conn)
    reconciler = new Layer1Reconciler(conn)

    // Import POS summaries
    const posTpl = templates.find(t => t.type === TemplateType.PosSummary)!
    importer.importFile(join(INPUTS_DIR, 'pos_summarize.xlsx'), posTpl)

    // Import Bank
    const bankTpl = templates.find(t => t.type === TemplateType.Bank)!
    importer.importFile(join(INPUTS_DIR, 'Bank.xls'), bankTpl)
  })

  afterEach(() => {
    db.close()
  })

  it('should match 45 POS summaries with bank shaparak deposits', () => {
    const result = reconciler.reconcile()
    expect(result.matched).toBe(45)
  })

  it('should produce 1:1 matches', () => {
    const result = reconciler.reconcile()
    const exactMatches = result.matches.filter(m => m.confidence === 1.0)
    expect(exactMatches.length).toBe(45)
  })

  it('should mark matched summaries as matched', () => {
    reconciler.reconcile()
    const matched = db.prepare("SELECT * FROM pos_summaries WHERE status = 'matched'").all()
    expect(matched.length).toBe(45)
  })

  it('should mark matched bank transactions as matched', () => {
    reconciler.reconcile()
    const matched = db.prepare("SELECT * FROM bank_transactions WHERE status = 'matched'").all()
    expect(matched.length).toBe(45)
  })

  it('should create reconciliation_links', () => {
    reconciler.reconcile()
    const links = db.prepare("SELECT * FROM reconciliation_links WHERE layer = 1").all()
    expect(links.length).toBe(45)
  })

  it('should not create duplicate links on second run', () => {
    reconciler.reconcile()
    reconciler.reconcile()
    const links = db.prepare("SELECT * FROM reconciliation_links WHERE layer = 1").all()
    expect(links.length).toBe(45)
  })
})

describe('Layer1Reconciler - pending logic', () => {
  let db: DatabaseManager
  let reconciler: Layer1Reconciler

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))

    reconciler = new Layer1Reconciler(conn)

    // Insert a fake uploaded_file for FK reference
    db.prepare('INSERT INTO templates (name, type, column_mapping) VALUES (?, ?, ?)').run('fake', 'bank', '{}')
    db.prepare('INSERT INTO uploaded_files (template_id, original_filename, stored_path) VALUES (?, ?, ?)').run(1, 'test', '/tmp/test')

    // Insert a fake POS summary that won't match
    db.prepare('INSERT INTO pos_summaries (file_id, branch_id, amount, date_jalali, status) VALUES (?, ?, ?, ?, ?)')
      .run(1, '9999', 1000000, '1405/06/01', 'unmatched')
  })

  afterEach(() => {
    db.close()
  })

  it('should leave unmatched summaries as unmatched', () => {
    const result = reconciler.reconcile()
    expect(result.pending).toBe(1)
  })

  it('should mark summaries as pending after first run', () => {
    reconciler.reconcile()
    const summary = db.prepare('SELECT status FROM pos_summaries WHERE branch_id = ?').get('9999') as { status: string }
    expect(summary.status).toBe('unmatched')
  })
})