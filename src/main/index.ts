import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { ManualMatchingService } from './services/manual-matching-service'
import { AuthService } from './auth/auth-service'
import { UserService } from './auth/user-service'
import { AuditLogger } from './services/audit-logger'
import { BetterSqliteConnection } from './database/connection'
import { DatabaseManager } from './database/database-manager'
import Database from 'better-sqlite3'

const isDev = !app.isPackaged
let manualMatching: ManualMatchingService | null = null

function registerManualMatching(): void {
  const db = new Database(join(app.getPath('userData'), 'narenj.db'))
  const manager = new DatabaseManager(new BetterSqliteConnection(db))
  manager.runMigrations(join(__dirname, '../../migrations'))
  manualMatching = new ManualMatchingService(manager.getConnection())
  const auth = new AuthService(manager.getConnection())
  const users = new UserService(manager.getConnection())
  const audit = new AuditLogger(manager.getConnection())
  ipcMain.handle('auth:login', (_event, username: string, password: string) => auth.login(username, password))
  ipcMain.handle('auth:logout', (_event, token: string) => auth.logout(token))
  ipcMain.handle('users:list', () => users.list())
  ipcMain.handle('audit:list', (_event, filter) => audit.list(filter))
  ipcMain.handle('manual:list', (_event, query) => manualMatching?.list(query) ?? [])
  ipcMain.handle('manual:link', (_event, selection, userId) => manualMatching?.link(selection, userId))
  ipcMain.handle('manual:unlink', (_event, linkId, userId) => manualMatching?.unlink(linkId, userId))
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
  registerManualMatching()
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