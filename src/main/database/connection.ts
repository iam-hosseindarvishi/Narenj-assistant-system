import type { Statement, Database as BSqliteDb } from 'better-sqlite3'

export interface PreparedStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface IDatabaseConnection {
  prepare(sql: string): PreparedStatement
  exec(sql: string): void
  transaction<T>(fn: () => T): T
  close(): void
  pragma(str: string): unknown
}

export class BetterSqliteConnection implements IDatabaseConnection {
  private db: BSqliteDb

  constructor(db: BSqliteDb) {
    this.db = db
  }

  prepare(sql: string): PreparedStatement {
    const stmt: Statement = this.db.prepare(sql)
    return {
      run: (...params: unknown[]) => stmt.run(...params as never[]) as { changes: number; lastInsertRowid: number | bigint },
      get: (...params: unknown[]) => stmt.get(...params as never[]) as unknown,
      all: (...params: unknown[]) => stmt.all(...params as never[]) as unknown[]
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  close(): void {
    this.db.close()
  }

  pragma(str: string): unknown {
    return this.db.pragma(str)
  }
}