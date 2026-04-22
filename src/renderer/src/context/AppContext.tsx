import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef
} from 'react'
import type {
  Photo,
  PhotoData,
  ExifData,
  SortField,
  SortDir,
  ViewMode,
  TagInfo,
  RenameEntry,
  TagGroup
} from '../types'

// ─── Context shape ────────────────────────────────────────────────────────────

interface AppContextValue {
  // State
  currentFolder: string | null
  photos: Photo[]
  selectedPaths: Set<string>
  activePhoto: Photo | null
  photoData: Record<string, PhotoData>
  exifCache: Record<string, ExifData>
  allTags: TagInfo[]
  filterTags: string[]
  tagGroups: TagGroup[]
  activeGroupId: string | null
  showTagGroupModal: boolean
  editingGroup: TagGroup | null
  sortBy: SortField
  sortDir: SortDir
  viewMode: ViewMode
  isLoading: boolean
  showMoveModal: boolean
  showRenameModal: boolean
  isCopyMode: boolean
  platform: string

  // Computed
  filteredPhotos: Photo[]
  tagColorMap: Record<string, string>

  // Actions
  openFolder(): Promise<void>
  navigateToFolder(folder: string): Promise<void>
  selectPhoto(photo: Photo, event: React.MouseEvent): void
  selectAll(): void
  deselectAll(): void
  setActivePhoto(photo: Photo | null): void
  loadExif(filePath: string): Promise<void>
  updatePhotoData(filePath: string, data: Partial<PhotoData>): Promise<void>
  toggleFilterTag(tag: string): void
  setActiveGroupId(id: string | null): void
  saveTagGroups(groups: TagGroup[]): Promise<void>
  setShowTagGroupModal(show: boolean): void
  setEditingGroup(group: TagGroup | null): void
  renameFiles(renames: RenameEntry[]): Promise<void>
  moveFiles(destDir: string, copy: boolean): Promise<void>
  refreshFolder(): Promise<void>
  setSortBy(field: SortField): void
  setSortDir(dir: SortDir): void
  setViewMode(mode: ViewMode): void
  setShowMoveModal(show: boolean): void
  setShowRenameModal(show: boolean): void
  setIsCopyMode(copy: boolean): void
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultPhotoData = (): PhotoData => ({
  tags: [],
  rating: 0,
  description: '',
  notes: '',
  date: '',
  location: ''
})

const AppContext = createContext<AppContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Refs must be declared before any state that references them
  const lastClickedPath = useRef<string | null>(null)
  const exifCacheRef = useRef<Record<string, ExifData>>({})
  const photoDataRef = useRef<Record<string, PhotoData>>({})

  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [activePhoto, setActivePhotoState] = useState<Photo | null>(null)
  const [photoData, setPhotoData] = useState<Record<string, PhotoData>>({})
  const [exifCache, setExifCache] = useState<Record<string, ExifData>>({})
  exifCacheRef.current = exifCache   // keep refs in sync with state on every render
  photoDataRef.current = photoData
  const [allTags, setAllTags] = useState<TagInfo[]>([])
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [showTagGroupModal, setShowTagGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<TagGroup | null>(null)
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isLoading, setIsLoading] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [isCopyMode, setIsCopyMode] = useState(false)
  const [platform, setPlatform] = useState('win32')

