import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { TemplateRepository } from '../../../src/main/templates/template-repository'
import { TemplateSeeder } from '../../../src/main/templates/template-seeder'
import { ExtractionEngine } from '../../../src/main/templates/extraction-engine'
import { DEFAULT_TEMPLATES } from '../../../src/main/templates/default-templates'
import { TemplateType } from '../../../src/shared/types'
import { join } from 'path'

describe('TemplateRepository', () => {
  let db: DatabaseManager
  let repo: TemplateRepository

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))
    repo = new TemplateRepository(conn)
  })

  afterEach(() => {
    db.close()
  })

  it('should create a template', () => {
    const tpl = repo.create(DEFAULT_TEMPLATES[0])
    expect(tpl.id).toBeGreaterThan(0)
    expect(tpl.name).toBe('Bank Keshavarzi')
    expect(tpl.type).toBe(TemplateType.Bank)
  })

  it('should get a template by id', () => {
    const created = repo.create(DEFAULT_TEMPLATES[0])
    const found = repo.getById(created.id)
    expect(found).not.toBeNull()
    expect(found?.name).toBe('Bank Keshavarzi')
  })

  it('should get all templates', () => {
    repo.create(DEFAULT_TEMPLATES[0])
    repo.create(DEFAULT_TEMPLATES[1])
    const all = repo.getAll()
    expect(all.length).toBe(2)
  })

  it('should update a template', () => {
    const created = repo.create(DEFAULT_TEMPLATES[0])
    const updated = repo.update(created.id, { name: 'Updated Bank Template' })
    expect(updated?.name).toBe('Updated Bank Template')
  })

  it('should delete a template', () => {
    const created = repo.create(DEFAULT_TEMPLATES[0])
    const result = repo.delete(created.id)
    expect(result).toBe(true)
    expect(repo.getById(created.id)).toBeNull()
  })

  it('should preserve column mapping through create and read', () => {
    const created = repo.create(DEFAULT_TEMPLATES[0])
    const found = repo.getById(created.id)
    expect(found?.columnMapping.date).toBe('L')
    expect(found?.columnMapping.deposit).toBe('G')
  })

  it('should preserve cleanup rules through create and read', () => {
    const created = repo.create(DEFAULT_TEMPLATES[0])
    const found = repo.getById(created.id)
    expect(found?.cleanupRules.skipTopRows).toContain(1)
    expect(found?.cleanupRules.headerRow).toBe(1)
    expect(found?.cleanupRules.skipBottomRows).toBe(0)
  })

  it('should preserve extraction rules through create and read', () => {
    const created = repo.create(DEFAULT_TEMPLATES[3])
    const found = repo.getById(created.id)
    expect(found?.extractionRules.length).toBe(3)
    expect(found?.extractionRules[0].field).toBe('halavehRef')
  })
})

describe('TemplateSeeder', () => {
  let db: DatabaseManager
  let seeder: TemplateSeeder
  let repo: TemplateRepository

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))
    seeder = new TemplateSeeder(conn)
    repo = new TemplateRepository(conn)
  })

  afterEach(() => {
    db.close()
  })

  it('should seed 4 default templates', () => {
    const count = seeder.seedDefaults()
    expect(count).toBe(4)
    const all = repo.getAll()
    expect(all.length).toBe(4)
  })

  it('should not reseed existing templates', () => {
    seeder.seedDefaults()
    const count = seeder.seedDefaults()
    expect(count).toBe(0)
  })

  it('should seed Bank Keshavarzi template with correct cleanup rules', () => {
    seeder.seedDefaults()
    const all = repo.getAll()
    const bankTpl = all.find(t => t.type === TemplateType.Bank)
    expect(bankTpl).toBeDefined()
    expect(bankTpl?.cleanupRules.skipTopRows).toEqual([1])
    expect(bankTpl?.cleanupRules.headerRow).toBe(1)
    expect(bankTpl?.cleanupRules.skipBottomRows).toBe(0)
  })

  it('should seed Mohkam accounting template with extraction rules', () => {
    seeder.seedDefaults()
    const all = repo.getAll()
    const accTpl = all.find(t => t.type === TemplateType.Accounting)
    expect(accTpl).toBeDefined()
    expect(accTpl?.extractionRules.length).toBe(3)
  })
})

describe('ExtractionEngine', () => {
  let engine: ExtractionEngine

  beforeEach(() => {
    engine = new ExtractionEngine()
  })

  it('should extract branch ID from IR reference using regex', () => {
    const result = engine.applyRule(
      'IR1509550531031100000000388203041693',
      { field: 'branchId', pattern: '^IR.*0{7,}(\\d{7,})', mode: 'regex' }
    )
    expect(result).toBe('388203041693')
  })

  it('should strip IR prefix using formula', () => {
    const result = engine.applyRule(
      'IR1509550531031100000000388203041693',
      { field: 'depositRefClean', pattern: 'stripIR', mode: 'formula' }
    )
    expect(result).toBe('1509550531031100000000388203041693')
  })

  it('should extract halaveh reference from accounting description', () => {
    const result = engine.applyRule(
      'حواله (123456) نارنج 12',
      { field: 'halavehRef', pattern: 'حواله\\s*\\((\\d+)\\)', mode: 'regex' }
    )
    expect(result).toBe('123456')
  })

  it('should extract card last 4 digits from accounting description', () => {
    const result = engine.applyRule(
      'فروش کارت ک 3215 نارنج 12',
      { field: 'cardLast4', pattern: 'ک\\s*(\\d{4})', mode: 'regex' }
    )
    expect(result).toBe('3215')
  })

  it('should extract branch name from accounting description', () => {
    const result = engine.applyRule(
      'فروش نارنج 12 شاپارک',
      { field: 'branchName', pattern: 'نارنج\\s*(\\d+)', mode: 'regex' }
    )
    expect(result).toBe('12')
  })

  it('should return null for no match', () => {
    const result = engine.applyRule(
      'no relevant data',
      { field: 'test', pattern: 'حواله\\s*\\((\\d+)\\)', mode: 'regex' }
    )
    expect(result).toBeNull()
  })

  it('should apply all rules at once', () => {
    const results = engine.applyAllRules('حواله (998877) ک 4567', [
      { field: 'halavehRef', pattern: 'حواله\\s*\\((\\d+)\\)', mode: 'regex' },
      { field: 'cardLast4', pattern: 'ک\\s*(\\d{4})', mode: 'regex' }
    ])
    expect(results.halavehRef).toBe('998877')
    expect(results.cardLast4).toBe('4567')
  })

  it('should handle invalid regex gracefully', () => {
    const result = engine.applyRule(
      'test',
      { field: 'test', pattern: '[invalid', mode: 'regex' }
    )
    expect(result).toBeNull()
  })
})