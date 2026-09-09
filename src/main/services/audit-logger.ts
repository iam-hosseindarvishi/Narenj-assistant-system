import type { IDatabaseConnection } from '../database/connection'

export interface AuditEntry {
  id: number
  userId: number | null
  action: string
  entityType: string
  entityId: number | null
  oldValue: string | null
  newValue: string | null
  timestamp: string
}

export interface AuditFilter {
  userId?: number
  action?: string
  entityType?: string
  from?: string
  to?: string
}

export class AuditLogger {
  private readonly conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) { this.conn = conn }

  /** Writes a JSON audit record. */
  log(userId: number | null, action: string, entityType: string, entityId: number | null, oldValue: unknown, newValue: unknown): void {
    this.conn.prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)').run(userId, action, entityType, entityId, this.json(oldValue), this.json(newValue))
  }

  /** Returns audit records matching the supplied filters. */
  list(filter: AuditFilter = {}): AuditEntry[] {
    const clauses: string[] = []
    const values: unknown[] = []
    if (filter.userId !== undefined) { clauses.push('user_id = ?'); values.push(filter.userId) }
    if (filter.action) { clauses.push('action = ?'); values.push(filter.action) }
    if (filter.entityType) { clauses.push('entity_type = ?'); values.push(filter.entityType) }
    if (filter.from) { clauses.push('timestamp >= ?'); values.push(filter.from) }
    if (filter.to) { clauses.push('timestamp <= ?'); values.push(filter.to) }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    return this.conn.prepare(`SELECT id, user_id as userId, action, entity_type as entityType, entity_id as entityId, old_value as oldValue, new_value as newValue, timestamp FROM audit_logs ${where} ORDER BY timestamp DESC`).all(...values) as AuditEntry[]
  }

  private json(value: unknown): string | null { return value === undefined || value === null ? null : JSON.stringify(value) }
}
