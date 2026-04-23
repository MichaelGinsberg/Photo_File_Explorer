import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import type { RenameEntry } from '../types'

function getExt(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx) : ''
}

function getBase(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(0, idx) : name
}

const RE_NAME = /\{name\}/g
const RE_COUNTER = /\{counter(?::(\d+))?\}/g
const RE_DATE = /\{date(?::([^}]+))?\}/g

function applyBulkPattern(
  pattern: string,
  name: string,
  index: number,
  date: Date
): string {
  let result = pattern

  result = result.replace(RE_NAME, getBase(name))

  result = result.replace(RE_COUNTER, (_match, width) => {
    const w = parseInt(width || '1', 10)
    return String(index + 1).padStart(w, '0')
  })

  result = result.replace(RE_DATE, (_match, fmt) => {
    if (!fmt) return date.toISOString().slice(0, 10)
    let d = fmt
    d = d.replaceAll('YYYY', String(date.getFullYear()))
    d = d.replaceAll('MM', String(date.getMonth() + 1).padStart(2, '0'))
    d = d.replaceAll('DD', String(date.getDate()).padStart(2, '0'))
    d = d.replaceAll('HH', String(date.getHours()).padStart(2, '0'))
    d = d.replaceAll('mm', String(date.getMinutes()).padStart(2, '0'))
    d = d.replaceAll('ss', String(date.getSeconds()).padStart(2, '0'))
    return d
  })

  return result
}

export default function RenameModal() {
  const { selectedPaths, photos, activePhoto, renameFiles, setShowRenameModal } = useApp()

  const selectedPhotos = photos.filter((p) => selectedPaths.has(p.path))
  const isSingle = selectedPhotos.length === 1
  const singlePhoto = isSingle ? selectedPhotos[0] : null

  const [singleName, setSingleName] = useState('')
  const [bulkPattern, setBulkPattern] = useState('{name}')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Initialize for single rename
  useEffect(() => {
    if (singlePhoto) {
      setSingleName(getBase(singlePhoto.name))
    }
  }, [singlePhoto?.path])

  const nowDate = new Date()

  // Compute preview for bulk
  const bulkPreviews = selectedPhotos.slice(0, 3).map((photo, i) => {
    const ext = getExt(photo.name)
    const newBase = applyBulkPattern(bulkPattern, photo.name, i, nowDate)
    return { original: photo.name, newName: newBase + ext }
  })

  const handleConfirm = async () => {
    setError('')

    if (isSingle && singlePhoto) {
      const trimmed = singleName.trim()
      if (!trimmed) {
        setError('Name cannot be empty.')
        return
      }
      const ext = getExt(singlePhoto.name)
      const newName = trimmed + ext
      if (newName === singlePhoto.name) {
        setShowRenameModal(false)
        return
      }
      setIsProcessing(true)
      try {
        await renameFiles([{ path: singlePhoto.path, newName }])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsProcessing(false)
      }
    } else {
      // Bulk rename
      if (!bulkPattern.trim()) {
        setError('Pattern cannot be empty.')
        return
      }
      setIsProcessing(true)
      try {
        const renames: RenameEntry[] = selectedPhotos.map((photo, i) => {
          const ext = getExt(photo.name)
          const newBase = applyBulkPattern(bulkPattern, photo.name, i, nowDate)
          return { path: photo.path, newName: newBase + ext }
        })
        await renameFiles(renames)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleCancel = () => {
    setShowRenameModal(false)
  }

  const ext = singlePhoto ? getExt(singlePhoto.name) : ''

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            Rename{' '}
            {isSingle && singlePhoto
              ? singlePhoto.name
              : `${selectedPhotos.length} files`}
          </h2>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          {isSingle && singlePhoto ? (
            /* Single rename */
            <div className="form-group">
              <label className="form-label">New Name</label>
              <div className="rename-input-row">
                <input
                  type="text"
                  className="input rename-input"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  autoFocus
                />
                <span className="rename-ext">{ext}</span>
              </div>
            </div>
          ) : (
            /* Bulk rename */
            <>
              <div className="form-group">
                <label className="form-label">Pattern</label>
                <input
                  type="text"
                  className="input"
                  value={bulkPattern}
                  onChange={(e) => setBulkPattern(e.target.value)}
                  autoFocus
                />
                <div className="pattern-help">
                  Variables: <code>{'{name}'}</code> <code>{'{counter:3}'}</code>{' '}
                  <code>{'{date:YYYY-MM-DD}'}</code>
                </div>
              </div>

              {/* Preview */}
              <div className="form-group">
                <label className="form-label">Preview (first 3 files)</label>
                <div className="rename-preview">
                  {bulkPreviews.map((p) => (
                    <div key={p.original} className="rename-preview-item">
                      <span className="rename-preview-old">{p.original}</span>
                      <span className="rename-preview-arrow">→</span>
                      <span className="rename-preview-new">{p.newName}</span>
                    </div>
                  ))}
                  {selectedPhotos.length > 3 && (
                    <div className="rename-preview-more">
                      +{selectedPhotos.length - 3} more files
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  )
}
