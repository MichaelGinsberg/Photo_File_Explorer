import React from 'react'
import { useApp } from '../context/AppContext'

export default function Sidebar() {
  const { allTags, filterTags, filteredPhotos, photos, toggleFilterTag } = useApp()

  const clearFilter = () => {
    // Clear all filter tags by toggling each active one off
    for (const tag of filterTags) {
      toggleFilterTag(tag)
    }
  }

  const allActive = filterTags.length === 0

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
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
