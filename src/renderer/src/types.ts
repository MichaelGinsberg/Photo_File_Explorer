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
  date: string        // YYYY-MM-DD, user-set "date taken"
  location: string    // freeform location text
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
  dateISO?: string    // YYYY-MM-DD for date input pre-fill
  // GPS
  latitude?: number
  longitude?: number
  // Image
  width?: number
  height?: number
  colorSpace?: string
}

export type SortField = 'name' | 'date' | 'size' | 'dateTaken' | 'location'
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
