import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { DEFAULT_TAG_COLOR, hexToRgba } from '../tagColors'

interface ContextMenu {
  x: number
  y: number
  targetPath: string
}

const INVALID_FOLDER_CHARS = /[/\\*?"<>|:\x00]/

export default function Sidebar() {
  const {
    allTags, filterTags, filteredPhotos, photos, photoData,
    toggleFilterTag, currentFolder, openFolder, navigateToFolder,
    tagGroups, activeGroupId, setActiveGroupId,
    setShowTagGroupModal, setEditingGroup,
    tagColorMap
  } = useApp()

  const [subdirs, setSubdirs] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderError, setNewFolderError] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  const loadSubdirs = useCallback((folder: string) => {
    window.api.readSubdirectories(folder)
      .then(res => { if (res.success && res.data) setSubdirs(res.data) })
      .catch(() => setSubdirs([]))
  }, [])

  useEffect(() => {
    if (!currentFolder) { setSubdirs([]); return }
    loadSubdirs(currentFolder)
  }, [currentFolder, loadSubdirs])

  useEffect(() => {
    if (!contextMenu) return
    const dismiss = () => setContextMenu(null)
    window.addEventListener('click', dismiss)
    return () => window.removeEventListener('click', dismiss)
  }, [contextMenu])

  useEffect(() => {
    if (creatingIn) newFolderInputRef.current?.focus()
  }, [creatingIn])

  const handleContextMenu = useCallback((e: React.MouseEvent, targetPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath })
  }, [])

  const handleNewFolderAction = useCallback(() => {
    if (!contextMenu) return
    setCreatingIn(contextMenu.targetPath)
    setNewFolderName('')
    setNewFolderError('')
    setContextMenu(null)
  }, [contextMenu])

  const handleCreateFolder = useCallback(async () => {
    if (!creatingIn) return
    const name = newFolderName.trim()
    if (!name) { setNewFolderError('Folder name is required'); return }
    if (INVALID_FOLDER_CHARS.test(name) || /^\.+$/.test(name)) {
      setNewFolderError('Invalid folder name')
      return
    }
    const sep = creatingIn.includes('/') ? '/' : '\\'
    const newPath = creatingIn + sep + name
    const res = await window.api.createDirectory(newPath)
    if (!res.success) { setNewFolderError(res.error ?? 'Failed to create folder'); return }

    setCreatingIn(null)
    setNewFolderName('')
    setNewFolderError('')
    if (currentFolder && creatingIn === currentFolder) loadSubdirs(currentFolder)
  }, [creatingIn, newFolderName, currentFolder, loadSubdirs])

  const handleCancelFolder = useCallback(() => {
    setCreatingIn(null)
    setNewFolderName('')
    setNewFolderError('')
  }, [])

  // Count photos matching each tag group (OR logic, against full unfiltered set)
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const group of tagGroups) {
      if (group.tags.length === 0) { counts[group.id] = 0; continue }
      counts[group.id] = photos.filter(photo => {
        const data = photoData[photo.path]
        if (!data?.tags) return false
        return group.tags.some(t => data.tags.includes(t))
      }).length
    }
    return counts
  }, [tagGroups, photos, photoData])

  const clearAllFilters = () => {
    for (const tag of filterTags) toggleFilterTag(tag)
    setActiveGroupId(null)
  }

  const allActive = filterTags.length === 0 && activeGroupId === null

  const folderName = currentFolder
    ? currentFolder.split(/[\\/]/).filter(Boolean).pop() ?? currentFolder
    : null

  const FolderIcon = ({ size = 13, className = '' }: { size?: number; className?: string }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.54 3.87L.5 3a2 2 0 012-2h3.19a2 2 0 011.45.63l.33.37H14a2 2 0 012 2v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 010 12.5V3.87z"/>
    </svg>
  )

  return (
    <aside className="sidebar">
      {/* ── Folder section (fixed, not in scroll area) ── */}
      <div className="sidebar-header">
        <span className="sidebar-title">Folder</span>
      </div>
      <div className="sidebar-folder">
        <button
          className="sidebar-folder-btn"
          onClick={openFolder}
          onContextMenu={(e) => currentFolder && handleContextMenu(e, currentFolder)}
          title={currentFolder ?? 'Open a folder'}
        >
          <FolderIcon size={15} className="sidebar-folder-icon" />
          <span className="sidebar-folder-text">
            {folderName
              ? <>
                  <span className="sidebar-folder-name">{folderName}</span>
                  <span className="sidebar-folder-path">{currentFolder}</span>
                </>
              : <span className="sidebar-folder-placeholder">Open a folder…</span>
            }
          </span>
          <svg className="sidebar-folder-chevron" width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 1.646a.5.5 0 01.708 0l6 6a.5.5 0 010 .708l-6 6a.5.5 0 01-.708-.708L10.293 8 4.646 2.354a.5.5 0 010-.708z"/>
          </svg>
        </button>

        {subdirs.length > 0 && (
          <div className="subdir-list">
            {subdirs.map(dirPath => {
              const dirName = dirPath.split(/[\\/]/).filter(Boolean).pop() ?? dirPath
              return (
                <button
                  key={dirPath}
                  className="subdir-item"
                  onClick={() => navigateToFolder(dirPath)}
                  onContextMenu={(e) => handleContextMenu(e, dirPath)}
                  title={dirPath}
                >
                  <FolderIcon className="subdir-item-icon" />
                  <span className="subdir-item-label">{dirName}</span>
                </button>
              )
            })}
          </div>
        )}

        {creatingIn && (
          <div className="new-folder-form">
            <div className="new-folder-row">
              <FolderIcon className="new-folder-icon" />
              <input
                ref={newFolderInputRef}
                className="new-folder-input"
                type="text"
                placeholder="New folder name…"
                value={newFolderName}
                onChange={e => { setNewFolderName(e.target.value); setNewFolderError('') }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder()
                  else if (e.key === 'Escape') handleCancelFolder()
                }}
              />
            </div>
            {newFolderError && <div className="new-folder-error">{newFolderError}</div>}
          </div>
        )}
      </div>

      {/* ── Scrollable area: Tags + Tag Groups ── */}
      <div className="sidebar-scroll-area">

        {/* Tags section */}
        <div className="sidebar-header sidebar-header--tags">
          <span className="sidebar-title">Tags</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${allActive ? 'active' : ''}`}
            onClick={clearAllFilters}
          >
            <span className="sidebar-item-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
                <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
              </svg>
            </span>
            <span className="sidebar-item-label">All Photos</span>
            <span className="sidebar-item-count">
              {allActive ? photos.length : filteredPhotos.length}
            </span>
          </button>

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
                    <span
                      className="sidebar-tag-dot"
                      style={{ background: tagColorMap[tag.name] ?? DEFAULT_TAG_COLOR }}
                    />
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

        {/* Tag Groups section */}
        <div className="sidebar-header sidebar-header--groups">
          <span className="sidebar-title">Tag Groups</span>
          <button
            className="sidebar-new-btn"
            title="New tag group"
            onClick={() => { setEditingGroup(null); setShowTagGroupModal(true) }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-groups">
          {tagGroups.length === 0 ? (
            <div className="sidebar-empty">
              <p>No groups yet.</p>
              <p>Create a group to filter photos by multiple tags at once.</p>
            </div>
          ) : (
            tagGroups.map(group => {
              const isActive = activeGroupId === group.id
              const color = group.color || DEFAULT_TAG_COLOR
              return (
                <div
                  key={group.id}
                  className={`sidebar-group-item ${isActive ? 'active' : ''}`}
                  style={isActive ? { background: hexToRgba(color, 0.22) } : undefined}
                >
                  <button
                    className="sidebar-group-main"
                    onClick={() => setActiveGroupId(isActive ? null : group.id)}
                  >
                    <span
                      className="sidebar-group-dot"
                      style={{ background: color }}
                    />
                    <span className="sidebar-item-label">{group.name}</span>
                    <span
                      className="sidebar-item-count"
                      style={isActive ? { background: hexToRgba(color, 0.3), color: 'white' } : undefined}
                    >
                      {groupCounts[group.id] ?? 0}
                    </span>
                  </button>
                  <button
                    className="sidebar-group-edit-btn"
                    title="Edit group"
                    onClick={(e) => { e.stopPropagation(); setEditingGroup(group); setShowTagGroupModal(true) }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>

      </div>{/* end sidebar-scroll-area */}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button className="context-menu-item" onMouseDown={handleNewFolderAction}>
            <FolderIcon />
            New Folder
          </button>
        </div>
      )}
    </aside>
  )
}
