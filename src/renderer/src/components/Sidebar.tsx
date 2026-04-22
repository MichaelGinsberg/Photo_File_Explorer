import React from 'react'
import { useApp } from '../context/AppContext'

export default function Sidebar() {
  const { allTags, filterTags, filteredPhotos, photos, toggleFilterTag, currentFolder, openFolder } = useApp()

  const clearFilter = () => {
    for (const tag of filterTags) {
      toggleFilterTag(tag)
    }
  }

  const allActive = filterTags.length === 0

  // Derive display name (last path segment) from the full folder path
  const folderName = currentFolder
    ? currentFolder.split(/[\\/]/).filter(Boolean).pop() ?? currentFolder
    : null

  return (
    <aside className="sidebar">
      {/* ── Folder section ── */}
      <div className="sidebar-header">
        <span className="sidebar-title">Folder</span>
      </div>
      <div className="sidebar-folder">
        <button className="sidebar-folder-btn" onClick={openFolder} title={currentFolder ?? 'Open a folder'}>
          <svg className="sidebar-folder-icon" width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M.54 3.87L.5 3a2 2 0 012-2h3.19a2 2 0 011.45.63l.33.37H14a2 2 0 012 2v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 010 12.5V3.87z"/>
          </svg>
          <span className="sidebar-folder-text">
            {folderName
              ? <><span className="sidebar-folder-name">{folderName}</span><span className="sidebar-folder-path">{currentFolder}</span></>
              : <span className="sidebar-folder-placeholder">Open a folder…</span>
            }
          </span>
          <svg className="sidebar-folder-chevron" width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z"/>
          </svg>
        </button>
      </div>

      {/* ── Tags section ── */}
      <div className="sidebar-header sidebar-header--tags">
        <span className="sidebar-title">Tags</span>
      </div>

      <nav className="sidebar-nav">
        {/* All Photos */}
        <button
          className={`sidebar-item ${allActive ? 'active' : ''}`}
          onClick={clearFilter}
        >
          <span className="sidebar-item-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
          </span>
          <span className="sidebar-item-label">All Photos</span>
          <span className="sidebar-item-count">
            {filterTags.length > 0 ? filteredPhotos.length : photos.length}
          </span>
        </button>

        {/* Tag list */}
        {allTags.length > 0 && (
          <>
            <div className="sidebar-section-label">Filter by Tag</div>
            {allTags.map((tag) => {
              const isActive = filterTags.includes(tag.name)
              return (
                <button
                  key={tag.name}
                  className={`sidebar-item sidebar-tag-item ${isActive ? 'active' : ''}`}
                  onClick={() => toggleFilterTag(tag.name)}
                >
                  <span className="sidebar-tag-dot" />
                  <span className="sidebar-item-label">{tag.name}</span>
                  <span className="sidebar-item-count">{tag.count}</span>
                </button>
              )
            })}
          </>
        )}

        {allTags.length === 0 && (
          <div className="sidebar-empty">
            <p>No tags yet.</p>
            <p>Select a photo and add tags in the metadata panel.</p>
          </div>
        )}
      </nav>
    </aside>
  )
}
