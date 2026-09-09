import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token)
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (username: string, password: string, role: string) => ipcRenderer.invoke('users:create', username, password, role),
    update: (userId: number, role: string) => ipcRenderer.invoke('users:update', userId, role),
    resetPassword: (userId: number, password: string) => ipcRenderer.invoke('users:reset-password', userId, password),
    remove: (userId: number) => ipcRenderer.invoke('users:remove', userId)
  },
  audit: { list: (filter = {}) => ipcRenderer.invoke('audit:list', filter) },
  templates: {
    list: () => ipcRenderer.invoke('templates:list'),
    get: (id: number) => ipcRenderer.invoke('templates:get', id),
    save: (input: unknown) => ipcRenderer.invoke('templates:save', input),
    remove: (id: number) => ipcRenderer.invoke('templates:remove', id)
  },
  import: {
    upload: (templateId: number, userId: number | null = null) => ipcRenderer.invoke('import:upload', templateId, userId),
    list: () => ipcRenderer.invoke('import:list'),
    remove: (fileId: number) => ipcRenderer.invoke('import:remove', fileId)
  },
  layer1: {
    reconcile: () => ipcRenderer.invoke('layer1:reconcile'),
    list: () => ipcRenderer.invoke('layer1:list')
  },
  layer2: {
    reconcile: () => ipcRenderer.invoke('layer2:reconcile'),
    list: () => ipcRenderer.invoke('layer2:list'),
    register: (dateJalali: string, registered: boolean, userId: number | null = null) => ipcRenderer.invoke('layer2:register', dateJalali, registered, userId)
  },
  layer3: {
    reconcile: () => ipcRenderer.invoke('layer3:reconcile'),
    list: () => ipcRenderer.invoke('layer3:list'),
    accept: (linkId: number, userId: number | null = null) => ipcRenderer.invoke('layer3:accept', linkId, userId),
    reject: (linkId: number) => ipcRenderer.invoke('layer3:reject', linkId)
  },
  layer4: {
    reconcile: () => ipcRenderer.invoke('layer4:reconcile'),
    list: () => ipcRenderer.invoke('layer4:list')
  },
  manual: {
    list: (query = {}) => ipcRenderer.invoke('manual:list', query),
    link: (selection: unknown[], userId: number | null = null) => ipcRenderer.invoke('manual:link', selection, userId),
    unlink: (linkId: number, userId: number | null = null) => ipcRenderer.invoke('manual:unlink', linkId, userId)
  },
  reports: {
    generate: (from?: string, to?: string) => ipcRenderer.invoke('reports:generate', from, to),
    exportPdf: () => ipcRenderer.invoke('reports:exportPdf'),
    exportExcel: () => ipcRenderer.invoke('reports:exportExcel')
  },
  dashboard: { stats: (dateJalali?: string) => ipcRenderer.invoke('dashboard:stats', dateJalali) },
  electronVersion: process.versions.electron
})
