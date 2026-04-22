import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  shell
} from 'electron'
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
  date: string
  location: string
}

interface StoreSchema {
  photos: Record<string, PhotoData>
  allTags: Record<string, number>
  lastFolder: string | null
}

// ─── electron-store ───────────────────────────────────────────────────────────

const store = new Store<StoreSchema>({
  defaults: {
    photos: {},
    allTags: {},
    lastFolder: null
  }
})

// ─── exifr module cache ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exifrLib: any = null

// ─── MIME types for photo extensions ─────────────────────────────────────────

const PHOTO_MIME: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
  '.bmp':  'image/bmp',
  '.heic': 'image/heic',
}

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

  // Ctrl+Shift+I / F12 → toggle DevTools
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (
      input.type === 'keyDown' &&
      (input.key === 'F12' ||
        (input.control && input.shift && input.key === 'I'))
    ) {
      mainWindow?.webContents.toggleDevTools()
    }
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
  // Register localfile:// protocol handler.
  // URL format: localfile://localhost/?p=<encodeURIComponent(absolutePath)>
  // Using a query param avoids path-segment parsing edge cases with Windows
  // drive letters under Chromium's URL normaliser. The explicit 'localhost'
  // host is required: Electron docs state that standard-scheme URLs with no
  // host are treated as file-like URLs, bypassing the corsEnabled / secure
  // privileges and causing image loads to fail silently.
  protocol.handle('localfile', async (request) => {
    try {
      const url = new URL(request.url)
      // searchParams.get() already percent-decodes the value
      const filePath = url.searchParams.get('p') ?? ''
      if (!filePath) return new Response('Bad request', { status: 400 })

      // Normalise: path.normalize resolves all '..' segments, so checking
      // for '..' in the result would only reject legitimate dir names like
      // "my..folder" — not traversal. The real guard is path.isAbsolute()
      // (ensures no relative path slipped through) plus the extension whitelist.
      const normalised = path.normalize(filePath)
      if (!path.isAbsolute(normalised) || normalised.includes('\0')) {
        return new Response('Forbidden', { status: 403 })
      }

      const ext = path.extname(normalised).toLowerCase()
      if (!PHOTO_EXTENSIONS.has(ext)) {
        return new Response('Forbidden', { status: 403 })
      }

      const data = await fs.promises.readFile(normalised)
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': PHOTO_MIME[ext] ?? 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (err) {
      console.error('Protocol handler error:', err)
      return new Response('File not found', { status: 404 })
    }
  })

  // Pre-warm exifr in the background so the first EXIF request
  // doesn't pay the dynamic-import cost (~150–300 ms on cold cache).
  import('exifr').then(m => { exifrLib = m }).catch(() => {})

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
    const folder = result.filePaths[0]
    store.set('lastFolder', folder)
    return { success: true, data: folder }
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

    // Filter by extension first (no I/O), then stat all candidates in parallel.
    // Sequential lstat in a loop is the dominant cost for large folders; Promise.all
    // issues every lstat concurrently and lets the OS schedule them optimally.
    const candidates = entries.filter(e =>
      PHOTO_EXTENSIONS.has(path.extname(e).toLowerCase())
    )

    const settled = await Promise.all(
      candidates.map(async (entry): Promise<Photo | null> => {
        const ext = path.extname(entry).toLowerCase()
        const fullPath = path.join(dirPath, entry)
        try {
          const stat = await fs.promises.lstat(fullPath)
          if (!stat.isFile()) return null // symlinks: isSymbolicLink(), not isFile()
          return { path: fullPath, name: entry, size: stat.size, modified: stat.mtimeMs, extension: ext.slice(1).toUpperCase() }
        } catch {
          return null
        }
      })
    )

    const photos = settled.filter((p): p is Photo => p !== null)
    photos.sort((a, b) => a.name.localeCompare(b.name))
    return { success: true, data: photos }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:getExifData', async (_event, filePath: string) => {
  try {
    // Use pre-warmed module if available, otherwise import and cache now
    const exifr = exifrLib ?? (exifrLib = await import('exifr'))
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
      dateISO: raw.DateTimeOriginal
        ? new Date(raw.DateTimeOriginal).toISOString().slice(0, 10)
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
    const data = photos[filePath] || { tags: [], rating: 0, description: '', notes: '', date: '', location: '' }
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

ipcMain.handle('store:getLastFolder', () => {
  try {
    return { success: true, data: store.get('lastFolder') as string | null }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Migrate stored photo data when a file is renamed or moved.
// Moves the data record from oldPath to newPath without touching allTags
// counts (the tags themselves don't change, only the path key does).
ipcMain.handle('store:renamePhotoPath', (_event, oldPath: string, newPath: string) => {
  try {
    const photos = store.get('photos') as Record<string, PhotoData>
    if (photos[oldPath]) {
      photos[newPath] = photos[oldPath]
      delete photos[oldPath]
      store.set('photos', photos)
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})
