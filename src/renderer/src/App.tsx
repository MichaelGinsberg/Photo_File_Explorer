import React from 'react'
import { AppProvider, useApp } from './context/AppContext'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import PhotoGrid from './components/PhotoGrid'
import MetadataPanel from './components/MetadataPanel'
import MoveModal from './components/MoveModal'
import RenameModal from './components/RenameModal'

function StatusBar() {
  const { filteredPhotos, selectedPaths, photos, filterTags } = useApp()
  const filtered = filterTags.length > 0

  return (
    <div className="status-bar">
      <span className="status-bar-item">
        {filtered
          ? `${filteredPhotos.length} of ${photos.length} photos`
          : `${photos.length} photo${photos.length !== 1 ? 's' : ''}`}
      </span>
      {selectedPaths.size > 0 && (
        <span className="status-bar-item status-bar-item--accent">
          {selectedPaths.size} selected
        </span>
      )}
      {filtered && (
        <span className="status-bar-item">
          Filtered by: {filterTags.join(', ')}
        </span>
      )}
    </div>
  )
}

function AppInner() {
  const { showMoveModal, showRenameModal, activePhoto } = useApp()

  return (
    <div className="app-container">
      <TitleBar />
      <Toolbar />

      <div className="main-layout">
        <Sidebar />

        <div className="content-area">
          <div className="content-scroll">
            <PhotoGrid />
          </div>
          <StatusBar />
        </div>

        {activePhoto && <MetadataPanel />}
      </div>

      {showMoveModal && <MoveModal />}
      {showRenameModal && <RenameModal />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
