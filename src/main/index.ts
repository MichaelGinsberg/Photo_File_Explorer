import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  shell
} from 'electron'
import { pathToFileURL } from 'url'
import path from 'path'
import fs from 'fs'
import Store from 'electron-store'

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

interface StoreSchema {
  photos: Record<string, PhotoData>
  allTags: Record<string, number>
}

// ─── electron-store ───────────────────────────────────────────────────────────

const store = new Store<StoreSchema>({
  defaults: {
    photos: {},
    allTags: {}
  }
})

// ─── Custom protocol (MUST be before app.whenReady) ──────────────────────────

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'localfile',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: !isWindows,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 14 } : undefined,
    backgroundColor: '#2E3440',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // dist-electron/main/ → ../../dist/renderer/index.html
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Register localfile:// protocol handler
  protocol.handle('localfile', async (request) => {
    try {
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/').filter(Boolean)
      const decodedParts = pathParts.map((p) => decodeURIComponent(p))

      // Block traversal sequences and null bytes before constructing the path
      if (decodedParts.some((p) => p === '..' || p === '.' || p.includes('\0'))) {
        return new Response('Forbidden', { status: 403 })
      }

      let filePath: string
      if (process.platform === 'win32') {
        filePath = decodedParts.join('\\')
        if (filePath.length >= 2 && filePath[1] !== ':') {
          filePath = filePath[0] + ':' + filePath.slice(1)
        }
      } else {
        filePath = '/' + decodedParts.join('/')
      }

      // Only serve recognised photo extensions
      const ext = path.extname(filePath).toLowerCase()
      if (!PHOTO_EXTENSIONS.has(ext)) {
        return new Response('Forbidden', { status: 403 })
      }

      const fileUrl = pathToFileURL(filePath).toString()
      return net.fetch(fileUrl)
    } catch (err) {
      console.error('Protocol handler error:', err)
      return new Response('File not found', { status: 404 })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Window controls ─────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())

ipcMain.handle('window:getPlatform', () => process.platform)

// ─── IPC: Dialog ──────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFolder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    return { success: true, data: result.filePaths[0] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: File system ─────────────────────────────────────────────────────────

const PHOTO_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.heic'
])

ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath)
    const photos: Photo[] = []

    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase()
      if (!PHOTO_EXTENSIONS.has(ext)) continue

      const fullPath = path.join(dirPath, entry)
      try {
        const stat = await fs.promises.lstat(fullPath)
        if (!stat.isFile()) continue  // lstat: symlinks return isSymbolicLink(), not isFile()
        photos.push({
          path: fullPath,
          name: entry,
          size: stat.size,
          modified: stat.mtimeMs,
          extension: ext.slice(1).toUpperCase()
        })
      } catch {
        // skip files we can't stat
      }
    }

    photos.sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, data: photos }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:getExifData', async (_event, filePath: string) => {
  try {
    // Dynamic ESM import of exifr
    const exifr = await import('exifr')
    const raw = await Promise.race([
      exifr.default.parse(filePath, {
        tiff: true, exif: true, gps: true,
        icc: false, iptc: false, jfif: false, ihdr: true
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('EXIF parsing timed out')), 8000)
      )
    ])

    if (!raw) return { success: true, data: {} }

    const exifData = {
      make: raw.Make,
      model: raw.Model,
      lensModel: raw.LensModel,
      exposureTime: raw.ExposureTime,
      fNumber: raw.FNumber,
      iso: raw.ISO,
      focalLength: raw.FocalLength,
      dateTimeOriginal: raw.DateTimeOriginal
        ? new Date(raw.DateTimeOriginal).toLocaleString()
        : undefined,
      latitude: raw.latitude,
      longitude: raw.longitude,
      width: raw.ImageWidth || raw.ExifImageWidth || raw.PixelXDimension,
      height: raw.ImageHeight || raw.ExifImageHeight || raw.PixelYDimension,
      colorSpace: raw.ColorSpace === 1 ? 'sRGB' : raw.ColorSpace?.toString()
    }

    return { success: true, data: exifData }
  } catch (err: any) {
    return { success: false, error: err.message, data: {} }
  }
})

