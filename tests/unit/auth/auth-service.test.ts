import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../../../src/main/database/database-manager'
import { SqlJsConnection } from '../../../src/main/database/sqljs-connection'
import { AuthService } from '../../../src/main/auth/auth-service'
import { UserService } from '../../../src/main/auth/user-service'
import { UserRole } from '../../../src/shared/types'
import { join } from 'path'

describe('AuthService + UserService', () => {
  let db: DatabaseManager
  let auth: AuthService
  let users: UserService

  beforeEach(async () => {
    const conn = await SqlJsConnection.create()
    db = new DatabaseManager(conn)
    db.runMigrations(join(__dirname, '..', '..', '..', 'migrations'))
    auth = new AuthService(conn)
    users = new UserService(conn)
  })

  afterEach(() => {
    db.close()
  })

  it('seeds an admin user and allows login with admin/admin123', () => {
    const result = auth.login('admin', 'admin123')
    expect(result.user.username).toBe('admin')
    expect(result.user.role).toBe(UserRole.Admin)
    expect(result.token.length).toBeGreaterThan(0)
    expect(auth.getSession(result.token)?.username).toBe('admin')
  })

  it('rejects wrong credentials', () => {
    expect(() => auth.login('admin', 'wrong')).toThrow()
    expect(() => auth.login('ghost', 'admin123')).toThrow()
  })

  it('logs out and invalidates the session token', () => {
    const result = auth.login('admin', 'admin123')
    auth.logout(result.token)
    expect(auth.getSession(result.token)).toBeNull()
  })

  it('creates users, updates roles, resets passwords and removes them', () => {
    const id = users.create('operator1', auth.hashPassword('pass123'), UserRole.Operator)
    expect(users.list().some(u => u.id === id && u.username === 'operator1')).toBe(true)

    const login = auth.login('operator1', 'pass123')
    expect(login.user.role).toBe(UserRole.Operator)

    users.updateRole(id, UserRole.Viewer)
    expect(auth.login('operator1', 'pass123').user.role).toBe(UserRole.Viewer)

    auth.changePassword(id, 'newpass456')
    expect(() => auth.login('operator1', 'pass123')).toThrow()
    expect(auth.login('operator1', 'newpass456').user.username).toBe('operator1')

    users.remove(id)
    expect(users.list().some(u => u.id === id)).toBe(false)
    expect(() => auth.login('operator1', 'newpass456')).toThrow()
  })

  it('enforces role permissions', () => {
    const admin = auth.login('admin', 'admin123').user
    const id = users.create('viewer1', auth.hashPassword('v'), UserRole.Viewer)
    const viewer = auth.login('viewer1', 'v').user
    expect(auth.can(admin, 'admin')).toBe(true)
    expect(auth.can(viewer, 'read')).toBe(true)
    expect(auth.can(viewer, 'write')).toBe(false)
    expect(auth.can(viewer, 'admin')).toBe(false)
    void id
  })
})
