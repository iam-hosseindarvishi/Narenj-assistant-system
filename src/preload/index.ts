import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token)
  },
  users: { list: () => ipcRenderer.invoke('users:list') },
  audit: { list: (filter = {}) => ipcRenderer.invoke('audit:list', filter) },
  electronVersion: process.versions.electron,
  manual: {
    list: (query = {}) => ipcRenderer.invoke('manual:list', query),
    link: (selection: unknown[], userId: number | null = null) => ipcRenderer.invoke('manual:link', selection, userId),
    unlink: (linkId: number, userId: number | null = null) => ipcRenderer.invoke('manual:unlink', linkId, userId)
  }
})
