import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { Photo } from '../types'

interface PhotoItemProps {
  photo: Photo
  isSelected: boolean
  isActive: boolean
  hasAnySelected: boolean
  viewMode: 'grid' | 'list'
  onSelect: (photo: Photo, event: React.MouseEvent) => void
  onActivate: (photo: Photo) => void
}

function buildLocalFileUrl(filePath: string): string {
  // Split on both / and \ separators
  const parts = filePath.split(/[\\/]/)
  const encoded = parts.map((p) => encodeURIComponent(p))
  return 'localfile:///' + encoded.join('/')
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

export default function PhotoItem({
  photo,
  isSelected,
  isActive,
  hasAnySelected,
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

  const imageUrl = visible ? buildLocalFileUrl(photo.path) : undefined

  if (viewMode === 'list') {
    return (
      <div
        ref={containerRef}
        className={`photo-list-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="photo-list-thumb">
          {visible && !error ? (
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
        {visible && !error ? (
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
          className={`photo-checkbox ${isSelected || hasAnySelected ? 'visible' : ''}`}
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
