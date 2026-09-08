import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { join } from 'path'

describe('DatabaseManager', () => {
  let db: DatabaseManager

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
  })

  afterEach(() => {
    db.close()
  })

  it('should create an in-memory database', () => {
    expect(db).toBeDefined()
    expect(db.getConnection()).toBeDefined()
  })

  it('should run migrations and create all tables', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[]

    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('users')
    expect(tableNames).toContain('banks')
    expect(tableNames).toContain('pos_branches')
    expect(tableNames).toContain('templates')
    expect(tableNames).toContain('uploaded_files')
    expect(tableNames).toContain('bank_transactions')
    expect(tableNames).toContain('pos_summaries')
    expect(tableNames).toContain('pos_transactions')
    expect(tableNames).toContain('accounting_entries')
    expect(tableNames).toContain('reconciliation_links')
    expect(tableNames).toContain('fee_aggregations')
    expect(tableNames).toContain('audit_logs')
  })

  it('should enforce foreign keys', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    expect(() => {
      db.prepare('INSERT INTO bank_transactions (file_id, row_number, date_jalali) VALUES (999, 1, "1403/01/01")').run()
    }).toThrow()
  })

  it('should track applied migrations', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    const applied = db.prepare('SELECT filename FROM schema_migrations').all() as { filename: string }[]
    expect(applied.length).toBe(1)
    expect(applied[0].filename).toContain('create_schema')
  })

  it('should not reapply migrations', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)
    db.runMigrations(migrationsDir)

    const applied = db.prepare('SELECT filename FROM schema_migrations').all() as { filename: string }[]
    expect(applied.length).toBe(1)
  })

  it('should insert and query a user', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', 'hash123', 'admin')
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as { id: number; username: string; role: string }
    expect(user.username).toBe('admin')
    expect(user.role).toBe('admin')
  })

  it('should insert and query a bank transaction with correct types', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', 'hash')
    db.prepare('INSERT INTO banks (name, code) VALUES (?, ?)').run('Bank Keshavarzi', 'BK')
    db.prepare('INSERT INTO templates (name, type, bank_id, column_mapping) VALUES (?, ?, ?, ?)').run('Bank Template', 'bank', 1, '{}')
    db.prepare('INSERT INTO uploaded_files (template_id, original_filename, stored_path) VALUES (?, ?, ?)').run(1, 'test.xls', '/tmp/test.xls')

    db.prepare(`
      INSERT INTO bank_transactions (file_id, row_number, date_jalali, branch_code, deposit_amount, tx_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, '1403/01/01', '3882030', 1000000, 'shaparak', 'unmatched')

    const tx = db.prepare('SELECT * FROM bank_transactions WHERE row_number = 1').get() as { tx_type: string; status: string; deposit_amount: number }
    expect(tx.tx_type).toBe('shaparak')
    expect(tx.status).toBe('unmatched')
    expect(tx.deposit_amount).toBe(1000000)
  })

  it('should reject invalid tx_type', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', 'hash')
    db.prepare('INSERT INTO banks (name, code) VALUES (?, ?)').run('Bank', 'BK')
    db.prepare('INSERT INTO templates (name, type, bank_id, column_mapping) VALUES (?, ?, ?, ?)').run('T', 'bank', 1, '{}')
    db.prepare('INSERT INTO uploaded_files (template_id, original_filename, stored_path) VALUES (?, ?, ?)').run(1, 'f', 'p')

    expect(() => {
      db.prepare(`
        INSERT INTO bank_transactions (file_id, row_number, date_jalali, tx_type)
        VALUES (?, ?, ?, ?)
      `).run(1, 1, '1403/01/01', 'invalid_type')
    }).toThrow()
  })

  it('should reject invalid reconciliation layer', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    expect(() => {
      db.prepare(`
        INSERT INTO reconciliation_links (layer, match_type)
        VALUES (?, ?)
      `).run(5, 'auto')
    }).toThrow()
  })

  it('should support transactions', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    db.transaction(() => {
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('user1', 'hash')
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('user2', 'hash')
    })

    const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    expect(count.count).toBe(2)
  })

  it('should rollback on error in transaction', () => {
    const migrationsDir = join(__dirname, '..', '..', '..', 'migrations')
    db.runMigrations(migrationsDir)

    expect(() => {
      db.transaction(() => {
        db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('user1', 'hash')
        throw new Error('rollback test')
      })
    }).toThrow()

    const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    expect(count.count).toBe(0)
  })
})