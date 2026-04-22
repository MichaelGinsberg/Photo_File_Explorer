import { contextBridge, ipcRenderer } from 'electron'

// ─── Types (duplicated from renderer for preload context) ─────────────────────

interface Photo {
  path: string
  name: string
  size: number
  modified: number
  extension: string
}

interface PhotoData {
  tags: string[]
  rating: number
  description: string
  notes: string
  date: string
  location: string
}

interface ExifData {
  make?: string
  model?: string
  lensModel?: string
  exposureTime?: number
  fNumber?: number
  iso?: number
  focalLength?: number
  dateTimeOriginal?: string
  dateISO?: string
  latitude?: number
  longitude?: number
  width?: number
  height?: number
  colorSpace?: string
}

interface ApiResponse<T = undefined> {
  success: boolean
  error?: string
  data?: T
}

// ─── API exposed to renderer ──────────────────────────────────────────────────

const api = {
  // Window controls
  minimize: (): void => ipcRenderer.send('window:minimize'),
  maximize: (): void => ipcRenderer.send('window:maximize'),
  close: (): void => ipcRenderer.send('window:close'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('window:getPlatform'),

  // Dialog
  openFolder: (): Promise<ApiResponse<string | null>> =>
    ipcRenderer.invoke('dialog:openFolder'),

  // File system
  readDirectory: (dirPath: string): Promise<ApiResponse<Photo[]>> =>
    ipcRenderer.invoke('fs:readDirectory', dirPath),

  getExifData: (filePath: string): Promise<ApiResponse<ExifData>> =>
    ipcRenderer.invoke('fs:getExifData', filePath),

  renameFile: (oldPath: string, newPath: string): Promise<ApiResponse<string>> =>
    ipcRenderer.invoke('fs:renameFile', oldPath, newPath),

  moveFiles: (
    filePaths: string[],
    destDir: string
  ): Promise<ApiResponse<{ path: string; success: boolean; error?: string; newPath?: string }[]>> =>
    ipcRenderer.invoke('fs:moveFiles', filePaths, destDir),

  copyFiles: (
    filePaths: string[],
    destDir: string
  ): Promise<ApiResponse<{ path: string; success: boolean; error?: string; newPath?: string }[]>> =>
    ipcRenderer.invoke('fs:copyFiles', filePaths, destDir),

  createDirectory: (dirPath: string): Promise<ApiResponse<string>> =>
    ipcRenderer.invoke('fs:createDirectory', dirPath),

  browseDestination: (): Promise<ApiResponse<string | null>> =>
    ipcRenderer.invoke('fs:browseDestination'),

  // Store
  getPhotoData: (filePath: string): Promise<ApiResponse<PhotoData>> =>
    ipcRenderer.invoke('store:getPhotoData', filePath),

  setPhotoData: (filePath: string, data: PhotoData): Promise<ApiResponse<undefined>> =>
    ipcRenderer.invoke('store:setPhotoData', filePath, data),

  getAllTags: (): Promise<ApiResponse<{ name: string; count: number }[]>> =>
    ipcRenderer.invoke('store:getAllTags'),

  getAllPhotoData: (): Promise<ApiResponse<Record<string, PhotoData>>> =>
    ipcRenderer.invoke('store:getAllPhotoData'),

  renamePhotoPath: (oldPath: string, newPath: string): Promise<ApiResponse<undefined>> =>
    ipcRenderer.invoke('store:renamePhotoPath', oldPath, newPath),

  // Shell
  openExternal: (url: string): Promise<ApiResponse<undefined>> =>
    ipcRenderer.invoke('shell:openExternal', url)
}

contextBridge.exposeInMainWorld('api', api)
