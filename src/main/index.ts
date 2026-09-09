import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { BetterSqliteConnection } from './database/connection'
import { DatabaseManager } from './database/database-manager'
import { QueryHelper } from './database/query-helper'
import { TemplateRepository } from './templates/template-repository'
import { TemplateSeeder } from './templates/template-seeder'
import { FileImporter } from './services/file-importer'
import { Layer1Reconciler } from './services/layer1-reconciler'
import { Layer2Reconciler } from './services/layer2-reconciler'
import { Layer3Reconciler } from './services/layer3-reconciler'
import { Layer4Reconciler } from './services/layer4-reconciler'
import { ManualMatchingService } from './services/manual-matching-service'
import { AuditLogger } from './services/audit-logger'
import { AuthService } from './auth/auth-service'
import { UserService } from './auth/user-service'
import { ReportGenerator } from './reports/report-generator'
import { UserRole, type CreateTemplateInput } from '../shared/types'

const isDev = !app.isPackaged

/**
 * Opens (or migrates) the single application database and seeds default templates.
 */
function buildDatabase(): DatabaseManager {
  const db = new Database(join(app.getPath('userData'), 'narenj.db'))
  const manager = new DatabaseManager(new BetterSqliteConnection(db))
  manager.runMigrations(join(app.getAppPath(), 'migrations'))
  new TemplateSeeder(manager.getConnection()).seedDefaults()
  return manager
}

/**
 * Registers every IPC channel; handlers only delegate to services.
 */
function registerIpcHandlers(manager: DatabaseManager): void {
  const conn = manager.getConnection()
  const auth = new AuthService(conn)
  const users = new UserService(conn)
  const audit = new AuditLogger(conn)
  const manual = new ManualMatchingService(conn)
  const templates = new TemplateRepository(conn)
  const importer = new FileImporter(conn)
  const queries = new QueryHelper(conn)
  const layer1 = new Layer1Reconciler(conn)
  const layer2 = new Layer2Reconciler(conn)
  const layer3 = new Layer3Reconciler(conn)
  const layer4 = new Layer4Reconciler(conn)
  const reports = new ReportGenerator(conn)

  ipcMain.handle('auth:login', (_event, username: string, password: string) => auth.login(username, password))
  ipcMain.handle('auth:logout', (_event, token: string) => auth.logout(token))
  ipcMain.handle('users:list', () => users.list())
  ipcMain.handle('users:create', (_event, username: string, password: string, role: string) => {
    const id = users.create(username, auth.hashPassword(password), role as UserRole)
    audit.log(null, 'user-create', 'users', id, null, { username, role })
    return id
  })
  ipcMain.handle('users:update', (_event, userId: number, role: string) => {
    users.updateRole(userId, role as UserRole)
    audit.log(userId, 'user-update', 'users', userId, null, { role })
  })
  ipcMain.handle('users:reset-password', (_event, userId: number, password: string) => {
    auth.changePassword(userId, password)
    audit.log(userId, 'user-reset-password', 'users', userId, null, null)
  })
  ipcMain.handle('users:remove', (_event, userId: number) => {
    users.remove(userId)
    audit.log(userId, 'user-remove', 'users', userId, null, null)
  })
  ipcMain.handle('audit:list', (_event, filter) => audit.list(filter))

  ipcMain.handle('templates:list', () => templates.getAll())
  ipcMain.handle('templates:get', (_event, id: number) => templates.getById(id))
  ipcMain.handle('templates:save', (_event, input: CreateTemplateInput & { id?: number }) => {
    if (input.id !== undefined) return templates.update(input.id, input)
    const { id: _omit, ...createInput } = input
    void _omit
    return templates.create(createInput)
  })
  ipcMain.handle('templates:remove', (_event, id: number) => {
    const removed = templates.delete(id)
    if (removed) audit.log(null, 'template-remove', 'templates', id, null, null)
    return removed
  })

  ipcMain.handle('import:upload', async (_event, templateId: number, userId: number | null) => {
    const choice = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xls', 'xlsx'] }]
    })
    if (choice.canceled || choice.filePaths.length === 0) return null
    const template = templates.getById(templateId)
    if (!template) throw new Error('قالب یافت نشد')
    const result = importer.importFile(choice.filePaths[0], template, userId)
    audit.log(userId, 'import', 'uploaded_files', result.fileId, null, { filename: choice.filePaths[0], parsedRows: result.parsedRows })
    return result
  })
  ipcMain.handle('import:list', () => queries.listUploadedFiles())
  ipcMain.handle('import:remove', (_event, fileId: number) => {
    const removed = importer.removeFile(fileId)
    if (removed) audit.log(null, 'import-remove', 'uploaded_files', fileId, null, null)
    return removed
  })

  ipcMain.handle('layer1:reconcile', () => layer1.reconcile())
  ipcMain.handle('layer1:list', () => queries.listLayer1())
  ipcMain.handle('layer2:reconcile', () => layer2.reconcile())
  ipcMain.handle('layer2:list', () => queries.listLayer2())
  ipcMain.handle('layer2:register', (_event, dateJalali: string, registered: boolean, userId: number | null) => layer2.registerFees(dateJalali, registered, userId))
  ipcMain.handle('layer3:reconcile', () => layer3.reconcile())
  ipcMain.handle('layer3:list', () => queries.listLayer3())
  ipcMain.handle('layer3:accept', (_event, linkId: number, userId: number | null) => layer3.acceptSuggestion(linkId, userId))
  ipcMain.handle('layer3:reject', (_event, linkId: number) => layer3.rejectSuggestion(linkId))
  ipcMain.handle('layer4:reconcile', () => layer4.reconcile())
  ipcMain.handle('layer4:list', () => queries.listLayer4())

  ipcMain.handle('manual:list', (_event, query) => manual.list(query))
  ipcMain.handle('manual:link', (_event, selection, userId) => manual.link(selection, userId))
  ipcMain.handle('manual:unlink', (_event, linkId, userId) => manual.unlink(linkId, userId))

  ipcMain.handle('dashboard:stats', () => queries.dashboardStats())
  ipcMain.handle('reports:generate', () => reports.generate())
  ipcMain.handle('reports:exportExcel', () => reports.exportExcel())
  ipcMain.handle('reports:exportPdf', () => reports.exportPdf())
}

/**
 * Creates the main application window.
 */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    void mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  const manager = buildDatabase()
  registerIpcHandlers(manager)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