  // On mount: detect platform and restore the last open folder in parallel
  useEffect(() => {
    window.api.getPlatform().then(setPlatform).catch(console.error)

    window.api.getLastFolder()
      .then(res => {
        if (!res.success || !res.data) return
        const folder = res.data
        setCurrentFolder(folder)
        setFilterTags([])
        lastClickedPath.current = null
        loadFolder(folder)
      })
      .catch(console.error)
  // loadFolder is stable (its deps are all stable); eslint would flag it as missing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh all tags + groups from store
  const refreshTags = useCallback(async () => {
    const [tagsRes, groupsRes] = await Promise.all([
      window.api.getAllTags(),
      window.api.getTagGroups()
    ])
    if (tagsRes.success && tagsRes.data) setAllTags(tagsRes.data)
    if (groupsRes.success && groupsRes.data) setTagGroups(groupsRes.data)
  }, [])

  // ─── Computed: tagColorMap ─────────────────────────────────────────────────
  // Maps each tag name to the color of its first group. Tags not in any group
  // are absent from the map; consumers should fall back to DEFAULT_TAG_COLOR.

  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const group of tagGroups) {
      if (!group.color) continue
      for (const tag of group.tags) {
        if (!map[tag]) map[tag] = group.color
      }
    }
    return map
  }, [tagGroups])

  // ─── Computed: filteredPhotos ───────────────────────────────────────────────

  const filteredPhotos = useMemo(() => {
    let list = [...photos]

    // Filter by selected tags (AND — photo must have every selected tag)
    if (filterTags.length > 0) {
      list = list.filter((photo) => {
        const data = photoData[photo.path]
        if (!data || !data.tags) return false
        return filterTags.every((tag) => data.tags.includes(tag))
      })
    }

    // Filter by active group (OR — photo must have at least one group tag)
    if (activeGroupId) {
      const group = tagGroups.find(g => g.id === activeGroupId)
      if (group && group.tags.length > 0) {
        list = list.filter((photo) => {
          const data = photoData[photo.path]
          if (!data?.tags) return false
          return group.tags.some(t => data.tags.includes(t))
        })
      }
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'date') cmp = a.modified - b.modified
      else if (sortBy === 'size') cmp = a.size - b.size
      else if (sortBy === 'dateTaken') {
        const aMs = photoData[a.path]?.date
          ? new Date(photoData[a.path].date).getTime()
          : a.modified
        const bMs = photoData[b.path]?.date
          ? new Date(photoData[b.path].date).getTime()
          : b.modified
        cmp = aMs - bMs
      } else if (sortBy === 'location') {
        cmp = (photoData[a.path]?.location ?? '').localeCompare(photoData[b.path]?.location ?? '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [photos, photoData, filterTags, activeGroupId, tagGroups, sortBy, sortDir])

  // ─── loadFolder (must be defined before openFolder) ───────────────────────

  const loadFolder = useCallback(async (folder: string) => {
    setIsLoading(true)
    try {
      const [dirRes, allDataRes] = await Promise.all([
        window.api.readDirectory(folder),
        window.api.getAllPhotoData()
      ])

      if (!dirRes.success || !dirRes.data) {
        setPhotos([])
        return
      }

      const loadedPhotos = dirRes.data
      setPhotos(loadedPhotos)

      const storedData = allDataRes.success && allDataRes.data ? allDataRes.data : {}
      const dataMap: Record<string, PhotoData> = {}
      for (const photo of loadedPhotos) {
        dataMap[photo.path] = storedData[photo.path] || defaultPhotoData()
      }
      setPhotoData(dataMap)

      await refreshTags()
    } finally {
      setIsLoading(false)
    }
  }, [refreshTags])

  // ─── openFolder ────────────────────────────────────────────────────────────

  const openFolder = useCallback(async () => {
    const res = await window.api.openFolder()
    if (!res.success || !res.data) return

    const folder = res.data
    setCurrentFolder(folder)
    setSelectedPaths(new Set())
    setActivePhotoState(null)
    setFilterTags([])
    lastClickedPath.current = null
    await loadFolder(folder)
  }, [loadFolder])

  // ─── navigateToFolder ──────────────────────────────────────────────────────

  const navigateToFolder = useCallback(async (folder: string) => {
    setCurrentFolder(folder)
    setSelectedPaths(new Set())
    setActivePhotoState(null)
    setFilterTags([])
    setActiveGroupId(null)
    lastClickedPath.current = null
    await window.api.setLastFolder(folder)
    await loadFolder(folder)
  }, [loadFolder])

  // ─── refreshFolder ─────────────────────────────────────────────────────────

  const refreshFolder = useCallback(async () => {
    if (!currentFolder) return
    await loadFolder(currentFolder)
  }, [currentFolder, loadFolder])

  // ─── selectPhoto ───────────────────────────────────────────────────────────

  const selectPhoto = useCallback(
    (photo: Photo, event: React.MouseEvent) => {
      const path = photo.path

      if (event.shiftKey && lastClickedPath.current) {
        // Shift+click: range selection
        const paths = filteredPhotos.map((p) => p.path)
        const lastIdx = paths.indexOf(lastClickedPath.current)
        const currIdx = paths.indexOf(path)
        if (lastIdx !== -1 && currIdx !== -1) {
          const [start, end] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
          const rangeSet = new Set(paths.slice(start, end + 1))
          setSelectedPaths((prev) => {
            const next = new Set(prev)
            for (const p of rangeSet) next.add(p)
            return next
          })
        }
      } else if (event.ctrlKey || event.metaKey) {
        // Ctrl+click: toggle
        setSelectedPaths((prev) => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
        lastClickedPath.current = path
      } else {
        // Plain click: single select
        setSelectedPaths(new Set([path]))
        lastClickedPath.current = path
        setActivePhotoState(photo)
      }
    },
    [filteredPhotos]
  )

  // ─── selectAll / deselectAll ───────────────────────────────────────────────

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(filteredPhotos.map((p) => p.path)))
  }, [filteredPhotos])

  const deselectAll = useCallback(() => {
    setSelectedPaths(new Set())
  }, [])

  // ─── setActivePhoto ────────────────────────────────────────────────────────

  const setActivePhoto = useCallback((photo: Photo | null) => {
    setActivePhotoState(photo)
    if (photo) {
      setSelectedPaths((prev) => {
        const next = new Set(prev)
        next.add(photo.path)
        return next
      })
    }
  }, [])

  // ─── loadExif ──────────────────────────────────────────────────────────────

  const loadExif = useCallback(async (filePath: string) => {
    if (exifCacheRef.current[filePath]) return
    const res = await window.api.getExifData(filePath)
    if (res.success && res.data) {
      setExifCache((prev) => ({ ...prev, [filePath]: res.data! }))
    }
  }, []) // stable — reads cache via ref, not closure

  // ─── updatePhotoData ───────────────────────────────────────────────────────

  const updatePhotoData = useCallback(
    async (filePath: string, data: Partial<PhotoData>) => {
      const current = photoDataRef.current[filePath] || defaultPhotoData()
      const updated: PhotoData = { ...current, ...data }

      setPhotoData((prev) => ({ ...prev, [filePath]: updated }))

      try {
        await window.api.setPhotoData(filePath, updated)
        await refreshTags()
      } catch (err) {
        console.error('Failed to save photo data:', err)
      }
    },
    [refreshTags] // photoData removed — read via stable ref to avoid recreating on every render
  )

  // ─── toggleFilterTag ───────────────────────────────────────────────────────

  const toggleFilterTag = useCallback((tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  // ─── saveTagGroups ─────────────────────────────────────────────────────────

  const saveTagGroups = useCallback(async (groups: TagGroup[]) => {
    await window.api.setTagGroups(groups)
    setTagGroups(groups)
  }, [])

  // ─── renameFiles ───────────────────────────────────────────────────────────

  const renameFiles = useCallback(
    async (renames: RenameEntry[]) => {
      const pathMap: Record<string, string> = {}
      const errors: string[] = []

      for (const { path: oldPath, newName } of renames) {
        const dir = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')))
        const sep = oldPath.includes('/') ? '/' : '\\'
        const newPath = dir + sep + newName
        const res = await window.api.renameFile(oldPath, newPath)
        if (res.success && res.data) {
          pathMap[oldPath] = res.data
        } else {
          errors.push(`${newName}: ${res.error ?? 'unknown error'}`)
        }
      }

      // Apply state updates for whichever renames succeeded
      if (Object.keys(pathMap).length > 0) {
        // Persist path change in the store so metadata survives app restarts
        await Promise.all(
          Object.entries(pathMap).map(([oldPath, newPath]) =>
            window.api.renamePhotoPath(oldPath, newPath)
          )
        )

        setPhotos((prev) =>
          prev.map((photo) => {
            const newPath = pathMap[photo.path]
            if (!newPath) return photo
            const newName = newPath.split(/[\\/]/).pop() || photo.name
            return { ...photo, path: newPath, name: newName }
          })
        )

        setPhotoData((prev) => {
          const next = { ...prev }
          for (const [oldPath, newPath] of Object.entries(pathMap)) {
            if (next[oldPath]) {
              next[newPath] = next[oldPath]
              delete next[oldPath]
            }
          }
          return next
        })

        setSelectedPaths((prev) => {
          const next = new Set<string>()
          for (const p of prev) next.add(pathMap[p] || p)
          return next
        })

        setActivePhotoState((prev) => {
          if (!prev) return null
          const newPath = pathMap[prev.path]
          if (!newPath) return prev
          const newName = newPath.split(/[\\/]/).pop() || prev.name
          return { ...prev, path: newPath, name: newName }
        })
      }

      if (errors.length > 0) {
        // Throw so RenameModal's catch block can display the message
        throw new Error(errors.join('\n'))
      }

      setShowRenameModal(false)
    },
    []
  )

  // ─── moveFiles ─────────────────────────────────────────────────────────────

  const moveFiles = useCallback(
    async (destDir: string, copy: boolean) => {
      const pathsToMove = Array.from(selectedPaths)

      const res = copy
        ? await window.api.copyFiles(pathsToMove, destDir)
        : await window.api.moveFiles(pathsToMove, destDir)

      if (!res.success || !res.data) return

      const succeeded = res.data.filter((r) => r.success)
      const failed = res.data.filter((r) => !r.success)

      // Migrate store metadata to the new path so it survives in the destination folder
      await Promise.all(
        succeeded
          .filter((r) => r.newPath)
          .map((r) => window.api.renamePhotoPath(r.path, r.newPath!))
      )

      if (!copy && succeeded.length > 0) {
        const movedSet = new Set(succeeded.map((r) => r.path))
        setPhotos((prev) => prev.filter((p) => !movedSet.has(p.path)))
        setSelectedPaths(new Set())
        setActivePhotoState((prev) => (prev && movedSet.has(prev.path) ? null : prev))
      }

      if (failed.length > 0) {
        // Throw so MoveModal's catch block can display which files failed
        const lines = failed.map((f) => `${f.path.split(/[\\/]/).pop()}: ${f.error ?? 'unknown error'}`)
        throw new Error(lines.join('\n'))
      }

      setShowMoveModal(false)
    },
    [selectedPaths]
  )

  // ─── Context value ─────────────────────────────────────────────────────────

  const value: AppContextValue = {
    currentFolder,
    photos,
    selectedPaths,
    activePhoto,
    photoData,
    exifCache,
    allTags,
    filterTags,
    tagGroups,
    activeGroupId,
    showTagGroupModal,
    editingGroup,
    sortBy,
    sortDir,
    viewMode,
    isLoading,
    showMoveModal,
    showRenameModal,
    isCopyMode,
    platform,
    filteredPhotos,
    tagColorMap,
    openFolder,
    navigateToFolder,
    selectPhoto,
    selectAll,
    deselectAll,
    setActivePhoto,
    loadExif,
    updatePhotoData,
    toggleFilterTag,
    setActiveGroupId,
    saveTagGroups,
    setShowTagGroupModal,
    setEditingGroup,
    renameFiles,
    moveFiles,
    refreshFolder,
    setSortBy,
    setSortDir,
    setViewMode,
    setShowMoveModal,
    setShowRenameModal,
    setIsCopyMode
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
