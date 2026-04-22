export interface Photo {
  path: string
  name: string
  size: number        // bytes
  modified: number    // timestamp ms
  extension: string
}

export interface PhotoData {
  tags: string[]
  rating: number      // 0-5
  description: string
  notes: string
}

export interface ExifData {
  // Camera
  make?: string
  model?: string
  lensModel?: string
  // Settings
  exposureTime?: number
  fNumber?: number
  iso?: number
  focalLength?: number
  // Date
  dateTimeOriginal?: string
  // GPS
  latitude?: number
  longitude?: number
  // Image
  width?: number
  height?: number
  colorSpace?: string
}

export type SortField = 'name' | 'date' | 'size'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list'

export interface ApiResponse<T = undefined> {
  success: boolean
  error?: string
  data?: T
}

export interface TagInfo {
  name: string
  count: number
}

export interface RenameEntry {
  path: string
  newName: string
}
