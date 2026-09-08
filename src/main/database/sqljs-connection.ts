import initSqlJs, { type Database as SqlJsDb, type Statement as SqlJsStmt } from 'sql.js'
import type { IDatabaseConnection, PreparedStatement } from './connection'

export class SqlJsConnection implements IDatabaseConnection {
  private db: SqlJsDb
  private transactionDepth = 0

  constructor(db: SqlJsDb) {
    this.db = db
  }

  static async create(): Promise<SqlJsConnection> {
    const SQL = await initSqlJs()
    return new SqlJsConnection(new SQL.Database())
  }

  prepare(sql: string): PreparedStatement {
    return {
      run: (...params: unknown[]) => {
        const stmt = this.db.prepare(sql)
        stmt.bind(params as never[])
        stmt.step()
        const changes = this.db.getRowsModified()
        const lastId = (this.db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] as number) ?? 0
        stmt.free()
        return { changes, lastInsertRowid: lastId }
      },
      get: (...params: unknown[]) => {
        const stmt = this.db.prepare(sql)
        stmt.bind(params as never[])
        stmt.step()
        const result = stmt.getAsObject() as unknown
        stmt.free()
        return result
      },
      all: (...params: unknown[]) => {
        const stmt = this.db.prepare(sql)
        stmt.bind(params as never[])
        const results: unknown[] = []
        while (stmt.step()) {
          results.push(stmt.getAsObject())
        }
        stmt.free()
        return results
      }
    }
  }

  exec(sql: string): void {
    this.db.run(sql)
  }

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth === 0) {
      this.db.run('BEGIN')
    }
    this.transactionDepth++
    try {
      const result = fn()
      this.transactionDepth--
      if (this.transactionDepth === 0) {
        this.db.run('COMMIT')
      }
      return result
    } catch (e) {
      this.transactionDepth--
      if (this.transactionDepth === 0) {
        this.db.run('ROLLBACK')
      }
      throw e
    }
  }

  close(): void {
    this.db.close()
  }

  pragma(str: string): unknown {
    const result = this.db.exec(`PRAGMA ${str}`)
    return result
  }
}