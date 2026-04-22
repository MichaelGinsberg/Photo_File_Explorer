import React from 'react'
import { useApp } from '../context/AppContext'
import appIconUrl from '../assets/app-icon.svg?url'

export default function TitleBar() {
  const { platform } = useApp()
  const isWindows = platform === 'win32'

  return (
    <div
      className="title-bar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: App icon + title */}
      <div className="title-bar-left">
        <img src={appIconUrl} className="title-bar-icon" alt="" />
        <span className="title-bar-title">Photo File Explorer</span>
      </div>

      {/* Right: Window controls (Windows only) */}
      {isWindows && (
        <div
          className="title-bar-controls"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            className="title-bar-btn"
            onClick={() => window.api.minimize()}
            title="Minimize"
            aria-label="Minimize"
          >
            ─
          </button>
          <button
            className="title-bar-btn"
            onClick={() => window.api.maximize()}
            title="Maximize"
            aria-label="Maximize"
          >
            □
          </button>
          <button
            className="title-bar-btn title-bar-btn--close"
            onClick={() => window.api.close()}
            title="Close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
