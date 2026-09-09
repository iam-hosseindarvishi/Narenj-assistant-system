import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { FileImporter } from '../../../src/main/services/file-importer'
import { ExcelReader } from '../../../src/main/adapters/excel-reader'
import { KeshavarziAdapter } from '../../../src/main/adapters/keshavarzi-adapter'
import { PosSummaryAdapter } from '../../../src/main/adapters/pos-summary-adapter'
import { PosTransactionAdapter } from '../../../src/main/adapters/pos-transaction-adapter'
import { MohkamAdapter } from '../../../src/main/adapters/mohkam-adapter'
import { DEFAULT_TEMPLATES } from '../../../src/main/templates/default-templates'
import { TemplateType } from '../../../src/shared/types'
import { join } from 'path'

const INPUTS_DIR = join(__dirname, '..', '..', '..', 'exelcs inputs')

describe('ExcelReader', () => {
  let reader: ExcelReader

  beforeEach(() => {
    reader = new ExcelReader()
  })

  it('should read Bank.xls and fix dimension', () => {
    const rows = reader.readSheet(join(INPUTS_DIR, 'Bank.xls'))
    expect(rows.length).toBe(151)
  })

  it('should read pos_summarize.xlsx and fix dimension', () => {
    const rows = reader.readSheet(join(INPUTS_DIR, 'pos_summarize.xlsx'))
    expect(rows.length).toBe(46)
  })

  it('should read pos_transactions.xlsx and fix dimension', () => {
    const rows = reader.readSheet(join(INPUTS_DIR, 'pos_transactions.xlsx'))
    expect(rows.length).toBe(1121)
  })

  it('should read System.xls', () => {
    const rows = reader.readSheet(join(INPUTS_DIR, 'System.xls'))
    expect(rows.length).toBe(254)
  })
})

describe('KeshavarziAdapter', () => {
  it('should parse Bank.xls to >100 bank transactions', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'Bank.xls'))
    const adapter = new KeshavarziAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[0])
    expect(result.length).toBeGreaterThan(100)
  })

  it('should extract branch code from IR reference', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'Bank.xls'))
    const adapter = new KeshavarziAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[0])
    const withBranch = result.filter(r => r.branchCode.length > 0)
    expect(withBranch.length).toBeGreaterThan(0)
  })

  it('should detect shaparak transactions', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'Bank.xls'))
    const adapter = new KeshavarziAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[0])
    const shaparak = result.filter(r => r.txType === 'shaparak')
    expect(shaparak.length).toBeGreaterThan(0)
  })

  it('should detect transfer transactions', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'Bank.xls'))
    const adapter = new KeshavarziAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[0])
    const transfers = result.filter(r => r.txType === 'transfer')
    expect(transfers.length).toBeGreaterThan(0)
  })
})

describe('PosSummaryAdapter', () => {
  it('should parse pos_summarize.xlsx to 45 summaries', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'pos_summarize.xlsx'))
    const adapter = new PosSummaryAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[1])
    expect(result.length).toBe(45)
  })

  it('should parse branch IDs and amounts', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'pos_summarize.xlsx'))
    const adapter = new PosSummaryAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[1])
    expect(result[0].branchId).toBeTruthy()
    expect(result[0].amount).toBeGreaterThan(0)
  })
})

describe('PosTransactionAdapter', () => {
  it('should parse pos_transactions.xlsx to 1120 transactions', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'pos_transactions.xlsx'))
    const adapter = new PosTransactionAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[2])
    expect(result.length).toBe(1120)
  })

  it('should parse tracking codes and card numbers', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'pos_transactions.xlsx'))
    const adapter = new PosTransactionAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[2])
    expect(result[0].trackingCode).toBeTruthy()
    expect(result[0].cardNumber).toBeTruthy()
  })
})

describe('MohkamAdapter', () => {
  it('should parse System.xls to 254 entries', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'System.xls'))
    const adapter = new MohkamAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[3])
    expect(result.length).toBe(253)
  })

  it('should extract halaveh references', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'System.xls'))
    const adapter = new MohkamAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[3])
    const withHalaveh = result.filter(r => r.halavehRef !== null)
    expect(withHalaveh.length).toBeGreaterThan(0)
  })

  it('should detect entry types', () => {
    const reader = new ExcelReader()
    const rows = reader.readSheet(join(INPUTS_DIR, 'System.xls'))
    const adapter = new MohkamAdapter()
    const result = adapter.parse(rows, DEFAULT_TEMPLATES[3])
    const receipts = result.filter(r => r.entryType === 'receipt')
    expect(receipts.length).toBeGreaterThan(0)
  })
})

describe('FileImporter', () => {
  let db: DatabaseManager
  let importer: FileImporter
  let repo: TemplateRepository

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))
    const seeder = new TemplateSeeder(conn)
    seeder.seedDefaults()
    repo = new TemplateRepository(conn)
    importer = new FileImporter(conn)
  })

  afterEach(() => {
    db.close()
  })

  it('should import Bank.xls into bank_transactions', () => {
    const templates = repo.getAll()
    const bankTpl = templates.find(t => t.type === TemplateType.Bank)!
    const result = importer.importFile(join(INPUTS_DIR, 'Bank.xls'), bankTpl)
    expect(result.parsedRows).toBeGreaterThan(100)
    expect(result.errors.length).toBe(0)
  })

  it('should import pos_summarize.xlsx into pos_summaries', () => {
    const templates = repo.getAll()
    const posTpl = templates.find(t => t.type === TemplateType.PosSummary)!
    const result = importer.importFile(join(INPUTS_DIR, 'pos_summarize.xlsx'), posTpl)
    expect(result.parsedRows).toBe(45)
    expect(result.errors.length).toBe(0)
  })

  it('should import pos_transactions.xlsx into pos_transactions', () => {
    const templates = repo.getAll()
    const posTpl = templates.find(t => t.type === TemplateType.PosDetail)!
    const result = importer.importFile(join(INPUTS_DIR, 'pos_transactions.xlsx'), posTpl)
    expect(result.parsedRows).toBe(1120)
    expect(result.errors.length).toBe(0)
  })

  it('should import System.xls into accounting_entries', () => {
    const templates = repo.getAll()
    const accTpl = templates.find(t => t.type === TemplateType.Accounting)!
    const result = importer.importFile(join(INPUTS_DIR, 'System.xls'), accTpl)
    expect(result.parsedRows).toBe(253)
    expect(result.errors.length).toBe(0)
  })

  it('should create uploaded_files record', () => {
    const templates = repo.getAll()
    const bankTpl = templates.find(t => t.type === TemplateType.Bank)!
    const result = importer.importFile(join(INPUTS_DIR, 'Bank.xls'), bankTpl)
    expect(result.fileId).toBeGreaterThan(0)
  })
})