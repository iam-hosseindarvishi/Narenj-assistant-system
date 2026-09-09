import type { IDatabaseConnection } from '../database/connection'
import { UserRole } from '../../shared/types'

export interface UserRecord {
  id: number
  username: string
  role: UserRole
  createdAt: string
}

export class UserService {
  private readonly conn: IDatabaseConnection

  constructor(conn: IDatabaseConnection) { this.conn = conn }

  /** Lists users without exposing password hashes. */
  list(): UserRecord[] {
    return this.conn.prepare('SELECT id, username, role, created_at as createdAt FROM users ORDER BY username').all() as UserRecord[]
  }

  /** Creates a user with a supplied password hash. */
  create(username: string, passwordHash: string, role: UserRole): number {
    const result = this.conn.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, role)
    return Number(result.lastInsertRowid)
  }

  /** Updates a user's role. */
  updateRole(userId: number, role: UserRole): void { this.conn.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId) }

  /** Deletes a user. */
  remove(userId: number): void { this.conn.prepare('DELETE FROM users WHERE id = ?').run(userId) }
}
