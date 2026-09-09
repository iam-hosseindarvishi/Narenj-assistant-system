import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  electronVersion: process.versions.electron,
  manual: {
    list: (query = {}) => ipcRenderer.invoke('manual:list', query),
    link: (selection: unknown[], userId: number | null = null) => ipcRenderer.invoke('manual:link', selection, userId),
    unlink: (linkId: number, userId: number | null = null) => ipcRenderer.invoke('manual:unlink', linkId, userId)
  }
})
