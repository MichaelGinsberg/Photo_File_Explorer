import React, { useRef, useState, useEffect, useCallback, memo } from 'react'
import type { Photo } from '../types'
import { RAW_EXTS } from '../rawFormats'

interface PhotoItemProps {
  photo: Photo
  isSelected: boolean
  isActive: boolean
  viewMode: 'grid' | 'list'
  onSelect: (photo: Photo, event: React.MouseEvent) => void
  onActivate: (photo: Photo) => void
}

function RawThumb({ extension }: { extension: string }) {
  return (
    <div className="raw-placeholder">
      <svg className="raw-placeholder-icon" width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
        <path d="M10.5 8.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
        <path d="M2 4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 009.172 2H6.828a2 2 0 00-1.414.586l-.828.828A2 2 0 013.172 4H2zm.5 2a.5.5 0 110-1 .5.5 0 010 1zm9 2.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0z"/>
      </svg>
      <span className="raw-placeholder-ext">{extension}</span>
    </div>
  )
}

function buildLocalFileUrl(filePath: string): string {
  return `localfile://localhost/?p=${encodeURIComponent(filePath)}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function PhotoItem({
  photo,
  isSelected,
  isActive,
  viewMode,
  onSelect,
  onActivate
}: PhotoItemProps) {
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(photo, e)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        onActivate(photo)
      }
    },
    [photo, onSelect, onActivate]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onActivate(photo)
    },
    [photo, onActivate]
  )

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(photo, { ...e, ctrlKey: true } as React.MouseEvent)
    },
    [photo, onSelect]
  )

  const isRaw = RAW_EXTS.has(photo.extension)
  const imageUrl = (visible && !isRaw) ? buildLocalFileUrl(photo.path) : undefined

  if (viewMode === 'list') {
    return (
      <div
        ref={containerRef}
        className={`photo-list-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="photo-list-thumb">
          {isRaw ? (
            <RawThumb extension={photo.extension} />
          ) : visible && !error ? (
            <img
              ref={imgRef}
              src={imageUrl}
              alt={photo.name}
              className={`photo-list-img ${loaded ? 'loaded' : ''}`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          ) : (
            <div className="photo-list-placeholder">
              {error ? '⚠' : ''}
            </div>
          )}
        </div>
        <div className="photo-list-info">
          <span className="photo-list-name">{photo.name}</span>
          <span className="photo-list-meta">
            {formatSize(photo.size)} · {photo.extension} · {formatDate(photo.modified)}
          </span>
        </div>
        <div className="photo-list-checkbox" onClick={handleCheckboxClick}>
          <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div
      ref={containerRef}
      className={`photo-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Thumbnail */}
      <div className="photo-thumb">
        {isRaw ? (
          <RawThumb extension={photo.extension} />
        ) : visible && !error ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={photo.name}
            className={`photo-img ${loaded ? 'loaded' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : (
          <div className="photo-placeholder">
            {error ? (
              <span className="photo-error-icon">⚠</span>
            ) : (
              <div className="photo-skeleton" />
            )}
          </div>
        )}

        {/* Checkbox */}
        <div
          className={`photo-checkbox ${isSelected ? 'visible' : ''}`}
          onClick={handleCheckboxClick}
        >
          <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>

        {/* Selection overlay */}
        {isSelected && <div className="photo-selection-overlay" />}
      </div>

      {/* Name label */}
      <div className="photo-label">
        <span className="photo-name" title={photo.name}>
          {photo.name}
        </span>
      </div>
    </div>
  )
}

export default memo(PhotoItem)
