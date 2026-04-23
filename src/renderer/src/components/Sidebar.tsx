import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { DEFAULT_TAG_COLOR, hexToRgba } from '../tagColors'

interface ContextMenu {
  x: number
  y: number
  targetPath: string
}

interface TreeNode {
  path: string
  name: string
  children: string[] | null  // null = not yet loaded
  photoCount: number         // -1 = not yet loaded
}

const INVALID_FOLDER_CHARS = /[/\\*?"<>|:\x00]/

function FolderIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.54 3.87L.5 3a2 2 0 012-2h3.19a2 2 0 011.45.63l.33.37H14a2 2 0 012 2v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 010 12.5V3.87z"/>
    </svg>
  )
}

export default function Sidebar() {
  const {
    allTags, filterTags, filteredPhotos, photos, photoData,
    toggleFilterTag, currentFolder, openFolder, navigateToFolder,
    tagGroups, activeGroupId, setActiveGroupId,
    setShowTagGroupModal, setEditingGroup,
    tagColorMap
  } = useApp()

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  // New folder state
  const [creatingIn, setCreatingIn] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderError, setNewFolderError] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // Rename folder state
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Error from move operation
  const [folderOpError, setFolderOpError] = useState('')

  // ── Folder tree state ────────────────────────────────────────────────────────
  // treeRoot is the folder at the top of the visible tree. It only resets when
  // the user opens a folder that is outside the current tree — not on every
  // navigateToFolder call, so the tree stays intact as the user browses.
  const [treeRoot, setTreeRoot] = useState<string | null>(null)
  const [treeNodes, setTreeNodes] = useState<Record<string, TreeNode>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadNodeChildren = useCallback(async (nodePath: string) => {
    const [dirsRes, countRes] = await Promise.all([
      window.api.readSubdirectories(nodePath),
      window.api.countPhotosInDirectory(nodePath)
    ])
    const children = dirsRes.success && dirsRes.data ? dirsRes.data : []
    const photoCount = countRes.success && countRes.data != null ? countRes.data : 0

    setTreeNodes(prev => {
      const next = { ...prev }
      next[nodePath] = { ...next[nodePath], children, photoCount }
      for (const childPath of children) {
        if (!next[childPath]) {
          next[childPath] = {
            path: childPath,
            name: childPath.split(/[\\/]/).filter(Boolean).pop() ?? childPath,
            children: null,
            photoCount: -1
          }
        }
      }
      return next
    })
  }, [])

  // Update treeRoot only when currentFolder moves outside the current tree
  useEffect(() => {
    if (!currentFolder) { setTreeRoot(null); setTreeNodes({}); setExpanded(new Set()); return }
    const isUnderRoot = treeRoot && (
      currentFolder === treeRoot ||
      currentFolder.startsWith(treeRoot + '/') ||
      currentFolder.startsWith(treeRoot + '\\')
    )
    if (!isUnderRoot) setTreeRoot(currentFolder)
  // treeRoot intentionally omitted: we only want to react to currentFolder changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder])

  // Reset the tree when treeRoot changes
  useEffect(() => {
    if (!treeRoot) return
    const rootName = treeRoot.split(/[\\/]/).filter(Boolean).pop() ?? treeRoot
    setTreeNodes({ [treeRoot]: { path: treeRoot, name: rootName, children: null, photoCount: -1 } })
    setExpanded(new Set([treeRoot]))
    loadNodeChildren(treeRoot)
  }, [treeRoot, loadNodeChildren])

  const handleToggleExpand = useCallback(async (nodePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const isExpanded = expanded.has(nodePath)
    if (!isExpanded) {
      setExpanded(prev => { const next = new Set(prev); next.add(nodePath); return next })
      const node = treeNodes[nodePath]
      if (!node || node.children === null) {
        await loadNodeChildren(nodePath)
      }
    } else {
      setExpanded(prev => { const next = new Set(prev); next.delete(nodePath); return next })
    }
  }, [expanded, treeNodes, loadNodeChildren])

  const refreshSubtree = useCallback(async (nodePath: string) => {
    await loadNodeChildren(nodePath)
  }, [loadNodeChildren])

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const dismiss = () => setContextMenu(null)
    window.addEventListener('click', dismiss)
    return () => window.removeEventListener('click', dismiss)
  }, [contextMenu])

  // Focus new-folder input when it appears
  useEffect(() => {
    if (creatingIn) newFolderInputRef.current?.focus()
  }, [creatingIn])

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingPath) renameInputRef.current?.focus()
  }, [renamingPath])

  const handleContextMenu = useCallback((e: React.MouseEvent, targetPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath })
  }, [])

  // ── New Folder ───────────────────────────────────────────────────────────────

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
    if (creatingIn) await refreshSubtree(creatingIn)
  }, [creatingIn, newFolderName, refreshSubtree])

  const handleCancelFolder = useCallback(() => {
    setCreatingIn(null)
    setNewFolderName('')
    setNewFolderError('')
  }, [])

  // ── Rename Folder ────────────────────────────────────────────────────────────

  const handleRenameAction = useCallback(() => {
    if (!contextMenu) return
    const target = contextMenu.targetPath
    const name = target.split(/[\\/]/).filter(Boolean).pop() ?? ''
    setRenamingPath(target)
    setRenameValue(name)
    setRenameError('')
    setFolderOpError('')
    setContextMenu(null)
  }, [contextMenu])

  const handleRenameFolder = useCallback(async () => {
    if (!renamingPath) return
    const name = renameValue.trim()
    if (!name) { setRenameError('Folder name is required'); return }
    if (INVALID_FOLDER_CHARS.test(name) || /^\.+$/.test(name)) {
      setRenameError('Invalid folder name')
      return
    }
    const lastSlash = Math.max(renamingPath.lastIndexOf('/'), renamingPath.lastIndexOf('\\'))
    const dir = renamingPath.slice(0, lastSlash)
    const sep = renamingPath.includes('/') ? '/' : '\\'
    const newPath = dir + sep + name

    if (newPath === renamingPath) {
      setRenamingPath(null)
      return
    }

    const res = await window.api.moveFolder(renamingPath, newPath)
    if (!res.success) { setRenameError(res.error ?? 'Rename failed'); return }

    await window.api.renameFolderPath(renamingPath, newPath)

    const wasCurrentFolder = renamingPath === currentFolder
    setRenamingPath(null)
    setRenameValue('')
    setRenameError('')

    if (wasCurrentFolder) {
      await navigateToFolder(newPath)
    } else if (currentFolder) {
      await refreshSubtree(currentFolder)
    }
  }, [renamingPath, renameValue, currentFolder, navigateToFolder, refreshSubtree])

  const handleCancelRename = useCallback(() => {
    setRenamingPath(null)
    setRenameValue('')
    setRenameError('')
  }, [])

  // ── Move Folder ──────────────────────────────────────────────────────────────

  const handleMoveFolderAction = useCallback(async () => {
    if (!contextMenu) return
    const targetPath = contextMenu.targetPath
    setContextMenu(null)
    setFolderOpError('')

    const res = await window.api.browseDestination()
    if (!res.success || !res.data) return

    const destParent = res.data
    const folderName = targetPath.split(/[\\/]/).filter(Boolean).pop() ?? ''
    if (!folderName) return

    const sep = targetPath.includes('/') ? '/' : '\\'
    const newPath = destParent + sep + folderName

    if (newPath === targetPath) return

    const moveRes = await window.api.moveFolder(targetPath, newPath)
    if (!moveRes.success) {
      setFolderOpError(moveRes.error ?? 'Move failed')
      return
    }

    await window.api.renameFolderPath(targetPath, newPath)

    if (currentFolder === targetPath) {
      await navigateToFolder(newPath)
    } else if (currentFolder) {
      await refreshSubtree(currentFolder)
    }
  }, [contextMenu, currentFolder, navigateToFolder, refreshSubtree])

  // ── Tag group counts ─────────────────────────────────────────────────────────

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const group of tagGroups) {
      if (group.tags.length === 0) { counts[group.id] = 0; continue }
      const groupTagSet = new Set(group.tags)
      counts[group.id] = photos.filter(photo => {
        const tags = photoData[photo.path]?.tags
        return !!tags && tags.some(t => groupTagSet.has(t))
      }).length
    }
    return counts
  }, [tagGroups, photos, photoData])

  const clearAllFilters = () => {
    for (const tag of filterTags) toggleFilterTag(tag)
    setActiveGroupId(null)
  }

  const allActive = filterTags.length === 0 && activeGroupId === null

  const renderTree = (nodePath: string, depth: number): React.ReactNode => {
    const node = treeNodes[nodePath]
    if (!node) return null
    const isExpanded = expanded.has(nodePath)
    const isActive = nodePath === currentFolder
    const children = node.children ?? []
    const hasChildren = node.children === null || children.length > 0

    return (
      <React.Fragment key={nodePath}>
        {renamingPath === nodePath ? (
          <div className="ft-rename-row" style={{ paddingLeft: depth * 14 + 6 }}>
            <FolderIcon className="ft-icon" />
            <input
              ref={renameInputRef}
              className="new-folder-input"
              value={renameValue}
              onChange={e => { setRenameValue(e.target.value); setRenameError('') }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameFolder()
                else if (e.key === 'Escape') handleCancelRename()
              }}
            />
            <button className="rename-confirm-btn" onMouseDown={handleRenameFolder}>✓</button>
            <button className="rename-cancel-btn" onMouseDown={handleCancelRename}>✕</button>
            {renameError && <div className="new-folder-error">{renameError}</div>}
          </div>
        ) : (
          <div
            className={`ft-row${isActive ? ' ft-row--active' : ''}`}
            onContextMenu={e => handleContextMenu(e, nodePath)}
          >
            <span className="ft-indent" style={{ width: depth * 14 }} />
            <button
              className={`ft-arrow${hasChildren ? '' : ' ft-arrow--hidden'}`}
              onClick={e => handleToggleExpand(nodePath, e)}
              tabIndex={-1}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '▾' : '▸'}
            </button>
            <button
              className="ft-label"
              onClick={() => navigateToFolder(nodePath)}
              title={nodePath}
            >
              <FolderIcon className="ft-icon" />
              <span className="ft-name">{node.name}</span>
            </button>
            <span className="ft-count">
              {node.photoCount >= 0 ? node.photoCount : ''}
            </span>
          </div>
        )}
        {isExpanded && children.map(childPath => renderTree(childPath, depth + 1))}
        {creatingIn === nodePath && (
          <>
            <div className="ft-new-folder-row" style={{ paddingLeft: (depth + 1) * 14 + 24 }}>
              <FolderIcon className="ft-icon" />
              <input
                ref={newFolderInputRef}
                className="new-folder-input"
                placeholder="New folder name…"
                value={newFolderName}
                onChange={e => { setNewFolderName(e.target.value); setNewFolderError('') }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder()
                  else if (e.key === 'Escape') handleCancelFolder()
                }}
              />
            </div>
            {newFolderError && (
              <div className="new-folder-error" style={{ paddingLeft: (depth + 1) * 14 + 24 }}>{newFolderError}</div>
            )}
          </>
        )}
      </React.Fragment>
    )
  }

  return (
    <aside className="sidebar">
      {/* ── Folders header ── */}
      <div className="sidebar-header sidebar-header--folders">
        <span className="sidebar-title">Folders</span>
        <button className="sidebar-new-btn" onClick={openFolder} title="Open a different folder">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M.54 3.87L.5 3a2 2 0 012-2h3.19a2 2 0 011.45.63l.33.37H14a2 2 0 012 2v8.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 010 12.5V3.87z"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable area ── */}
      <div className="sidebar-scroll-area">

        {/* Folder tree */}
        <div className="folder-tree">
          {!treeRoot ? (
            <div className="sidebar-empty">
              <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={openFolder}>
                Open a folder…
              </button>
            </div>
          ) : renderTree(treeRoot, 0)}
          {folderOpError && <div className="new-folder-error" style={{ padding: '4px 8px' }}>{folderOpError}</div>}
        </div>

        {/* Tags section */}
        <div className="sidebar-header sidebar-header--tags sidebar-sticky-header">
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
        <div className="sidebar-header sidebar-header--groups sidebar-sticky-header">
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
          <div className="context-menu-separator" />
          <button className="context-menu-item" onMouseDown={handleRenameAction}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>
            </svg>
            Rename Folder
          </button>
          <button className="context-menu-item" onMouseDown={handleMoveFolderAction}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M.5 3.5A.5.5 0 011 3h4a.5.5 0 01.5.5v1a.5.5 0 01-.5.5H1.5v8h11V5H9.5a.5.5 0 01-.5-.5v-1A.5.5 0 019.5 3H13a.5.5 0 01.5.5v10a.5.5 0 01-.5.5H1a.5.5 0 01-.5-.5v-10z"/>
              <path d="M8 1a.5.5 0 01.5.5V9H10a.25.25 0 01.2.4l-2 2.667a.25.25 0 01-.4 0l-2-2.667A.25.25 0 016 9h1.5V1.5A.5.5 0 018 1z"/>
            </svg>
            Move Folder
          </button>
        </div>
      )}
    </aside>
  )
}
