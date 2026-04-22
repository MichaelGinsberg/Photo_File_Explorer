import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

const INVALID_NAME = /[/\\*?"<>|:\x00]/

export default function MoveModal() {
  const { selectedPaths, photos, currentFolder, moveFiles, setShowMoveModal, isCopyMode } = useApp()

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [destPath, setDestPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const selectedPhotos = photos.filter((p) => selectedPaths.has(p.path))
  const title = isCopyMode ? 'Copy Photos' : 'Move Photos'
  const actionLabel = isCopyMode ? 'Copy' : 'Move'

  const sep = currentFolder?.includes('/') ? '/' : '\\'
  const newFolderPreview = currentFolder && newFolderName.trim()
    ? currentFolder + sep + newFolderName.trim()
    : null

  const handleBrowse = async () => {
    const res = await window.api.browseDestination()
    if (res.success && res.data) setDestPath(res.data)
  }

  const handleConfirm = async () => {
    setError('')
    setIsProcessing(true)
    try {
      if (mode === 'existing') {
        if (!destPath.trim()) { setError('Please select a destination folder.'); return }
        await moveFiles(destPath.trim(), isCopyMode)
      } else {
        const name = newFolderName.trim()
        if (!name) { setError('Please enter a folder name.'); return }
        if (INVALID_NAME.test(name) || /^\.+$/.test(name)) {
          setError('Folder name contains invalid characters.')
          return
        }
        if (!currentFolder) { setError('No folder is currently open.'); return }
        const finalDest = currentFolder + sep + name
        const mkRes = await window.api.createDirectory(finalDest)
        if (!mkRes.success) { setError(`Could not create folder: ${mkRes.error}`); return }
        await moveFiles(finalDest, isCopyMode)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.')
    } finally {
      setIsProcessing(false)
    }
  }

  const canConfirm = mode === 'existing' ? !!destPath.trim() : !!newFolderName.trim()

  return (
    <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={() => setShowMoveModal(false)}>×</button>
        </div>

        <div className="modal-body">
          <div className="modal-info">
            {selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''} will be {isCopyMode ? 'copied' : 'moved'}
          </div>

          {/* Mode toggle */}
          <div className="move-mode-toggle">
            <button
              className={`move-mode-btn ${mode === 'existing' ? 'active' : ''}`}
              onClick={() => { setMode('existing'); setError('') }}
            >
              Existing Folder
            </button>
            <button
              className={`move-mode-btn ${mode === 'new' ? 'active' : ''}`}
              onClick={() => { setMode('new'); setError('') }}
            >
              New Folder
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="form-group">
              <label className="form-label">Destination Folder</label>
              <div className="input-row">
                <input
                  type="text"
                  className="input"
                  placeholder="Enter or browse to a destination path…"
                  value={destPath}
                  onChange={(e) => setDestPath(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={handleBrowse}>
                  Browse…
                </button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">New Folder Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Summer 2024"
                value={newFolderName}
                autoFocus
                onChange={(e) => { setNewFolderName(e.target.value); setError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) handleConfirm() }}
              />
              {newFolderPreview && (
                <div className="move-folder-preview">
                  Will be created at: <span className="move-folder-preview-path">{newFolderPreview}</span>
                </div>
              )}
            </div>
          )}

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
                <div className="file-list-more">+{selectedPhotos.length - 20} more…</div>
              )}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowMoveModal(false)} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isProcessing || !canConfirm}
          >
            {isProcessing ? 'Processing…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
