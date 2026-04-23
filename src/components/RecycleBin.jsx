import { useRef, useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'
import { Pagination } from './Pagination'
import { ThumbnailImage } from './ThumbnailImage'

function getImageSrc(path) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try {
    return convertFileSrc(path)
  } catch {
    return path
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

export function RecycleBin({
  theme,
  styles,
  t,
  screenshots,
  currentPage = 1,
  totalPages = 1,
  sortOrder = 'desc',
  onSortChange,
  onLoadPage,
  onRestore,
  onRestoreSelected,
  onPermanentDelete,
  onPermanentDeleteSelected,
  onEmptyAll,
  onNavigate,
}) {
  const scrollContainerRef = useRef(null)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [confirmAction, setConfirmAction] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])

  useEffect(() => {
    setSelectedIds([])
    setIsMultiSelectMode(false)
  }, [screenshots])

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleRestore = (id) => {
    onRestore && onRestore(id)
  }

  const handlePermanentDelete = (id) => {
    setConfirmAction({ type: 'permanent_delete', id })
  }

  const handleConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'permanent_delete') {
      onPermanentDelete && onPermanentDelete(confirmAction.id)
    } else if (confirmAction.type === 'empty_all') {
      onEmptyAll && onEmptyAll()
    } else if (confirmAction.type === 'permanent_delete_selected') {
      onPermanentDeleteSelected && onPermanentDeleteSelected(selectedIds)
    }
    setConfirmAction(null)
  }

  const handleEmptyAll = () => {
    setConfirmAction({ type: 'empty_all' })
  }

  return (
    <div style={{ 
      ...styles.container, 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      position: 'relative' 
    }}>
      <div style={{ 
        ...styles.header, 
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        background: theme.bg,
        zIndex: 10
      }}>
        <button 
          style={{ ...styles.btn, padding: '8px 12px' }} 
          {...btnEvents}
          onClick={() => onNavigate && onNavigate('time')}
          title={t.nav.time}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isMultiSelectMode ? (
            <>
              <button 
                style={{ ...styles.btn, color: theme.primary }} 
                {...btnEvents} 
                onClick={() => { setIsMultiSelectMode(false); setSelectedIds([]) }}
              >
                {t.recycle_bin.cancel_select}
              </button>
              <button 
                style={{ 
                  ...styles.btn, 
                  background: theme.primary, 
                  color: '#fff',
                  opacity: selectedIds.length === 0 ? 0.5 : 1
                }} 
                {...btnEvents} 
                onClick={() => selectedIds.length > 0 && onRestoreSelected && onRestoreSelected(selectedIds)}
                disabled={selectedIds.length === 0}
              >
                {t.recycle_bin.restore_selected} ({selectedIds.length})
              </button>
              <button 
                style={{ 
                  ...styles.btn, 
                  background: '#e74c3c', 
                  color: '#fff',
                  opacity: selectedIds.length === 0 ? 0.5 : 1
                }} 
                {...btnEvents} 
                onClick={() => selectedIds.length > 0 && setConfirmAction({ type: 'permanent_delete_selected' })}
                disabled={selectedIds.length === 0}
              >
                {t.recycle_bin.permanent_delete_selected} ({selectedIds.length})
              </button>
            </>
          ) : (
            <>
              <select 
                value={sortOrder}
                onChange={(e) => onSortChange && onSortChange(e.target.value)}
                style={{ 
                  padding: '8px 12px', 
                  background: theme.accent, 
                  border: 'none', 
                  borderRadius: 6, 
                  color: theme.text, 
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                <option value="desc">{t.recycle_bin.sort_deleted_desc}</option>
                <option value="asc">{t.recycle_bin.sort_deleted_asc}</option>
                <option value="original_desc">{t.recycle_bin.sort_original_desc}</option>
                <option value="original_asc">{t.recycle_bin.sort_original_asc}</option>
              </select>
              <button style={styles.btn} {...btnEvents} onClick={() => setIsMultiSelectMode(true)}>
                {t.recycle_bin.multi_select}
              </button>
              {screenshots && screenshots.length > 0 && (
                <button 
                  style={{ ...styles.btn, background: '#e74c3c', color: '#fff' }} 
                  {...btnEvents} 
                  onClick={handleEmptyAll}
                >
                  {t.recycle_bin.empty_all}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }} ref={scrollContainerRef}>
        {!screenshots || screenshots.length === 0 ? (
          <div style={styles.empty}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="1" style={{ marginBottom: 16 }}>
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <p>{t.recycle_bin.empty}</p>
            <p style={{ fontSize: 12, marginTop: 8, color: theme.textMuted }}>{t.recycle_bin.empty_hint}</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {screenshots.map((ss, index) => {
              const isHovered = hoveredId === ss.id
              const isSelected = selectedIds.includes(ss.id)
              return (
              <div 
                key={ss.id} 
                style={{ 
                  ...styles.card,
                  ...(isMultiSelectMode ? styles.cardWithCheckbox : {}),
                  ...(isMultiSelectMode && isSelected ? styles.cardSelected : {}),
                  boxShadow: isHovered ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
                  borderColor: isHovered ? theme.primary : 'transparent',
                  transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.1s'
                }}
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleSelect(ss.id)
                  }
                }}
                onMouseEnter={() => setHoveredId(ss.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {isMultiSelectMode && (
                  <div style={{
                    ...styles.selectCheckbox,
                    background: isSelected ? theme.primary : 'transparent',
                    border: isSelected ? 'none' : `2px solid ${theme.textMuted}`
                  }}>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                )}
                <div style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', position: 'relative' }}>
                  <ThumbnailImage 
                    key={ss._thumbVersion || 0}
                    thumbnailPath={ss.thumbnail_path}
                    theme={theme}
                  />
                  {!isMultiSelectMode && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      gap: 4,
                      padding: 6,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      opacity: isHovered ? 1 : 0,
                      transition: 'opacity 0.2s',
                    }}>
                      <button
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: theme.primary,
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                        onClick={(e) => { e.stopPropagation(); handleRestore(ss.id) }}
                      >
                        {t.recycle_bin.restore}
                      </button>
                      <button
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: '#e74c3c',
                          border: 'none',
                          borderRadius: 4,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                        onClick={(e) => { e.stopPropagation(); handlePermanentDelete(ss.id) }}
                      >
                        {t.recycle_bin.permanent_delete}
                      </button>
                    </div>
                  )}
                </div>
                <div style={styles.cardInfo}>
                  <div style={styles.cardTitle}>{ss.display_title || ss.game_title}</div>
                  <div style={{ ...styles.cardDate, color: theme.textMuted }}>
                    {t.recycle_bin.deleted_at} {formatDate(ss.timestamp)}
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && onLoadPage && (
        <Pagination
          theme={theme}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onLoadPage}
        />
      )}

      {confirmAction && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div 
            style={{
              background: theme.card,
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 20px 0', color: theme.text, fontSize: 15, lineHeight: 1.5 }}>
              {confirmAction.type === 'empty_all' 
                ? t.recycle_bin.empty_confirm 
                : t.recycle_bin.permanent_delete_confirm}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: theme.accent,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  color: theme.text,
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={() => setConfirmAction(null)}
              >
                {t.nav.settings === 'Settings' ? 'Cancel' : t.nav.settings === '設定' ? 'キャンセル' : '取消'}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#e74c3c',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={handleConfirm}
              >
                {t.nav.settings === 'Settings' ? 'Delete' : t.nav.settings === '設定' ? '削除' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
