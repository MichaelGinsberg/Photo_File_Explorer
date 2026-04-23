import React, { useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import PhotoItem from './PhotoItem'

export default function PhotoGrid() {
  const {
    filteredPhotos,
    selectedPaths,
    activePhoto,
    viewMode,
    isLoading,
    currentFolder,
    selectPhoto,
    setActivePhoto,
    selectAll,
    deselectAll
  } = useApp()

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      } else if (e.key === 'Escape') {
        deselectAll()
      }
    },
    [selectAll, deselectAll]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Click on empty area to deselect
  const handleGridClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      deselectAll()
    }
  }

  if (!currentFolder) {
    return (
      <div className="photo-grid-empty">
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h2>No Folder Open</h2>
          <p>Click "Open Folder" to browse your photos.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={viewMode === 'grid' ? 'photo-grid' : 'photo-list'}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className={viewMode === 'grid' ? 'photo-item-skeleton' : 'photo-list-item-skeleton'}>
            <div className="skeleton-thumb" />
            {viewMode === 'list' && <div className="skeleton-text" />}
          </div>
        ))}
      </div>
    )
  }

  if (filteredPhotos.length === 0) {
    return (
      <div className="photo-grid-empty">
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h2>No Photos Found</h2>
          <p>
            {currentFolder
              ? 'No photos match your current filter, or the folder is empty.'
              : 'Open a folder to see your photos.'}
          </p>
        </div>
      </div>
    )
  }

  const hasSelection = selectedPaths.size > 0

  return (
    <div
      className={`${viewMode === 'grid' ? 'photo-grid' : 'photo-list'}${hasSelection ? ' has-selection' : ''}`}
      onClick={handleGridClick}
    >
      {filteredPhotos.map((photo) => (
        <PhotoItem
          key={photo.path}
          photo={photo}
          isSelected={selectedPaths.has(photo.path)}
          isActive={activePhoto?.path === photo.path}
          viewMode={viewMode}
          onSelect={selectPhoto}
          onActivate={setActivePhoto}
        />
      ))}
    </div>
  )
}
