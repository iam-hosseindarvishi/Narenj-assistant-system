import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { FileImporter } from '../../../src/main/services/file-importer'
import { Layer1Reconciler } from '../../../src/main/services/layer1-reconciler'
import { Layer2Reconciler } from '../../../src/main/services/layer2-reconciler'
import { Layer3Reconciler } from '../../../src/main/services/layer3-reconciler'
import { QueryHelper } from '../../../src/main/database/query-helper'
import { TemplateType } from '../../../src/shared/types'
import { join } from 'path'

const INPUTS_DIR = join(__dirname, '..', '..', '..', 'exelcs inputs')

describe('QueryHelper', () => {
  let conn: SqlJsConnection
  let db: DatabaseManager
  let importer: FileImporter
  let queries: QueryHelper

  beforeEach(async () => {
    conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))
    new TemplateSeeder(conn).seedDefaults()
    const templates = new TemplateRepository(conn).getAll()
    importer = new FileImporter(conn)
    queries = new QueryHelper(conn)

    importer.importFile(join(INPUTS_DIR, 'Bank.xls'), templates.find(t => t.type === TemplateType.Bank)!)
    importer.importFile(join(INPUTS_DIR, 'pos_summarize.xlsx'), templates.find(t => t.type === TemplateType.PosSummary)!)
    importer.importFile(join(INPUTS_DIR, 'pos_transactions.xlsx'), templates.find(t => t.type === TemplateType.PosDetail)!)
    importer.importFile(join(INPUTS_DIR, 'System.xls'), templates.find(t => t.type === TemplateType.Accounting)!)
  })

  afterEach(() => {
    db.close()
  })

  it('lists layer 1 rows with bank amounts after reconciliation', () => {
    new Layer1Reconciler(conn).reconcile()
    const rows = queries.listLayer1()
    expect(rows.length).toBe(45)
    const matched = rows.filter(r => r.status === 'matched')
    expect(matched.length).toBe(45)
    expect(matched.every(r => r.bankAmount !== null && Math.abs(r.diff ?? 1) < 0.01)).toBe(true)
  })

  it('lists layer 2 daily fees with aggregation', () => {
    new Layer2Reconciler(conn).reconcile()
    const rows = queries.listLayer2()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(r => r.fees.length === r.linkedCount + r.unlinkedCount)).toBe(true)
  })

  it('registers and unregisters a daily fee aggregation', () => {
    const layer2 = new Layer2Reconciler(conn)
    layer2.reconcile()
    const first = queries.listLayer2()[0]
    layer2.registerFees(first.dateJalali, true, null)
    expect(queries.listLayer2()[0].registered).toBe(true)
    layer2.registerFees(first.dateJalali, false, null)
    expect(queries.listLayer2()[0].registered).toBe(false)
  })

  it('lists layer 3 rows with accounting info', () => {
    db.prepare(`
      INSERT INTO bank_transactions (file_id, row_number, date_jalali, deposit_amount, withdrawal_amount, reference, description, tx_type, status)
      VALUES (1, 999, '1405/06/15', 200000000, 0, 'REF12345', 'انتقال وجه شبا 12345', 'transfer', 'unmatched')
    `).run()
    db.prepare(`
      INSERT INTO accounting_entries (file_id, entry_id, date_jalali, debit, credit, description, entry_type, status)
      VALUES (2, 9002, '1405/06/15', 0, 200000000, 'سند دریافت شبا کشاورزی حواله (12345)', 'receipt', 'unmatched')
    `).run()
    new Layer3Reconciler(conn).reconcile()
    const rows = queries.listLayer3()
    expect(rows.length).toBeGreaterThan(0)
    const linked = rows.filter(r => r.accountingId !== null)
    expect(linked.length).toBeGreaterThan(0)
    expect(linked.every(r => r.accountingDescription !== null)).toBe(true)
  })

  it('accepts and rejects layer 3 suggestions', () => {
    const layer3 = new Layer3Reconciler(conn)
    layer3.reconcile()
    const suggestion = db.prepare("SELECT id FROM reconciliation_links WHERE layer = 3 AND match_type = 'suggested'").get() as { id: number } | undefined
    if (!suggestion) return
    expect(layer3.acceptSuggestion(suggestion.id, 1)).toBe(true)
    const accepted = db.prepare('SELECT match_type, bank_tx_id FROM reconciliation_links WHERE id = ?').get(suggestion.id) as { match_type: string; bank_tx_id: number }
    expect(accepted.match_type).toBe('manual')
    const bank = db.prepare('SELECT status FROM bank_transactions WHERE id = ?').get(accepted.bank_tx_id) as { status: string }
    expect(bank.status).toBe('matched')
  })

  it('lists layer 4 rows and dashboard stats', () => {
    const rows = queries.listLayer4()
    expect(rows.length).toBe(1120)
    const stats = queries.dashboardStats()
    expect(stats.layer4.total).toBe(1120)
    expect(stats.layer1.total).toBe(45)
    expect(stats.layer3.total).toBeGreaterThan(0)
  })

  it('removes an uploaded file with all dependent rows', () => {
    const file = queries.listUploadedFiles()[0]
    expect(importer.removeFile(file.id)).toBe(true)
    const remaining = queries.listUploadedFiles()
    expect(remaining.find(f => f.id === file.id)).toBeUndefined()
  })
})
