# Photo File Explorer

A cross-platform desktop application for browsing, tagging, and organizing photo libraries. Built with Electron, React, and TypeScript, themed with the [Nord](https://www.nordtheme.com/) color palette.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848f)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

---

## Features

| Feature | Details |
|---|---|
| **Photo browsing** | Open any local folder and view photos as a thumbnail grid or list |
| **Lazy loading** | IntersectionObserver-based loading — only visible images are fetched |
| **EXIF display** | Camera make/model/lens, exposure settings, GPS with Maps link, date taken |
| **Custom tags** | Add, remove, and filter by tags; persisted across sessions |
| **Ratings & notes** | 5-star rating, description, and freeform notes per photo |
| **Multi-selection** | Click, Ctrl+Click, Shift+Click (range), Ctrl+A (all), Escape (clear) |
| **Sort & filter** | Sort by name, date modified, or file size; filter by one or more tags |
| **Rename** | Single rename or bulk rename with pattern variables (`{name}`, `{counter:3}`, `{date:YYYY-MM-DD}`) |
| **Move & copy** | Move or copy selected photos to any folder, with optional new subfolder creation |
| **Nord theme** | Full Nord dark palette throughout the UI |
| **Native window** | Custom frameless title bar on Windows; native traffic lights on macOS |

**Supported formats:** JPG · JPEG · PNG · GIF · WEBP · TIFF · TIF · BMP · HEIC

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later

### Install & Run

```bash
# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev
```

### Build Distributables

```bash
# Windows — produces NSIS installer + portable .exe in release/
npm run build:win

# macOS — produces .dmg + .zip in release/
npm run build:mac

# Both platforms (requires cross-platform build environment)
npm run build
```

---

## Project Structure

```
Photo_File_Explorer/
├── src/
│   ├── main/
│   │   └── index.ts          # Electron main process — IPC, file ops, protocol
│   ├── preload/
│   │   └── index.ts          # contextBridge API exposed to renderer
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── types.ts
│           ├── electron.d.ts  # window.api type declarations
│           ├── context/
│           │   └── AppContext.tsx   # Global state (photos, selection, tags, sort)
│           ├── components/
│           │   ├── TitleBar.tsx
│           │   ├── Toolbar.tsx
│           │   ├── Sidebar.tsx
│           │   ├── PhotoGrid.tsx
│           │   ├── PhotoItem.tsx
│           │   ├── MetadataPanel.tsx
│           │   ├── MoveModal.tsx
│           │   └── RenameModal.tsx
│           └── styles/
│               └── index.css       # Nord theme + all component styles
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

### Key Architecture Decisions

- **`localfile://` custom protocol** — Photos are served through a sandboxed protocol handler instead of `file://`, preventing the renderer from accessing arbitrary filesystem paths.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** — Standard Electron security hardening; the renderer has zero Node.js access.
- **`electron-store`** — Tags, ratings, descriptions, and notes are stored in a per-user JSON database (no EXIF writing, no sidecar files).
- **Ref-based stable callbacks** — `exifCacheRef` and `photoDataRef` mirror their state counterparts so `loadExif` and `updatePhotoData` maintain stable identities across renders.

---

## Security & Bug Fix Log

All issues found during internal security reviews are documented here.

### Round 1

| Severity | Area | Issue | Fix |
|---|---|---|---|
| High | Security | `sandbox: false` in BrowserWindow — disabled process sandbox for no reason | Changed to `sandbox: true` |
| High | Security | `window.open()` used for GPS Maps link — opened a new Electron window instead of the system browser | Replaced with `shell.openExternal` via IPC (`shell:openExternal` handler) |
| Medium | Bug | Move and copy silently overwrote existing files at the destination | Added `destExists()` check before every move/copy; returns an error if destination file already exists |
| Medium | Performance | `loadExif` listed `exifCache` as a `useCallback` dependency — new reference on every EXIF load triggered cascading re-renders | Introduced `exifCacheRef` (mirrors state); `loadExif` now has an empty dep array and reads via the ref |
| Low | Bug | `openFolder` had an empty `[]` dep array but called `loadFolder` — missing dependency | Added `[loadFolder]` to the dep array |
| Low | Performance | Full raw EXIF object (~100+ fields) was serialised and sent over IPC on every panel open but never rendered | Removed `raw` from the IPC response, the `ExifData` type, and the preload interface |

### Round 2

| Severity | Area | Issue | Fix |
|---|---|---|---|
| Runtime crash | Bug | `exifCacheRef.current = exifCache` appeared on line 85, but `exifCacheRef` was declared on line 100 — temporal dead zone | Moved both `useRef` declarations above all `useState` calls |
| Runtime crash | Bug | `openFolder`'s dep array `[loadFolder]` evaluated `loadFolder` before it was declared (`const` TDZ) | Moved `loadFolder` definition above `openFolder` |
| Type error | Bug | Two EXIF error-path returns still included `{ raw: {} }` after the `raw` field was removed from `ExifData` | Replaced with `{}` |
| Data loss | Bug | `fs:renameFile` had no destination-exists check — same overwrite risk that was fixed for move/copy | Added `destExists()` guard matching the move/copy pattern |

### Round 3

| Severity | Area | Issue | Fix |
|---|---|---|---|
| Security | Protocol | `..` / `.` URL path segments bypassed the extension guard — `localfile:///C%3A/Users/%2E%2E/secret.jpg` could traverse to any `.jpg` outside the photo folder | Reject any decoded path component equal to `..`, `.`, or containing a null byte, before path construction |
| Security | File system | `fs.stat` follows symlinks — a symlink pointing to a file with a photo extension elsewhere on the system would be listed and served | Changed to `fs.lstat`; symlinks return `isSymbolicLink()`, not `isFile()`, so they are skipped |
| Security | IPC | `shell:openExternal` URL validation used `startsWith('https://')` — a malformed string can start with `https://` while not being a valid URL | Replaced with `new URL(url)` parser; invalid URLs throw and are rejected |
| Security | Input | New subfolder name in MoveModal was not validated — entering `../evil` would create a directory outside the chosen destination | Added guard rejecting names containing `/`, `\`, or equal to `..` / `.` |
| Bug | File ops | Cross-device move: if `copyFile` succeeded but source `unlink` failed, the cleanup code called `unlink(destPath)` — deleting the file that was just successfully copied | Added `fileCopied` flag; cleanup only runs when `copyFile` itself failed |
| Bug | React | `updatePhotoData` listed `photoData` as a dep — recreated on every photo data change, causing MetadataPanel to re-render on every tag/rating/note save | Added `photoDataRef`; removed `photoData` from deps |
| Bug | React | MetadataPanel sync effect had `data` in its dep array — updating tags or rating fired the effect and reset unsaved description/notes textarea content | Removed `data` from deps; effect now only fires when `photo?.path` changes |
| Bug | Logic | `applyBulkPattern` used `d.replace(token, value)` — only replaces the first match; a format like `MM-DD-MM` would leave the second `MM` unreplaced | Changed all six token replacements to `replaceAll` |
| Hardening | Performance | EXIF parsing had no timeout — a malformed image could hang the main process indefinitely | Wrapped `exifr.parse` in `Promise.race` with an 8-second timeout |

---

## Nord Theme Reference

The application uses the full [Nord](https://www.nordtheme.com/) palette via CSS custom properties.

| Variable | Hex | Usage |
|---|---|---|
| `--nord0` | `#2E3440` | Main background |
| `--nord1` | `#3B4252` | Sidebar, panels, toolbar |
| `--nord2` | `#434C5E` | Cards, inputs, secondary surfaces |
| `--nord3` | `#4C566A` | Borders, muted text |
| `--nord4` | `#D8DEE9` | Primary text |
| `--nord8` | `#88C0D0` | Primary accent, buttons, focus rings |
| `--nord9` | `#81A1C1` | Secondary accent |
| `--nord10` | `#5E81AC` | Selected state |
| `--nord11` | `#BF616A` | Destructive actions, close button |
| `--nord13` | `#EBCB8B` | Warnings |
| `--nord14` | `#A3BE8C` | Success states |
| `--nord15` | `#B48EAD` | Tags |

---

## License

MIT
