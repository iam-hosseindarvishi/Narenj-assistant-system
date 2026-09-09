import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { FileImporter } from '../../../src/main/services/file-importer'
import { Layer1Reconciler } from '../../../src/main/services/layer1-reconciler'
import { ReportGenerator } from '../../../src/main/reports/report-generator'
import { TemplateType } from '../../../src/shared/types'
import { join } from 'path'

const INPUTS_DIR = join(__dirname, '..', '..', '..', 'exelcs inputs')

describe('ReportGenerator', () => {
  let db: DatabaseManager
  let importer: FileImporter
  let generator: ReportGenerator

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))
    new TemplateSeeder(conn).seedDefaults()
    const templates = new TemplateRepository(conn).getAll()
    importer = new FileImporter(conn)
    generator = new ReportGenerator(conn)

    importer.importFile(join(INPUTS_DIR, 'Bank.xls'), templates.find(t => t.type === TemplateType.Bank)!)
    importer.importFile(join(INPUTS_DIR, 'pos_summarize.xlsx'), templates.find(t => t.type === TemplateType.PosSummary)!)
    importer.importFile(join(INPUTS_DIR, 'System.xls'), templates.find(t => t.type === TemplateType.Accounting)!)
    new Layer1Reconciler(conn).reconcile()
  })

  afterEach(() => {
    db.close()
  })

  it('generates real sections with 45/45 layer 1 after reconciliation', () => {
    const report = generator.generate()
    const layer1 = report.sections.find(s => s.section.includes('لایه ۱'))
    expect(layer1).toBeDefined()
    expect(layer1!.total).toBe(45)
    expect(layer1!.matched).toBe(45)
  })

  it('includes unmatched lists from every system', () => {
    const report = generator.generate()
    expect(Array.isArray(report.unmatched.bank)).toBe(true)
    expect(Array.isArray(report.unmatched.accounting)).toBe(true)
    expect(Array.isArray(report.unmatched.pos)).toBe(true)
    expect(Array.isArray(report.unmatched.posSummary)).toBe(true)
    expect(report.unmatched.accounting.length).toBeGreaterThan(0)
  })

  it('filters by jalali date range', () => {
    const report = generator.generate('1405/06/01', '1405/06/01')
    expect(report.from).toBe('1405/06/01')
    expect(report.to).toBe('1405/06/01')
    expect(report.fees.every(f => f.dateJalali >= '1405/06/01' && f.dateJalali <= '1405/06/01')).toBe(true)
  })

  it('caps audit trail at 20 entries', () => {
    const report = generator.generate()
    expect(report.auditTrail.length).toBeLessThanOrEqual(20)
  })
})
