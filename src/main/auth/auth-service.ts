import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import type { IDatabaseConnection } from '../database/connection'
import { UserRole } from '../../shared/types'

export interface AuthUser {
  id: number
  username: string
  role: UserRole
  forcePasswordChange: boolean
}

export interface LoginResult {
  user: AuthUser
  token: string
}

export class AuthService {
  private readonly conn: IDatabaseConnection
  private readonly sessions = new Map<string, AuthUser>()

  constructor(conn: IDatabaseConnection) {
    this.conn = conn
    this.seedAdmin()
  }

  /** Logs a user in and returns an in-memory session token. */
  login(username: string, password: string): LoginResult {
    const row = this.conn.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?').get(username) as { id: number; username: string; password_hash: string; role: UserRole } | undefined
    if (!row || !this.verify(password, row.password_hash)) throw new Error('نام کاربری یا رمز عبور نادرست است')
    const user: AuthUser = { id: row.id, username: row.username, role: row.role, forcePasswordChange: password === 'admin123' }
    const token = randomBytes(32).toString('hex')
    this.sessions.set(token, user)
    return { user, token }
  }

  /** Returns the session user or null when the token is invalid. */
  getSession(token: string): AuthUser | null { return this.sessions.get(token) ?? null }

  /** Ends an in-memory session. */
  logout(token: string): void { this.sessions.delete(token) }

  /** Checks whether a role is allowed to perform an action. */
  can(user: AuthUser, action: 'admin' | 'write' | 'read'): boolean {
    if (user.role === UserRole.Admin) return true
    if (action === 'read') return true
    return action === 'write' && user.role === UserRole.Operator
  }

  /** Changes a user password. */
  changePassword(userId: number, password: string): void { this.conn.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(this.hash(password), userId) }

  /** Hashes a password for storage (salted scrypt). */
  hashPassword(password: string): string { return this.hash(password) }

  private seedAdmin(): void {
    const exists = this.conn.prepare('SELECT id FROM users WHERE username = ?').get('admin')
    if (!exists) this.conn.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', this.hash('admin123'), UserRole.Admin)
  }

  private hash(password: string): string {
    const salt = randomBytes(16).toString('hex')
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
  }

  private verify(password: string, encoded: string): boolean {
    const [salt, value] = encoded.split(':')
    if (!salt || !value) return false
    const expected = Buffer.from(value, 'hex')
    const actual = scryptSync(password, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }
}
