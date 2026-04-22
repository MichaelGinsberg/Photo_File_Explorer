import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

export default function MoveModal() {
  const { selectedPaths, photos, moveFiles, setShowMoveModal, isCopyMode } = useApp()

  const [destPath, setDestPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const selectedPhotos = photos.filter((p) => selectedPaths.has(p.path))
  const title = isCopyMode ? 'Copy Photos' : 'Move Photos'
  const confirmLabel = isCopyMode ? 'Copy' : 'Move'

  useEffect(() => {
    // Reset state when modal opens
    setDestPath('')
    setNewFolderName('')
    setShowNewFolder(false)
    setError('')
  }, [isCopyMode])

  const handleBrowse = async () => {
    const res = await window.api.browseDestination()
    if (res.success && res.data) {
      setDestPath(res.data)
    }
  }

  const handleConfirm = async () => {
    if (!destPath.trim()) {
      setError('Please select a destination folder.')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      let finalDest = destPath.trim()

      // Create new subfolder if specified
      if (showNewFolder && newFolderName.trim()) {
        const folderName = newFolderName.trim()
        // Reject path separators, Windows-reserved chars (* ? " < > | : \0),
        // and names that are only dots (. or ..)
        if (/[/\\*?"<>|:\x00]/.test(folderName) || /^\.+$/.test(folderName)) {
          setError('Folder name contains invalid characters.')
          setIsProcessing(false)
          return
        }
        const sep = finalDest.includes('/') ? '/' : '\\'
        finalDest = finalDest + sep + folderName
        const mkRes = await window.api.createDirectory(finalDest)
        if (!mkRes.success) {
          setError(`Could not create folder: ${mkRes.error}`)
          setIsProcessing(false)
          return
        }
      }

      await moveFiles(finalDest, isCopyMode)
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setShowMoveModal(false)
  }

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          {/* File count */}
          <div className="modal-info">
            {selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''} will be {isCopyMode ? 'copied' : 'moved'}
          </div>

          {/* Destination */}
          <div className="form-group">
            <label className="form-label">Destination Folder</label>
            <div className="input-row">
              <input
                type="text"
                className="input"
                placeholder="Enter destination path..."
                value={destPath}
                onChange={(e) => setDestPath(e.target.value)}
              />
              <button className="btn btn-secondary" onClick={handleBrowse}>
                Browse...
              </button>
            </div>
          </div>

          {/* New folder option */}
          <div className="form-group">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowNewFolder((v) => !v)}
            >
              {showNewFolder ? '▾' : '▸'} Create New Subfolder
            </button>
            {showNewFolder && (
              <input
                type="text"
                className="input mt-8"
                placeholder="New folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            )}
          </div>

          {/* File preview */}
          <div className="form-group">
            <label className="form-label">Files ({selectedPhotos.length})</label>
            <div className="file-list">
              {selectedPhotos.slice(0, 20).map((p) => (
                <div key={p.path} className="file-list-item">
                  <span className="file-list-ext">{p.extension}</span>
                  <span className="file-list-name">{p.name}</span>
                </div>
              ))}
              {selectedPhotos.length > 20 && (
                <div className="file-list-more">
                  +{selectedPhotos.length - 20} more files...
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isProcessing || !destPath.trim()}
          >
            {isProcessing ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
