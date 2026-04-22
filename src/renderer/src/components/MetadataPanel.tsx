import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

function buildLocalFileUrl(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  const encoded = parts.map((p) => encodeURIComponent(p))
  return 'localfile:///' + encoded.join('/')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatExposure(val: number): string {
  if (val >= 1) return `${val}s`
  return `1/${Math.round(1 / val)}s`
}

const TAG_COLORS = ['var(--nord15)', 'var(--nord8)', 'var(--nord14)', 'var(--nord7)', 'var(--nord9)']

export default function MetadataPanel() {
  const {
    activePhoto,
    photoData,
    exifCache,
    updatePhotoData,
    loadExif,
    setShowMoveModal,
    setShowRenameModal,
    setIsCopyMode
  } = useApp()

  const [newTag, setNewTag] = useState('')
  const [exifOpen, setExifOpen] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [notesValue, setNotesValue] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  const photo = activePhoto
  const data = photo ? photoData[photo.path] : null
  const exif = photo ? exifCache[photo.path] : null

  // Sync description/notes only when the active photo changes, not on every data update.
  // Keeping `data` in deps would reset the textareas while the user is typing
  // (e.g. clicking a tag triggers a data update, which would wipe unsaved text).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDescValue(data?.description ?? '')
    setNotesValue(data?.notes ?? '')
  }, [photo?.path])

  // Load EXIF when panel opens or photo changes
  useEffect(() => {
    if (photo && exifOpen && !exif) {
      loadExif(photo.path)
    }
  }, [photo, exifOpen, exif, loadExif])

  const handleExifToggle = useCallback(() => {
    setExifOpen((v) => !v)
    if (photo && !exif) {
      loadExif(photo.path)
    }
  }, [photo, exif, loadExif])

  const handleRatingClick = useCallback(
    (star: number) => {
      if (!photo || !data) return
      const newRating = data.rating === star ? 0 : star
      updatePhotoData(photo.path, { rating: newRating })
    },
    [photo, data, updatePhotoData]
  )

  const handleAddTag = useCallback(() => {
    if (!photo || !data || !newTag.trim()) return
    const tag = newTag.trim().toLowerCase()
    if (!data.tags.includes(tag)) {
      updatePhotoData(photo.path, { tags: [...data.tags, tag] })
    }
    setNewTag('')
    tagInputRef.current?.focus()
  }, [photo, data, newTag, updatePhotoData])

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!photo || !data) return
      updatePhotoData(photo.path, { tags: data.tags.filter((t) => t !== tag) })
    },
    [photo, data, updatePhotoData]
  )

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleDescBlur = () => {
    if (!photo || !data) return
    if (descValue !== data.description) {
      updatePhotoData(photo.path, { description: descValue })
    }
  }

  const handleNotesBlur = () => {
    if (!photo || !data) return
    if (notesValue !== data.notes) {
      updatePhotoData(photo.path, { notes: notesValue })
    }
  }

  const handleRename = () => {
    setShowRenameModal(true)
  }

  const handleMove = () => {
    setIsCopyMode(false)
    setShowMoveModal(true)
  }

  const handleCopy = () => {
    setIsCopyMode(true)
    setShowMoveModal(true)
  }

  const openInMaps = (lat: number, lon: number) => {
    window.api.openExternal(`https://maps.google.com/?q=${lat},${lon}`)
  }

  if (!photo || !data) {
    return (
      <aside className="metadata-panel metadata-panel--empty">
        <div className="metadata-empty">
          <div className="metadata-empty-icon">🖼️</div>
          <p>Select a photo to view details</p>
        </div>
      </aside>
    )
  }

  const imageUrl = buildLocalFileUrl(photo.path)
  const modDate = new Date(photo.modified).toLocaleString()

  return (
    <aside className="metadata-panel">
      {/* Preview image */}
      <div className="metadata-preview">
        <img src={imageUrl} alt={photo.name} className="metadata-preview-img" />
      </div>

      <div className="metadata-content">
        {/* Filename */}
        <div className="metadata-section">
          <h3 className="metadata-filename" title={photo.name}>
            {photo.name}
          </h3>
        </div>

        {/* File info */}
        <div className="metadata-section">
          <div className="metadata-section-title">File Info</div>
          <div className="metadata-row">
            <span className="metadata-label">Size</span>
            <span className="metadata-value">{formatSize(photo.size)}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">Format</span>
            <span className="metadata-value">{photo.extension}</span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">Modified</span>
            <span className="metadata-value">{modDate}</span>
          </div>
        </div>

        {/* Rating */}
        <div className="metadata-section">
          <div className="metadata-section-title">Rating</div>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`star-btn ${star <= (data.rating || 0) ? 'filled' : ''}`}
                onClick={() => handleRatingClick(star)}
                aria-label={`${star} star`}
              >
                {star <= (data.rating || 0) ? '★' : '☆'}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="metadata-section">
          <div className="metadata-section-title">Tags</div>
          <div className="tag-chips">
            {data.tags.map((tag, i) => (
              <span
                key={tag}
                className="tag-chip"
                style={{ borderColor: TAG_COLORS[i % TAG_COLORS.length] }}
              >
                <span className="tag-chip-dot" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }} />
                {tag}
                <button
                  className="tag-chip-remove"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="tag-input-row">
            <input
              ref={tagInputRef}
              type="text"
              className="input tag-input"
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleAddTag}>
              Add
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="metadata-section">
          <div className="metadata-section-title">Description</div>
          <textarea
            className="input textarea"
            placeholder="Add a description..."
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            onBlur={handleDescBlur}
            rows={3}
          />
        </div>

        {/* Notes */}
        <div className="metadata-section">
          <div className="metadata-section-title">Notes</div>
          <textarea
            className="input textarea"
            placeholder="Add notes..."
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            onBlur={handleNotesBlur}
            rows={3}
          />
        </div>

        {/* EXIF Data */}
        <div className="metadata-section">
          <button className="exif-toggle" onClick={handleExifToggle}>
            <span>EXIF Data</span>
            <span className="exif-toggle-icon">{exifOpen ? '▾' : '▸'}</span>
          </button>
          {exifOpen && (
            <div className="exif-content">
              {!exif ? (
                <div className="exif-loading">Loading EXIF data...</div>
              ) : (
                <>
                  {/* Camera */}
                  {(exif.make || exif.model || exif.lensModel) && (
                    <div className="exif-group">
                      <div className="exif-group-title">Camera</div>
                      {exif.make && (
                        <div className="metadata-row">
                          <span className="metadata-label">Make</span>
                          <span className="metadata-value">{exif.make}</span>
                        </div>
                      )}
                      {exif.model && (
                        <div className="metadata-row">
                          <span className="metadata-label">Model</span>
                          <span className="metadata-value">{exif.model}</span>
                        </div>
                      )}
                      {exif.lensModel && (
                        <div className="metadata-row">
                          <span className="metadata-label">Lens</span>
                          <span className="metadata-value">{exif.lensModel}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Settings */}
                  {(exif.exposureTime || exif.fNumber || exif.iso || exif.focalLength) && (
                    <div className="exif-group">
                      <div className="exif-group-title">Settings</div>
                      {exif.exposureTime !== undefined && (
                        <div className="metadata-row">
                          <span className="metadata-label">Exposure</span>
                          <span className="metadata-value">{formatExposure(exif.exposureTime)}</span>
                        </div>
                      )}
                      {exif.fNumber !== undefined && (
                        <div className="metadata-row">
                          <span className="metadata-label">Aperture</span>
                          <span className="metadata-value">f/{exif.fNumber}</span>
                        </div>
                      )}
                      {exif.iso !== undefined && (
                        <div className="metadata-row">
                          <span className="metadata-label">ISO</span>
                          <span className="metadata-value">{exif.iso}</span>
                        </div>
                      )}
                      {exif.focalLength !== undefined && (
                        <div className="metadata-row">
                          <span className="metadata-label">Focal Length</span>
                          <span className="metadata-value">{exif.focalLength}mm</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  {exif.dateTimeOriginal && (
                    <div className="exif-group">
                      <div className="exif-group-title">Date</div>
                      <div className="metadata-row">
                        <span className="metadata-label">Taken</span>
                        <span className="metadata-value">{exif.dateTimeOriginal}</span>
                      </div>
                    </div>
                  )}

                  {/* GPS */}
                  {exif.latitude !== undefined && exif.longitude !== undefined && (
                    <div className="exif-group">
                      <div className="exif-group-title">Location</div>
                      <div className="metadata-row">
                        <span className="metadata-label">GPS</span>
                        <span className="metadata-value">
                          {exif.latitude.toFixed(6)}, {exif.longitude.toFixed(6)}
                        </span>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm maps-btn"
                        onClick={() => openInMaps(exif.latitude!, exif.longitude!)}
                      >
                        📍 Open in Maps
                      </button>
                    </div>
                  )}

                  {/* Image dimensions */}
                  {(exif.width || exif.height) && (
                    <div className="exif-group">
                      <div className="exif-group-title">Image</div>
                      {exif.width && exif.height && (
                        <div className="metadata-row">
                          <span className="metadata-label">Dimensions</span>
                          <span className="metadata-value">{exif.width} × {exif.height}</span>
                        </div>
                      )}
                      {exif.colorSpace && (
                        <div className="metadata-row">
                          <span className="metadata-label">Color Space</span>
                          <span className="metadata-value">{exif.colorSpace}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No EXIF */}
                  {!exif.make && !exif.model && !exif.exposureTime && !exif.dateTimeOriginal &&
                    !exif.latitude && !exif.width && (
                      <div className="exif-none">No EXIF data available</div>
                    )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="metadata-section metadata-actions">
          <div className="metadata-section-title">Actions</div>
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={handleRename}>
              ✎ Rename
            </button>
            <button className="btn btn-secondary" onClick={handleMove}>
              → Move
            </button>
            <button className="btn btn-secondary" onClick={handleCopy}>
              ⎘ Copy
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