ipcMain.handle('fs:renameFile', async (_event, oldPath: string, newPath: string) => {
  try {
    if (oldPath !== newPath && await destExists(newPath)) {
      return { success: false, error: `A file named "${path.basename(newPath)}" already exists in this folder` }
    }
    await fs.promises.rename(oldPath, newPath)
    return { success: true, data: newPath }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

async function destExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p)
    return true
  } catch {
    return false
  }
}

ipcMain.handle('fs:moveFiles', async (_event, filePaths: string[], destDir: string) => {
  const results: { path: string; success: boolean; error?: string; newPath?: string }[] = []
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath)
    const destPath = path.join(destDir, fileName)
    if (await destExists(destPath)) {
      results.push({ path: filePath, success: false, error: `File already exists at destination: ${fileName}` })
      continue
    }
    try {
      await fs.promises.rename(filePath, destPath)
      results.push({ path: filePath, success: true, newPath: destPath })
    } catch {
      // Cross-device move: copy then delete
      let fileCopied = false
      try {
        await fs.promises.copyFile(filePath, destPath)
        fileCopied = true
        await fs.promises.unlink(filePath)
        results.push({ path: filePath, success: true, newPath: destPath })
      } catch (err2: any) {
        if (!fileCopied) {
          // copyFile failed — clean up any partial dest write
          try { await fs.promises.unlink(destPath) } catch { /* best effort */ }
          results.push({ path: filePath, success: false, error: err2.message })
        } else {
          // copyFile succeeded but unlink failed — dest has the file; don't delete it
          results.push({ path: filePath, success: false,
            error: `File copied but source could not be deleted: ${err2.message}` })
        }
      }
    }
  }
  return { success: true, data: results }
})

ipcMain.handle('fs:copyFiles', async (_event, filePaths: string[], destDir: string) => {
  const results: { path: string; success: boolean; error?: string; newPath?: string }[] = []
  for (const filePath of filePaths) {
    const fileName = path.basename(filePath)
    const destPath = path.join(destDir, fileName)
    if (await destExists(destPath)) {
      results.push({ path: filePath, success: false, error: `File already exists at destination: ${fileName}` })
      continue
    }
    try {
      await fs.promises.copyFile(filePath, destPath)
      results.push({ path: filePath, success: true, newPath: destPath })
    } catch (err: any) {
      results.push({ path: filePath, success: false, error: err.message })
    }
  }
  return { success: true, data: results }
})

ipcMain.handle('fs:createDirectory', async (_event, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { success: true, data: dirPath }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:browseDestination', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    return { success: true, data: result.filePaths[0] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: Store ───────────────────────────────────────────────────────────────

ipcMain.handle('store:getPhotoData', (_event, filePath: string) => {
  try {
    const photos = store.get('photos') as Record<string, PhotoData>
    const data = photos[filePath] || { tags: [], rating: 0, description: '', notes: '' }
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('store:setPhotoData', (_event, filePath: string, data: PhotoData) => {
  try {
    const photos = store.get('photos') as Record<string, PhotoData>
    const oldData = photos[filePath] || { tags: [], rating: 0, description: '', notes: '' }
    photos[filePath] = data
    store.set('photos', photos)

    // Update allTags counts
    const allTags = store.get('allTags') as Record<string, number>

    // Remove old tags
    for (const tag of (oldData.tags || [])) {
      if (allTags[tag]) {
        allTags[tag]--
        if (allTags[tag] <= 0) delete allTags[tag]
      }
    }

    // Add new tags
    for (const tag of (data.tags || [])) {
      allTags[tag] = (allTags[tag] || 0) + 1
    }

    store.set('allTags', allTags)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('store:getAllTags', () => {
  try {
    const allTags = store.get('allTags') as Record<string, number>
    const tags = Object.entries(allTags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, data: tags }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, error: 'Only http/https URLs are allowed' }
    }
    await shell.openExternal(url)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('store:getAllPhotoData', () => {
  try {
    const photos = store.get('photos') as Record<string, PhotoData>
    return { success: true, data: photos }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})
