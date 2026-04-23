# Photo File Explorer

A cross-platform desktop application for browsing, tagging, and organizing photo libraries. Built with Electron, React, and TypeScript, themed with the [Nord](https://www.nordtheme.com/) color palette.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Electron](https://img.shields.io/badge/Electron-31-47848f)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

---

<br>

![Features](docs/section-features.svg)

| Feature | Details |
|---|---|
| **Photo browsing** | Open any local folder and view photos as a thumbnail grid or list; active folder shown in the sidebar with one-click re-open |
| **Lazy loading** | IntersectionObserver-based loading — only visible images are fetched |
| **EXIF display** | Camera make/model/lens, exposure settings, GPS with Maps link, date taken — auto-loaded when a photo is selected |
| **Ratings & notes** | 5-star rating, description, and freeform notes per photo |
| **Date Taken** | User-editable date field (YYYY-MM-DD) per photo; one-click fill from EXIF date when available; used as a sort key |
| **Location** | Freeform location text per photo (e.g. "Paris, France"); GPS coordinates shown inline with a Maps link when EXIF data is present; used as a sort key |
| **Multi-selection** | Click, Ctrl+Click, Shift+Click (range), Ctrl+A (all), Escape (clear) |
| **Sort & filter** | Sort by name, date modified, date taken, file size, or location; filter by one or more tags |
| **Move & copy** | Move or copy selected photos to any folder, with optional new subfolder creation |
| **Drag & drop** | Drag photo files from Windows Explorer or Finder directly onto the photo grid to copy them into the current folder; a visual overlay confirms the drop target and a toast reports the result |
| **Nord theme** | Full Nord dark palette throughout the UI |
| **Native window** | Custom frameless title bar on Windows; native traffic lights on macOS |

<br>

![RAW Support](docs/section-raw.svg)

RAW files are fully supported for tagging, rating, notes, EXIF display, rename, and move/copy. Thumbnails and previews show a camera-icon placeholder since Chromium cannot decode proprietary RAW formats natively.

| Category | Extensions |
|---|---|
| Standard | JPG · JPEG · PNG · GIF · WEBP · TIFF · TIF · BMP · HEIC |
| Fujifilm RAW | RAF |
| Canon RAW | CR2 · CR3 |
| Nikon RAW | NEF · NRW |
| Sony RAW | ARW · SRF · SR2 |
| Olympus / OM System RAW | ORF |
| Panasonic RAW | RW2 |
| Leica RAW | RWL · RAW |
| Adobe / Pentax / Ricoh | DNG · PEF |
| Sigma RAW | X3F |
| Hasselblad RAW | 3FR |
| Minolta / Konica-Minolta RAW | MRW |
| Kodak RAW | KDC · DCR |
| Mamiya / Phase One RAW | MEF · IIQ |
| Epson RAW | ERF |

<br>

![Tags & Groups](docs/section-tags.svg)

- **Custom tags** — Add, remove, and filter by tags; persisted across sessions via `electron-store`
- **Tag autocomplete** — Typing in the tag field shows a live-filtered dropdown of existing tags with usage counts; navigate with arrow keys, confirm with Enter
- **AI tag suggestions** — When a photo is selected, a local MobileNet-v2 model classifies the image and suggests up to 8 tags, blending ML-detected labels with tags from visually similar already-tagged photos; runs entirely on-device via ONNX Runtime WASM — no data leaves the machine; model (~14 MB) is downloaded once on first use and cached permanently
- **Tag groups** — Create named groups that bundle multiple tags together; clicking a group in the sidebar filters the grid to photos that have any one of the group's tags (OR logic); groups are created and edited via a modal with a tag picker; group match counts update live
- **Tag colors** — Each group gets a unique accent color from the Nord palette, shown as dots and chip borders throughout the UI

<br>

![Bulk Rename](docs/section-rename.svg)

Single rename or batch rename with pattern variables:

| Variable | Description | Example |
|---|---|---|
| `{name}` | Original filename without extension | `IMG_0042` |
| `{counter:3}` | Zero-padded sequence number (digit count configurable) | `001`, `042` |
| `{date:YYYY-MM-DD}` | Date taken from stored metadata | `2024-06-15` |

A live preview updates as you type the pattern, showing the before/after filename for every selected photo.

<br>

---

<br>

![Getting Started](docs/section-getting-started.svg)

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later

<br>

![Install](docs/section-install.svg)

```bash
# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev
```

<br>

![Build from Source](docs/section-build.svg)

```bash
# Windows — produces NSIS installer + portable .exe in release/
npm run build:win

# macOS — produces .dmg + .zip in release/
npm run build:mac

# Both platforms (requires cross-platform build environment)
npm run build
```

### Windows Build Troubleshooting

**Error: `Cannot create symbolic link : A required privilege is not held by the client`**

`electron-builder` downloads `winCodeSign-2.6.0.7z` when packaging for Windows. That archive contains macOS OpenSSL symlinks (`libcrypto.dylib`, `libssl.dylib`) that Windows cannot extract without Developer Mode or administrator privileges. The extraction fails with exit code 2 and electron-builder retries four times before aborting — even though all the actual Windows tools inside the archive extracted successfully.

**Fix — pre-populate the cache once, then builds work permanently:**

Run this in PowerShell from the project root:

```powershell
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
$targetDir = "$cacheDir\winCodeSign-2.6.0"
$7za = ".\node_modules\7zip-bin\win\x64\7za.exe"
$tempArchive = "$cacheDir\winCodeSign-setup.7z"

New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
Invoke-WebRequest -Uri "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z" -OutFile $tempArchive -UseBasicParsing
Start-Process -FilePath $7za -ArgumentList "x -bd `"$tempArchive`" `"-o$targetDir`" -y" -PassThru -Wait -NoNewWindow | Out-Null

# Create placeholder files for the two macOS symlinks that Windows can't extract
foreach ($f in @("$targetDir\darwin\10.12\lib\libcrypto.dylib", "$targetDir\darwin\10.12\lib\libssl.dylib")) {
    if (-not (Test-Path $f)) { New-Item -Path $f -ItemType File -Force | Out-Null }
}
Remove-Item $tempArchive -Force
```

After running this once, `npm run build:win` finds the pre-populated cache and skips the download/extraction on every subsequent build.

### macOS Build Notes

`npm run build:mac` must be run on macOS — electron-builder rejects it immediately on Windows before downloading anything, so the symlink issue above does not apply. On macOS without an Apple Developer ID certificate, the build will fail at the code-signing step unless signing is disabled. Both the `build:mac` script and the `mac` build config already include `CSC_IDENTITY_AUTO_DISCOVERY=false` / `"sign": null` to skip signing for development builds.

<br>

---

<br>

![Usage](docs/section-usage.svg)

1. **Open a folder** — Click the folder button in the sidebar (or the toolbar) and choose a directory. All supported photo files in that folder are loaded immediately.
2. **Browse** — Switch between grid and list view with the toolbar toggle. Click any photo to open its metadata panel on the right.
3. **Add tags** — Type in the tag field and press Enter (or click **Add**). Existing tags appear in an autocomplete dropdown. AI-suggested tags appear as chips above the input — click one to apply it instantly.
4. **Filter** — Click any tag in the left sidebar to filter the grid. Hold Ctrl and click multiple tags for AND filtering. Click a tag group to filter by all tags in that group (OR logic).
5. **Select & organize** — Use Click, Ctrl+Click, or Shift+Click to select photos. Use the toolbar to rename, move, or copy the selection. Drag files from Explorer/Finder directly onto the grid to copy them in.
6. **Sort** — Use the sort dropdown in the toolbar to sort by name, date modified, date taken, size, or location.

<br>

---

<br>

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
├── docs/                           # README section header SVGs
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

### Key Architecture Decisions

- **`localfile://` custom protocol** — Photos are served through a sandboxed protocol handler instead of `file://`, preventing the renderer from accessing arbitrary filesystem paths.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** — Standard Electron security hardening; the renderer has zero Node.js access.
- **`electron-store`** — Tags, ratings, descriptions, and notes are stored in a per-user JSON database (no EXIF writing, no sidecar files).
- **Ref-based stable callbacks** — `exifCacheRef`, `photoDataRef`, and `filteredPhotosRef` mirror their state counterparts so `loadExif`, `updatePhotoData`, `selectPhoto`, and `selectAll` maintain stable identities across renders, keeping `React.memo` on `PhotoItem` effective.

<br>

---

<br>

## Security & Bug Fix Log

All issues found during internal security reviews and build testing are documented here.

| Severity | Area | Issue | Fix |
|---|---|---|---|
| High | Security | `sandbox: false` in BrowserWindow — disabled process sandbox for no reason | Changed to `sandbox: true` |
| High | Security | `window.open()` used for GPS Maps link — opened a new Electron window instead of the system browser | Replaced with `shell.openExternal` via IPC (`shell:openExternal` handler) |
| Security | Protocol | `..` / `.` URL path segments bypassed the extension guard — `localfile:///C%3A/Users/%2E%2E/secret.jpg` could traverse to any `.jpg` outside the photo folder | Reject any decoded path component equal to `..`, `.`, or containing a null byte, before path construction |
| Security | File system | `fs.stat` follows symlinks — a symlink pointing to a file with a photo extension elsewhere on the system would be listed and served | Changed to `fs.lstat`; symlinks return `isSymbolicLink()`, not `isFile()`, so they are skipped |
| Security | IPC | `shell:openExternal` URL validation used `startsWith('https://')` — a malformed string can start with `https://` while not being a valid URL | Replaced with `new URL(url)` parser; invalid URLs throw and are rejected |
| Security | Input | New subfolder name in MoveModal was not validated — entering `../evil` would create a directory outside the chosen destination | Added guard rejecting names containing `/`, `\`, or equal to `..` / `.` |
| Data loss | Bug | `fs:renameFile` had no destination-exists check — same overwrite risk that was fixed for move/copy | Added `destExists()` guard matching the move/copy pattern |
| Data loss | Bug | Move and copy silently overwrote existing files at the destination | Added `destExists()` check before every move/copy; returns an error if destination file already exists |
| Data loss | Bug | Cross-device move: if `copyFile` succeeded but source `unlink` failed, the cleanup code called `unlink(destPath)` — deleting the file that was just successfully copied | Added `fileCopied` flag; cleanup only runs when `copyFile` itself failed |
| Runtime crash | Bug | `exifCacheRef.current = exifCache` appeared on line 85, but `exifCacheRef` was declared on line 100 — temporal dead zone | Moved both `useRef` declarations above all `useState` calls |
| Runtime crash | Bug | `openFolder`'s dep array `[loadFolder]` evaluated `loadFolder` before it was declared (`const` TDZ) | Moved `loadFolder` definition above `openFolder` |
| Type error | Bug | Two EXIF error-path returns still included `{ raw: {} }` after the `raw` field was removed from `ExifData` | Replaced with `{}` |
| Bug | React | `updatePhotoData` listed `photoData` as a dep — recreated on every photo data change, causing MetadataPanel to re-render on every tag/rating/note save | Added `photoDataRef`; removed `photoData` from deps |
| Bug | React | MetadataPanel sync effect had `data` in its dep array — updating tags or rating fired the effect and reset unsaved description/notes textarea content | Removed `data` from deps; effect now only fires when `photo?.path` changes |
| Bug | Logic | `applyBulkPattern` used `d.replace(token, value)` — only replaces the first match; a format like `MM-DD-MM` would leave the second `MM` unreplaced | Changed all six token replacements to `replaceAll` |
| Bug | React | `openFolder` had an empty `[]` dep array but called `loadFolder` — missing dependency | Added `[loadFolder]` to the dep array |
| Build failure | Toolchain | `winCodeSign-2.6.0.7z` contains macOS OpenSSL symlinks (`libcrypto.dylib`, `libssl.dylib`) that Windows cannot extract without Developer Mode or admin privileges — 7-Zip exits with code 2 and `electron-builder` aborts after four retries | Pre-populate the cache at `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\` by extracting the archive once (ignoring the symlink errors) and creating empty placeholder files for the two missing symlinks; subsequent builds find the cache directory and skip the download entirely. `build:win` script updated to pass `CSC_IDENTITY_AUTO_DISCOVERY=false` via `cross-env` |
| Build failure | Toolchain | `build:mac` without an Apple Developer ID certificate fails at the code-signing step because `CSC_IDENTITY_AUTO_DISCOVERY=true` by default causes electron-builder to require a signing identity | Added `CSC_IDENTITY_AUTO_DISCOVERY=false` via `cross-env` to `build:mac` and `"sign": null` to the mac build config, matching the treatment applied to `build:win` |
| Performance | React | `loadExif` listed `exifCache` as a `useCallback` dependency — new reference on every EXIF load triggered cascading re-renders | Introduced `exifCacheRef` (mirrors state); `loadExif` now has an empty dep array and reads via the ref |
| Performance | IPC | Full raw EXIF object (~100+ fields) was serialised and sent over IPC on every panel open but never rendered | Removed `raw` from the IPC response, the `ExifData` type, and the preload interface |
| Performance | Main process | EXIF parsing had no timeout — a malformed image could hang the main process indefinitely | Wrapped `exifr.parse` in `Promise.race` with an 8-second timeout |
| Bug | Protocol | `net.fetch('file://...')` responses carry no `Access-Control-Allow-Origin` header — Chromium's CORS check on the `localfile:` response rejected every image, firing `onError` on all `<img>` tags and showing ⚠ for all thumbnails and previews | Replaced `net.fetch` + `pathToFileURL` with `fs.promises.readFile`; response now includes explicit `Content-Type`, `Access-Control-Allow-Origin: *`, and `Cache-Control` headers |
| Bug | Protocol | Windows drive letter `C:` encoded as a path segment (`localfile:///C%3A/Users/...`) was silently mis-parsed by Chromium's `standard`-scheme URL normaliser, causing the protocol handler to reconstruct the wrong path and return 404 for every image | Changed URL format to a query parameter — `localfile:///?p=<encodeURIComponent(path)>` — eliminating all path-segment parsing; `URLSearchParams.get('p')` already decodes the value so no manual reconstruction is needed |
| Bug | Protocol | Electron docs state that `standard`-scheme URLs with no host component are treated as "file-like URLs", bypassing `corsEnabled`/`secure` privileges — `localfile:///?p=...` (empty host) caused all `<img>` loads to silently fail | Changed URL format to include an explicit host: `localfile://localhost/?p=<encodeURIComponent(path)>`; host presence is required for the scheme's registered privileges to apply |
| Hardening | DX | No way to inspect the renderer console or network requests in the production build, making protocol errors invisible | Added Ctrl+Shift+I / F12 keyboard shortcut to toggle DevTools in production |
| Security | Protocol | Protocol handler checked `normalised.includes('..')` after `path.normalize()` — but `normalize` already resolves all `..` segments, so the check never fires on traversal attempts; it only falsely rejected legitimate paths with `..` in directory names (e.g. `my..folder`) | Replaced with `!path.isAbsolute(normalised)`: the invariant that matters is that the path is absolute, not that it lacks dots |
| Security | Input | MoveModal subfolder validation only rejected `/`, `\`, `..`, and `.` — Windows-reserved characters (`* ? " < > | :`) and null bytes were accepted, allowing folder names that the OS would refuse or misinterpret | Extended regex to `/[/\\*?"<>|:\x00]/` plus a dot-only check, covering the full set of illegal characters on both Windows and Unix |
| Data loss | Bug | Renaming a file updated React state but never migrated the metadata record in `electron-store` — after an app restart the renamed file had no tags, rating, notes, date, or location | Added `store:renamePhotoPath` IPC handler that moves the store record from the old path key to the new one; `renameFiles` in AppContext calls it for every successful rename |
| Data loss | Bug | Moving a file updated React state to remove the photo from the current view but left its metadata stored under the old path — opening the destination folder showed the file with no metadata | `moveFiles` in AppContext now calls `store:renamePhotoPath` for every successfully moved file so metadata follows the file to its new location |
| Bug | Logic | Tag input only lowercased user input — control characters, embedded newlines, and multi-space sequences were stored verbatim, corrupting the tag index | Added sanitisation: control characters (`\x00–\x1f`, `\x7f`) are stripped and internal whitespace is collapsed to a single space before the tag is saved |
| Bug | React | RenameModal bulk preview list used array index as React key (`key={i}`) — when the pattern changed and items reordered, React reused the wrong DOM nodes | Changed to `key={p.original}` (the source filename), which is stable and unique within the preview list |
| Bug | Logic | `navigateToFolder` (sidebar subdirectory click) cleared tag and selection filters but left the active tag-group filter set — the new folder appeared pre-filtered by the previous group | Added `setActiveGroupId(null)` to `navigateToFolder` alongside the existing filter resets |
| Security | IPC | `store:setPhotoData` accepted any renderer-supplied value without validation — a compromised renderer could write arbitrary objects as photo data (e.g. inject control characters, set rating to NaN, overflow string fields) | Added runtime guards: `filePath` must be an absolute path; `tags` must be a string array (each ≤ 200 chars); `rating` must be an integer 0–5; `description`/`notes` ≤ 10 000 chars; `date` ≤ 20 chars; `location` ≤ 500 chars |
| Security | IPC | `fs:renameFile` accepted any two renderer-supplied paths without validation — a compromised renderer could rename files across directories (e.g. move `~/.ssh/id_rsa` into the photo folder) | Added guards: both paths must be absolute; `path.dirname(oldPath)` must equal `path.dirname(newPath)`, preventing cross-directory moves |
| Security | IPC | `store:renamePhotoPath` and `store:setLastFolder` accepted non-absolute paths from the renderer — a compromised renderer could corrupt the store with relative or empty keys | Added `path.isAbsolute()` guard to both handlers; invalid paths return an error without touching the store |
| Security | Protocol | Protocol handler called `fs.promises.readFile` with no preceding size check — a very large RAW file (some are > 100 MB) could be read entirely into memory, causing an out-of-memory crash in the main process | Added `lstat` before `readFile`; files larger than 200 MB (configurable constant) return HTTP 413; `lstat` also confirms the entry is a regular file, defending against race conditions where a symlink is created after the extension check |
| Bug | Logic | `handleDrop` in App.tsx had no error handling — if `window.api.copyFiles` or `refreshFolder` threw an unhandled rejection, the drop overlay would be hidden but no feedback was shown to the user | Wrapped the drop body in `try/catch`; exceptions now show a "Drop failed" toast |
| Bug | Logic | Tag-group color was assigned as `GROUP_COLORS[tagGroups.length % N]` — if a group was deleted and a new one created, the new group could receive the same color as an existing group | Changed to find the first palette color not already in use by any existing group; only falls back to cycling when all palette slots are taken |
| Security | IPC | `fs:readDirectory` and `fs:getExifData` accepted any renderer-supplied path without validation — a compromised renderer could enumerate arbitrary directories or read EXIF from non-photo files anywhere on disk | Added `path.isAbsolute()` guard to both handlers; `fs:getExifData` also checks the extension against the photo whitelist |
| Security | IPC | `fs:createDirectory` accepted any renderer-supplied path without validation — a null byte or relative path could be passed to `mkdir` | Added `path.isAbsolute()` guard and null-byte check before calling `mkdir` |
| Security | IPC | `store:setTagGroups` stored the raw renderer payload without any structural validation — a compromised renderer could inject arbitrary objects, corrupt the store, or bypass type contracts | Added full array validation: each group must have a `group_\d+` id, a non-empty name (≤ 100 chars), a string array of tags (each ≤ 200 chars, max 500 per group), and a 6-digit hex color |
| Bug | React | AI tag suggestion used a shared `cancelSuggRef` ref to guard against stale results — but the ref was reset to `false` at the start of each new photo's effect, so a slow in-flight request for the previous photo could complete after the reset and overwrite the new photo's suggestions | Replaced the shared ref with a closure-local `cancelled` flag; each effect closure owns its own flag so the race cannot occur |
| Bug | Data | `Promise.all` was used to migrate file metadata after a batch move — if one `renamePhotoPath` call failed, the rejection aborted all remaining migrations, leaving the rest of the moved files with no metadata | Changed to `Promise.allSettled` so each migration is attempted independently |
| Bug | Logic | `handleAddTag` in MetadataPanel normalised tags but did not enforce the 200-character limit that the main process validates — pasting a very long string would be silently rejected by the IPC handler with no renderer-side feedback | Added `tag.length > 200` guard in `handleAddTag` to match the main-process constraint |
| Bug | UI | `StatusBar` computed `filtered = filterTags.length > 0` — when only a tag group was active (`activeGroupId !== null`), the count still showed total photos and the "Group: …" context was absent | Extended the `filtered` condition to `filterTags.length > 0 \|\| activeGroupId !== null`; added a "Group: \<name\>" label when a group filter is active |
| Bug | Security | CSP `connect-src` directive listed `'self' https:` but omitted `localfile:` — `@xenova/transformers` uses `fetch()` to load image pixel data before classifying it, so every classification request against a `localfile://` URL was silently blocked by the browser security policy, leaving `detectedLabels` empty and producing no AI tag suggestions | Added `localfile:` to `connect-src` in `src/renderer/index.html` |
| Bug | Crash | `errMsg()` helper introduced to safely extract a message from `unknown` catch values contained a typo — the Error branch called `errMsg(err)` recursively instead of `err.message`, causing infinite recursion and a stack-overflow crash on every caught exception in the main process | Changed the Error branch to return `err.message` |
| Security | IPC | `fs:readSubdirectories` accepted any renderer-supplied path without validation — unlike every other file-system handler, it had no `path.isAbsolute()` guard, allowing a compromised renderer to enumerate directories anywhere on the host filesystem | Added `typeof dirPath !== 'string' \|\| !path.isAbsolute(dirPath)` guard; invalid paths return an error without touching the filesystem |
| Bug | Race | `loadFolder` had no generation guard — if the user navigated to folder B while folder A's IPC responses were still in-flight, folder A's results could resolve later and overwrite the folder B photos/metadata, leaving the UI showing the wrong folder's content | Added `folderLoadGenRef` (incremented on each call); results are discarded and `isLoading` is not cleared if a newer navigation has started |
| Bug | Data | `updatePhotoData` applied an optimistic state update before the IPC call — if `setPhotoData` failed (e.g., validation error or store write failure), the UI showed the new value while the persisted store retained the old one, causing the UI and disk to silently diverge | Added a revert: `setPhotoData((prev) => ({ ...prev, [filePath]: current }))` in the catch block |

<br>

---

<br>

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

<br>

---

<br>

![Contributing](docs/section-contributing.svg)

1. Fork the repository and create a feature branch
2. Run `npm run dev` to start the dev server with hot reload
3. Make your changes — keep PRs focused on a single concern
4. Run `npx tsc --noEmit` to confirm there are no type errors before opening a PR

<br>

![Support](docs/section-support.svg)

Found a bug or have a feature request? Please open an issue on GitHub with:
- A clear description of the problem or request
- Steps to reproduce (for bugs)
- Your OS, Node.js version, and whether you are running `npm run dev` or a built package

<br>

![License](docs/section-license.svg)

MIT
