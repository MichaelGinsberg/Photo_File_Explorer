import type { Photo, PhotoData, ExifData } from './types'

interface ApiResponse<T = undefined> {
  success: boolean
  error?: string
  data?: T
}

interface FileOpResult {
  path: string
  success: boolean
  error?: string
  newPath?: string
}

declare global {
  interface Window {
    api: {
      // Window controls
      minimize(): void
      maximize(): void
      close(): void
      getPlatform(): Promise<string>

      // Dialog
      openFolder(): Promise<ApiResponse<string | null>>

      // File system
      readDirectory(dirPath: string): Promise<ApiResponse<Photo[]>>
      getExifData(filePath: string): Promise<ApiResponse<ExifData>>
      renameFile(oldPath: string, newPath: string): Promise<ApiResponse<string>>
      moveFiles(filePaths: string[], destDir: string): Promise<ApiResponse<FileOpResult[]>>
      copyFiles(filePaths: string[], destDir: string): Promise<ApiResponse<FileOpResult[]>>
      createDirectory(dirPath: string): Promise<ApiResponse<string>>
      browseDestination(): Promise<ApiResponse<string | null>>

      // Store
      getPhotoData(filePath: string): Promise<ApiResponse<PhotoData>>
      setPhotoData(filePath: string, data: PhotoData): Promise<ApiResponse<undefined>>
      getAllTags(): Promise<ApiResponse<{ name: string; count: number }[]>>
      getAllPhotoData(): Promise<ApiResponse<Record<string, PhotoData>>>
      renamePhotoPath(oldPath: string, newPath: string): Promise<ApiResponse<undefined>>
      getLastFolder(): Promise<ApiResponse<string | null>>

      // Shell
      openExternal(url: string): Promise<ApiResponse<undefined>>
    }
  }
}

export {}
