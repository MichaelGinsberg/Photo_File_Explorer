import React, { useState, useRef, useCallback } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import PhotoGrid from './components/PhotoGrid'
import MetadataPanel from './components/MetadataPanel'
import MoveModal from './components/MoveModal'
import RenameModal from './components/RenameModal'
import TagGroupModal from './components/TagGroupModal'

interface ElectronFile extends File {
  path: string
}

const PHOTO_EXTS = new Set([
  // Standard web formats
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.heic',
  // RAW formats
  '.raf', '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
  '.orf', '.rw2', '.rwl', '.dng', '.pef', '.x3f', '.3fr', '.raw',
  '.mrw', '.kdc', '.dcr', '.mef', '.iiq', '.erf',
])

function getExt(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  return dot === -1 ? '' : filePath.slice(dot).toLowerCase()
}

function StatusBar() {
  const { filteredPhotos, selectedPaths, photos, filterTags } = useApp()
  const filtered = filterTags.length > 0

  return (
    <div className="status-bar">
      <span className="status-bar-item">
        {filtered
          ? `${filteredPhotos.length} of ${photos.length} photos`
          : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
      </span>
      {selectedPaths.size > 0 && (
        <span className="status-bar-item status-bar-item--accent">
          {selectedPaths.size} selected
        </span>
      )}
      {filtered && (
        <span className="status-bar-item">
          Filtered by: {filterTags.join(', ')}
        </span>
      )}
    </div>
  )
}

function AppInner() {
  const { showMoveModal, showRenameModal, showTagGroupModal, activePhoto, currentFolder, refreshFolder } = useApp()

  const [isDragOver, setIsDragOver] = useState(false)
  const [dropStatus, setDropStatus] = useState<string | null>(null)
  const dragCounter = useRef(0)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setDropStatus(msg)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setDropStatus(null), 2500)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = currentFolder ? 'copy' : 'none'
  }, [currentFolder])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (currentFolder) setIsDragOver(true)
  }, [currentFolder])

  const handleDragLeave = useCallback(() => {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    if (!currentFolder) return

    const photoPaths = Array.from(e.dataTransfer.files)
      .map(f => (f as ElectronFile).path)
      .filter(p => p && PHOTO_EXTS.has(getExt(p)))

    if (photoPaths.length === 0) {
      showToast('No supported photo files found')
      return
    }

    const res = await window.api.copyFiles(photoPaths, currentFolder)
    if (!res.success) { showToast('Copy failed'); return }

    const ok = res.data?.filter(r => r.success).length ?? 0
    const fail = res.data?.filter(r => !r.success).length ?? 0

    await refreshFolder()

    if (fail > 0 && ok > 0) showToast(`Copied ${ok}, ${fail} already exist`)
    else if (fail > 0) showToast(`${fail} file${fail !== 1 ? 's' : ''} already exist in folder`)
    else showToast(`Copied ${ok} photo${ok !== 1 ? 's' : ''}`)
  }, [currentFolder, refreshFolder, showToast])

  const folderBaseName = currentFolder?.split(/[\\/]/).filter(Boolean).pop() ?? ''

  return (
    <div className="app-container">
      <TitleBar />
      <Toolbar />

      <div className="main-layout">
        <Sidebar />

        <div
          className="content-area"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && currentFolder && (
            <div className="drop-overlay">
              <div className="drop-overlay-inner">
                <svg className="drop-overlay-icon" width="40" height="40" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/>
                </svg>
                <div className="drop-overlay-text">Drop photos to copy</div>
                <div className="drop-overlay-sub">into {folderBaseName}</div>
              </div>
            </div>
          )}

          {dropStatus && (
            <div className="drop-toast">{dropStatus}</div>
          )}

          <div className="content-scroll">
            <PhotoGrid />
          </div>
          <StatusBar />
        </div>

        {activePhoto && <MetadataPanel />}
      </div>

      {showMoveModal && <MoveModal />}
      {showRenameModal && <RenameModal />}
      {showTagGroupModal && <TagGroupModal />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
