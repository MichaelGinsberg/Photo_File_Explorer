import React from 'react'
import { useApp } from '../context/AppContext'
import type { SortField, SortDir, ViewMode } from '../types'

export default function Toolbar() {
  const {
    currentFolder,
    selectedPaths,
    sortBy,
    sortDir,
    viewMode,
    openFolder,
    deselectAll,
    selectAll,
    setSortBy,
    setSortDir,
    setViewMode,
    setShowMoveModal,
    setShowRenameModal,
    setIsCopyMode
  } = useApp()

  const selectedCount = selectedPaths.size

  const handleSort = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortField)
  }

  const toggleSortDir = () => {
    setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
  }

  const handleMove = () => {
    setIsCopyMode(false)
    setShowMoveModal(true)
  }

  const handleCopy = () => {
    setIsCopyMode(true)
    setShowMoveModal(true)
  }

  const handleRename = () => {
    setShowRenameModal(true)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-main">
        {/* Open folder button */}
        <button className="btn btn-primary toolbar-open-btn" onClick={openFolder}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/>
          </svg>
          Open Folder
        </button>

        {/* Current folder path */}
        <div className="toolbar-path" title={currentFolder || ''}>
          {currentFolder || 'No folder selected'}
        </div>

        {/* Right side controls */}
        <div className="toolbar-right">
          {/* View mode toggle */}
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid' as ViewMode)}
              title="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3A1.5 1.5 0 0115 10.5v3A1.5 1.5 0 0113.5 15h-3A1.5 1.5 0 019 13.5v-3z"/>
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list' as ViewMode)}
              title="List view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/>
              </svg>
            </button>
          </div>

          {/* Sort controls */}
          <select className="sort-select" value={sortBy} onChange={handleSort}>
            <option value="name">Name</option>
            <option value="date">Date Modified</option>
            <option value="dateTaken">Date Taken</option>
            <option value="size">File Size</option>
            <option value="location">Location</option>
          </select>
          <button
            className="sort-dir-btn"
            onClick={toggleSortDir}
            title={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="toolbar-bulk">
          <span className="bulk-count">{selectedCount} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={deselectAll}>
            Deselect All
          </button>
          <button className="btn btn-ghost btn-sm" onClick={selectAll}>
            Select All
          </button>
          <div className="bulk-separator" />
          <button className="btn btn-secondary btn-sm" onClick={handleRename}>
            ✎ Rename
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleMove}>
            → Move
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
            ⎘ Copy
          </button>
        </div>
      )}
    </div>
  )
}
