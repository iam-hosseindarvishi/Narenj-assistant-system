import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { FileImporter } from '../../../src/main/services/file-importer'
import { Layer3Reconciler } from '../../../src/main/services/layer3-reconciler'
import { TemplateType, MatchType, MatchStatus } from '../../../src/shared/types'
import { join } from 'path'

const INPUTS_DIR = join(__dirname, '..', '..', '..', 'exelcs inputs')

describe('Layer3Reconciler', () => {
  let db: DatabaseManager
  let importer: FileImporter
  let reconciler: Layer3Reconciler

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))

    const seeder = new TemplateSeeder(conn)
    seeder.seedDefaults()

    const repo = new TemplateRepository(conn)
    const templates = repo.getAll()

    importer = new FileImporter(conn)
    reconciler = new Layer3Reconciler(conn)

    // Import Bank and Accounting
    const bankTpl = templates.find(t => t.type === TemplateType.Bank)!
    const accTpl = templates.find(t => t.type === TemplateType.Accounting)!
    importer.importFile(join(INPUTS_DIR, 'Bank.xls'), bankTpl)
    importer.importFile(join(INPUTS_DIR, 'System.xls'), accTpl)
  })

  afterEach(() => {
    db.close()
  })

  it('should exclude shaparak and fee bank transactions from candidates', () => {
    const candidates = db.prepare(
      "SELECT * FROM bank_transactions WHERE tx_type IN ('transfer', 'check', 'other')"
    ).all()
    expect(candidates.length).toBeGreaterThan(0)
    const shaparakOrFee = candidates.filter((c: any) => c.tx_type === 'shaparak' || c.tx_type === 'fee')
    expect(shaparakOrFee.length).toBe(0)
  })

  it('should run reconciliation and produce matches and links', () => {
    const bankCandidates = db.prepare("SELECT * FROM bank_transactions WHERE status = 'unmatched' AND tx_type IN ('transfer', 'check', 'other')").all()
    const accEntries = db.prepare("SELECT * FROM accounting_entries WHERE status = 'unmatched'").all()
    expect(bankCandidates.length).toBeGreaterThan(0)
    expect(accEntries.length).toBeGreaterThan(0)

    const res = reconciler.reconcile()
    expect(res.ok).toBe(true)
    expect(res.data).toBeDefined()

    const links = db.prepare('SELECT * FROM reconciliation_links WHERE layer = 3').all()
    expect(links.length).toBe(res.data!.links.length)
  })

  it('should filter out accounting entries with نارنج during disambiguation', () => {
    db.prepare(`
      INSERT INTO bank_transactions (file_id, row_number, date_jalali, deposit_amount, withdrawal_amount, reference, description, tx_type, status)
      VALUES (1, 999, '1405/06/15', 200000000, 0, 'REF12345', 'انتقال وجه شبا 12345', 'transfer', 'unmatched')
    `).run()

    const bankId = (db.prepare('SELECT last_insert_rowid() as id').get() as any).id

    db.prepare(`
      INSERT INTO accounting_entries (file_id, entry_id, date_jalali, debit, credit, description, entry_type, status)
      VALUES 
      (2, 9001, '1405/06/15', 200000000, 0, 'سند دریافت ک 3215 - نارنج 12', 'receipt', 'unmatched'),
      (2, 9002, '1405/06/15', 200000000, 0, 'سند دریافت شبا کشاورزی حواله (12345)', 'receipt', 'unmatched')
    `).run()

    const res = reconciler.reconcile()
    expect(res.ok).toBe(true)

    const link = db.prepare('SELECT * FROM reconciliation_links WHERE bank_tx_id = ?').get(bankId) as any
    expect(link).toBeDefined()
    expect(link.match_type).toBe(MatchType.Auto)

    const accEntry = db.prepare('SELECT * FROM accounting_entries WHERE id = ?').get(link.accounting_id) as any
    expect(accEntry.description).toContain('شبا کشاورزی')
    expect(accEntry.description).not.toContain('نارنج')
  })

  it('should match check numbers between bank and accounting', () => {
    db.prepare(`
      INSERT INTO bank_transactions (file_id, row_number, date_jalali, deposit_amount, withdrawal_amount, description, tx_type, status)
      VALUES (1, 998, '1405/06/20', 50000000, 0, 'واریز چک شماره 987654', 'check', 'unmatched')
    `).run()
    const bankId = (db.prepare('SELECT last_insert_rowid() as id').get() as any).id

    db.prepare(`
      INSERT INTO accounting_entries (file_id, entry_id, date_jalali, debit, credit, description, entry_type, status)
      VALUES 
      (2, 9003, '1405/06/20', 50000000, 0, 'واریز به حساب چک 987654', 'check', 'unmatched'),
      (2, 9004, '1405/06/20', 50000000, 0, 'واریز به حساب چک 111111', 'check', 'unmatched')
    `).run()

    const res = reconciler.reconcile()
    expect(res.ok).toBe(true)

    const link = db.prepare('SELECT * FROM reconciliation_links WHERE bank_tx_id = ?').get(bankId) as any
    expect(link).toBeDefined()
    const accEntry = db.prepare('SELECT * FROM accounting_entries WHERE id = ?').get(link.accounting_id) as any
    expect(accEntry.description).toContain('987654')
  })

  it('should create suggestion for ambiguous unresolvable records without marking matched', () => {
    db.prepare(`
      INSERT INTO bank_transactions (file_id, row_number, date_jalali, deposit_amount, withdrawal_amount, description, tx_type, status)
      VALUES (1, 997, '1405/06/25', 77000000, 0, 'واریز متفرقه', 'other', 'unmatched')
    `).run()
    const bankId = (db.prepare('SELECT last_insert_rowid() as id').get() as any).id

    db.prepare(`
      INSERT INTO accounting_entries (file_id, entry_id, date_jalali, debit, credit, description, entry_type, status)
      VALUES 
      (2, 9005, '1405/06/25', 77000000, 0, 'واریز متفرقه اول', 'other', 'unmatched'),
      (2, 9006, '1405/06/25', 77000000, 0, 'واریز متفرقه دوم', 'other', 'unmatched')
    `).run()

    const res = reconciler.reconcile()
    expect(res.ok).toBe(true)

    const link = db.prepare('SELECT * FROM reconciliation_links WHERE bank_tx_id = ? AND match_type = ?').get(bankId, MatchType.Suggested) as any
    expect(link).toBeDefined()

    const bankTx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(bankId) as any
    expect(bankTx.status).toBe(MatchStatus.Unmatched)
  })
})
