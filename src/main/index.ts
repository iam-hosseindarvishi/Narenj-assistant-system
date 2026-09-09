import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { ManualMatchingService } from './services/manual-matching-service'
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