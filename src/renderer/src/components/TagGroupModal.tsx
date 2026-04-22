import React, { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import type { TagGroup } from '../types'
import { GROUP_COLORS, DEFAULT_TAG_COLOR, hexToRgba } from '../tagColors'

export default function TagGroupModal() {
  const {
    tagGroups, allTags, editingGroup, activeGroupId,
    saveTagGroups, setShowTagGroupModal, setEditingGroup, setActiveGroupId
  } = useApp()

  const isEdit = editingGroup !== null
  const [name, setName] = useState(editingGroup?.name ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>(editingGroup?.tags ?? [])
  const [nameError, setNameError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setName(editingGroup?.name ?? '')
    setSelectedTags(editingGroup?.tags ?? [])
    setNameError('')
    setConfirmDelete(false)
  }, [editingGroup])

  // Color this group will use: existing color (edit), or the first palette color not
  // already used by another group (create). Falls back to cycling if all colors are taken.
  const thisColor = useMemo(() => {
    if (isEdit) return editingGroup!.color || DEFAULT_TAG_COLOR
    const usedColors = new Set(tagGroups.map(g => g.color))
    return GROUP_COLORS.find(c => !usedColors.has(c)) ?? GROUP_COLORS[tagGroups.length % GROUP_COLORS.length]
  }, [isEdit, editingGroup, tagGroups])

  // Map each tag to whichever OTHER group currently owns it (for picker hints)
  const otherGroupByTag = useMemo(() => {
    const map: Record<string, TagGroup> = {}
    for (const group of tagGroups) {
      if (group.id === editingGroup?.id) continue
      for (const tag of group.tags) {
        if (!map[tag]) map[tag] = group
      }
    }
    return map
  }, [tagGroups, editingGroup])

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setNameError('Name is required'); return }
    const nameLower = trimmed.toLowerCase()
    if (tagGroups.some(g => g.name.toLowerCase() === nameLower && g.id !== editingGroup?.id)) {
      setNameError('A group with this name already exists'); return
    }
    const group: TagGroup = {
      id: editingGroup?.id ?? `group_${Date.now()}`,
      name: trimmed,
      tags: selectedTags,
      color: thisColor
    }
    const newList = isEdit
      ? tagGroups.map(g => g.id === group.id ? group : g)
      : [...tagGroups, group]
    await saveTagGroups(newList)
    setShowTagGroupModal(false)
    setEditingGroup(null)
  }

  const handleDelete = async () => {
    if (!editingGroup) return
    const newList = tagGroups.filter(g => g.id !== editingGroup.id)
    await saveTagGroups(newList)
    if (activeGroupId === editingGroup.id) setActiveGroupId(null)
    setShowTagGroupModal(false)
    setEditingGroup(null)
  }

  const handleClose = () => {
    setShowTagGroupModal(false)
    setEditingGroup(null)
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="modal-dialog">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="tg-color-swatch"
              style={{ background: thisColor }}
            />
            <span className="modal-title">{isEdit ? 'Edit Tag Group' : 'New Tag Group'}</span>
          </div>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input
              className={`input${nameError ? ' input--error' : ''}`}
              type="text"
              placeholder="e.g. Summer Trips"
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              autoFocus
            />
            {nameError && <div className="form-error">{nameError}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">
              Tags in this group
              <span className="tg-tag-hint"> — a photo needs any one to match</span>
            </label>

            {allTags.length === 0 ? (
              <div className="tg-no-tags">No tags exist yet. Add tags to photos first.</div>
            ) : (
              <div className="tg-tag-picker">
                {allTags.map(t => {
                  const active = selectedTags.includes(t.name)
                  const other = otherGroupByTag[t.name]
                  const chipColor = active ? thisColor : (other ? other.color : null)
                  const style: React.CSSProperties = chipColor ? {
                    borderColor: chipColor,
                    borderStyle: active ? 'solid' : 'dashed',
                    background: active ? hexToRgba(chipColor, 0.15) : 'transparent',
                    color: active ? chipColor : hexToRgba(chipColor, 0.75)
                  } : {}
                  return (
                    <button
                      key={t.name}
                      className={`tg-tag-chip${active ? ' tg-tag-chip--active' : ''}`}
                      style={style}
                      onClick={() => toggleTag(t.name)}
                      title={other ? `Also in "${other.name}"` : undefined}
                    >
                      {t.name}
                      {active && <span className="tg-tag-chip-check" style={{ color: thisColor }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {selectedTags.length > 0 && (
              <div className="tg-selected-count" style={{ color: thisColor }}>
                {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          {confirmDelete && (
            <div className="tg-confirm-delete">
              <span>Delete "{editingGroup?.name}"? This cannot be undone.</span>
              <div className="tg-confirm-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-sm btn-danger" onClick={handleDelete}>Delete</button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isEdit && !confirmDelete && (
            <button className="btn btn-sm btn-danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDelete(true)}>
              Delete Group
            </button>
          )}
          <button className="btn btn-sm btn-secondary" onClick={handleClose}>Cancel</button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            disabled={!name.trim() || selectedTags.length === 0}
          >
            {isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
