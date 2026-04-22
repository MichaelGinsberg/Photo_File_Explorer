import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { RAW_EXTS } from '../rawFormats'

function buildLocalFileUrl(filePath: string): string {
  return `localfile://localhost/?p=${encodeURIComponent(filePath)}`
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

import { DEFAULT_TAG_COLOR, hexToRgba } from '../tagColors'

export default function MetadataPanel() {
  const {
    activePhoto,
    photoData,
    exifCache,
    allTags,
    updatePhotoData,
    loadExif,
    setShowMoveModal,
    setShowRenameModal,
    setIsCopyMode,
    tagColorMap
  } = useApp()

  const [newTag, setNewTag] = useState('')
  const [highlightedSugg, setHighlightedSugg] = useState(-1)
  const [exifOpen, setExifOpen] = useState(false)
  const [descValue, setDescValue] = useState('')
  const [notesValue, setNotesValue] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [locationValue, setLocationValue] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  const photo = activePhoto
  const data = photo ? photoData[photo.path] : null
  const exif = photo ? exifCache[photo.path] : null

  // Sync local state when active photo changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDescValue(data?.description ?? '')
    setNotesValue(data?.notes ?? '')
    setDateValue(data?.date ?? '')
    setLocationValue(data?.location ?? '')
    setNewTag('')
    setHighlightedSugg(-1)
  }, [photo?.path])

  // Auto-load EXIF for date pre-fill and EXIF section
  useEffect(() => {
    if (photo) loadExif(photo.path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.path])

  // Load EXIF when section is opened and not yet cached
  useEffect(() => {
    if (photo && exifOpen && !exif) {
      loadExif(photo.path)
    }
  }, [photo, exifOpen, exif, loadExif])

  // ── Tag autocomplete ────────────────────────────────────────────────────────

  const suggestions = useMemo(() => {
    if (!newTag.trim() || !data) return []
    const lower = newTag.trim().toLowerCase()
    return allTags
      .filter(t => t.name.includes(lower) && !data.tags.includes(t.name))
      .slice(0, 8)
  }, [newTag, allTags, data])

  // Top 5 most-used tags not already on this photo
  const topTags = useMemo(() => {
    if (!data) return []
    return [...allTags]
      .sort((a, b) => b.count - a.count)
      .filter(t => !data.tags.includes(t.name))
      .slice(0, 5)
  }, [allTags, data])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleExifToggle = useCallback(() => {
    setExifOpen((v) => !v)
    if (photo && !exif) loadExif(photo.path)
  }, [photo, exif, loadExif])

  const handleRatingClick = useCallback(
    (star: number) => {
      if (!photo || !data) return
      updatePhotoData(photo.path, { rating: data.rating === star ? 0 : star })
    },
    [photo, data, updatePhotoData]
  )

  const handleAddTag = useCallback(() => {
    if (!photo || !data || !newTag.trim()) return
    // Normalise: lowercase, collapse whitespace, strip control characters
    const tag = newTag.trim().toLowerCase().replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ')
    if (!tag) return
    if (!data.tags.includes(tag)) {
      updatePhotoData(photo.path, { tags: [...data.tags, tag] })
    }
    setNewTag('')
    setHighlightedSugg(-1)
    tagInputRef.current?.focus()
  }, [photo, data, newTag, updatePhotoData])

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!photo || !data) return
      updatePhotoData(photo.path, { tags: data.tags.filter((t) => t !== tag) })
    },
    [photo, data, updatePhotoData]
  )

  const handleTopTagClick = useCallback(
    (tagName: string) => {
      if (!photo || !data) return
      if (!data.tags.includes(tagName)) {
        updatePhotoData(photo.path, { tags: [...data.tags, tagName] })
      }
    },
    [photo, data, updatePhotoData]
  )

  const handleSuggestionMouseDown = useCallback(
    (e: React.MouseEvent, tagName: string) => {
      e.preventDefault() // prevent input blur before click registers
      if (!photo || !data) return
      if (!data.tags.includes(tagName)) {
        updatePhotoData(photo.path, { tags: [...data.tags, tagName] })
      }
      setNewTag('')
      setHighlightedSugg(-1)
      tagInputRef.current?.focus()
    },
    [photo, data, updatePhotoData]
  )

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedSugg(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedSugg(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Escape') {
      setHighlightedSugg(-1)
      setNewTag('')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedSugg >= 0 && suggestions[highlightedSugg]) {
        const tag = suggestions[highlightedSugg].name
        if (photo && data && !data.tags.includes(tag)) {
          updatePhotoData(photo.path, { tags: [...data.tags, tag] })
        }
        setNewTag('')
        setHighlightedSugg(-1)
      } else {
        handleAddTag()
      }
    }
  }

  const handleDescBlur = () => {
    if (!photo || !data) return
    if (descValue !== data.description) updatePhotoData(photo.path, { description: descValue })
  }

  const handleNotesBlur = () => {
    if (!photo || !data) return
    if (notesValue !== data.notes) updatePhotoData(photo.path, { notes: notesValue })
  }

  const handleDateBlur = () => {
    if (!photo || !data) return
    if (dateValue !== data.date) updatePhotoData(photo.path, { date: dateValue })
  }

  const handleLocationBlur = () => {
    if (!photo || !data) return
    if (locationValue !== data.location) updatePhotoData(photo.path, { location: locationValue })
  }

  const handleUseExifDate = useCallback(() => {
    if (!photo || !data || !exif?.dateISO) return
    setDateValue(exif.dateISO)
    updatePhotoData(photo.path, { date: exif.dateISO })
  }, [photo, data, exif, updatePhotoData])

  const handleRename = () => setShowRenameModal(true)
  const handleMove = () => { setIsCopyMode(false); setShowMoveModal(true) }
  const handleCopy = () => { setIsCopyMode(true); setShowMoveModal(true) }

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

  const isRaw = RAW_EXTS.has(photo.extension)
  const imageUrl = isRaw ? undefined : buildLocalFileUrl(photo.path)
  const modDate = new Date(photo.modified).toLocaleString()

  return (
    <aside className="metadata-panel">
      {/* Preview image */}
      <div className="metadata-preview">
        {isRaw ? (
          <div className="raw-preview-placeholder">
            <svg width="36" height="36" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.5 8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
              <path d="M2 4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 009.172 2H6.828a2 2 0 00-1.414.586l-.828.828A2 2 0 013.172 4H2zm.5 2a.5.5 0 110-1 .5.5 0 010 1zm9 2.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z"/>
            </svg>
            <span className="raw-preview-ext">{photo.extension}</span>
          </div>
        ) : (
          <img src={imageUrl} alt={photo.name} className="metadata-preview-img" />
        )}
      </div>

      <div className="metadata-content">
        {/* Filename */}
        <div className="metadata-section">
          <h3 className="metadata-filename" title={photo.name}>{photo.name}</h3>
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

          {/* Top used tags (quick-add) */}
          {topTags.length > 0 && (
            <div className="top-tags">
              {topTags.map(tag => {
                const color = tagColorMap[tag.name] ?? DEFAULT_TAG_COLOR
                return (
                  <button
                    key={tag.name}
                    className="top-tag-chip"
                    style={{ borderColor: color, color }}
                    onClick={() => handleTopTagClick(tag.name)}
                    title={`Add "${tag.name}" · used ${tag.count}×`}
                  >
                    + {tag.name}
                  </button>
                )
              })}
            </div>
          )}

          {/* Applied tags */}
          <div className="tag-chips">
            {data.tags.map((tag) => {
              const color = tagColorMap[tag] ?? DEFAULT_TAG_COLOR
              return (
                <span
                  key={tag}
                  className="tag-chip"
                  style={{ borderColor: color, background: hexToRgba(color, 0.1) }}
                >
                  <span className="tag-chip-dot" style={{ background: color }} />
                  {tag}
                  <button
                    className="tag-chip-remove"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>

          {/* Input with autocomplete */}
          <div className="tag-input-row">
            <div className="tag-input-wrapper">
              <input
                ref={tagInputRef}
                type="text"
                className="input tag-input"
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => { setNewTag(e.target.value); setHighlightedSugg(-1) }}
                onKeyDown={handleTagKeyDown}
              />
              {suggestions.length > 0 && (
                <div className="tag-suggestions">
                  {suggestions.map((s, i) => (
                    <div
                      key={s.name}
                      className={`tag-suggestion-item ${i === highlightedSugg ? 'highlighted' : ''}`}
                      onMouseDown={(e) => handleSuggestionMouseDown(e, s.name)}
                    >
                      <span>{s.name}</span>
                      <span className="tag-suggestion-count">{s.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleAddTag}>Add</button>
          </div>
        </div>

        {/* Date Taken */}
        <div className="metadata-section">
          <div className="metadata-section-title">Date Taken</div>
          <div className="date-field-row">
            <input
              type="date"
              className="input date-input"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              onBlur={handleDateBlur}
            />
            {exif?.dateISO && exif.dateISO !== dateValue && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleUseExifDate}
                title={`Use EXIF date: ${exif.dateTimeOriginal}`}
              >
                ↑ EXIF
              </button>
            )}
          </div>
          {exif?.dateTimeOriginal && (
            <div className="metadata-row date-exif-row">
              <span className="metadata-label">EXIF</span>
              <span className="metadata-value date-exif-value">{exif.dateTimeOriginal}</span>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="metadata-section">
          <div className="metadata-section-title">Location</div>
          <input
            type="text"
            className="input"
            placeholder="e.g. Paris, France"
            value={locationValue}
            onChange={(e) => setLocationValue(e.target.value)}
            onBlur={handleLocationBlur}
          />
          {exif?.latitude !== undefined && exif?.longitude !== undefined && (
            <div className="metadata-row" style={{ marginTop: '6px' }}>
              <span className="metadata-label">GPS</span>
              <button
                className="btn btn-ghost btn-sm maps-btn"
                style={{ padding: '0', font: 'inherit', fontSize: '11px', color: 'var(--nord8)' }}
                onClick={() => openInMaps(exif!.latitude!, exif!.longitude!)}
              >
                {exif.latitude.toFixed(5)}, {exif.longitude.toFixed(5)} ↗
              </button>
            </div>
          )}
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
            <button className="btn btn-secondary" onClick={handleRename}>✎ Rename</button>
            <button className="btn btn-secondary" onClick={handleMove}>→ Move</button>
            <button className="btn btn-secondary" onClick={handleCopy}>⎘ Copy</button>
          </div>
        </div>
      </div>
    </aside>
  )
}
