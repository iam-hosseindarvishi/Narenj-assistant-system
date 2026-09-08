import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import type { IDatabaseConnection } from './connection'

export interface DatabaseConfig {
  dbPath: string
}

export class DatabaseManager {
  private conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
    this.conn.pragma('journal_mode = WAL')
    this.conn.pragma('foreign_keys = ON')
  }

  getConnection(): IDatabaseConnection {
    return this.conn
  }

  runMigrations(migrationsDir: string): void {
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    const applied = this.conn.prepare('SELECT filename FROM schema_migrations').all() as { filename: string }[]
    const appliedSet = new Set(applied.map(a => a.filename))

    for (const file of files) {
      if (appliedSet.has(file)) continue
      const sql = readFileSync(join(migrationsDir, file), 'utf-8')
      this.conn.exec(sql)
      this.conn.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file)
    }
  }

  prepare(sql: string) {
    return this.conn.prepare(sql)
  }

  exec(sql: string): void {
    this.conn.exec(sql)
  }

  transaction<T>(fn: () => T): T {
    return this.conn.transaction(fn)
  }

  close(): void {
    this.conn.close()
  }
}