import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { FileImporter } from '../../../src/main/services/file-importer'
import { Layer2Reconciler } from '../../../src/main/services/layer2-reconciler'
import { TemplateType } from '../../../src/shared/types'
import { join } from 'path'

const INPUTS_DIR = join(__dirname, '..', '..', '..', 'exelcs inputs')

describe('Layer2Reconciler', () => {
  let db: DatabaseManager
  let importer: FileImporter
  let reconciler: Layer2Reconciler

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))

    const seeder = new TemplateSeeder(conn)
    seeder.seedDefaults()

    const repo = new TemplateRepository(conn)
    const templates = repo.getAll()

    importer = new FileImporter(conn)
    reconciler = new Layer2Reconciler(conn)

    // Import Bank
    const bankTpl = templates.find(t => t.type === TemplateType.Bank)!
    importer.importFile(join(INPUTS_DIR, 'Bank.xls'), bankTpl)
  })

  afterEach(() => {
    db.close()
  })

  it('should detect fee transactions in bank', () => {
    const fees = db.prepare("SELECT * FROM bank_transactions WHERE tx_type = 'fee'").all()
    expect(fees.length).toBeGreaterThan(0)
  })

  it('should aggregate unmatched fees by date', () => {
    const result = reconciler.reconcile()
    expect(result.fees.length).toBeGreaterThan(0)
  })

  it('should calculate daily fee totals', () => {
    const result = reconciler.reconcile()
    for (const fee of result.fees) {
      expect(fee.totalAmount).toBeGreaterThan(0)
      expect(fee.dateJalali).toBeTruthy()
    }
  })

  it('should handle no accounting fees gracefully', () => {
    const result = reconciler.reconcile()
    expect(result.matched).toBe(0)
    expect(result.aggregated).toBeGreaterThan(0)
  })

  it('should write fee_aggregations records', () => {
    reconciler.reconcile()
    const aggs = db.prepare('SELECT * FROM fee_aggregations').all()
    expect(aggs.length).toBeGreaterThan(0)
  })

  it('should support marking aggregation as registered', () => {
    reconciler.reconcile()
    const agg = db.prepare('SELECT * FROM fee_aggregations LIMIT 1').get() as { date_jalali: string }
    db.prepare('UPDATE fee_aggregations SET registered = 1 WHERE date_jalali = ?').run(agg.date_jalali)
    const updated = db.prepare('SELECT * FROM fee_aggregations WHERE date_jalali = ?').get(agg.date_jalali) as { registered: number }
    expect(updated.registered).toBe(1)
  })

  it('should exclude matched fees from the next aggregation', () => {
    const result = reconciler.reconcile()
    const firstTotal = result.fees.reduce((sum, fee) => sum + fee.totalAmount, 0)

    expect(firstTotal).toBeGreaterThan(0)
    const second = reconciler.reconcile()

    expect(second.matched).toBe(0)
    expect(second.fees.reduce((sum, fee) => sum + fee.totalAmount, 0)).toBe(firstTotal)
  })
})
