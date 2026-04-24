import { useRef, useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'
import { Pagination } from './Pagination'
import { NavDropdown } from './NavDropdown'
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

export function ScreenshotGrid({
  theme,
  styles,
  t,
  screenshots,
  isMultiSelectMode,
  selectedScreenshots,
  sortOrder,
  iconSize,
  currentPage = 1,
  totalPages = 1,
  dateFilterStart,
  dateFilterEnd,
  noteSearch,
  onSortChange,
  onIconSizeChange,
  onToggleMultiSelect,
  onSelectScreenshot,
  onToggleSelect,
  onLoadPage,
  onDateFilterChange,
  onNoteSearchChange,
  currentView,
  onNavigate,
}) {
  const scrollContainerRef = useRef(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchTab, setSearchTab] = useState('date')
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')
  const [tempNoteSearch, setTempNoteSearch] = useState('')
  
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])
  
  const handleOpenSearchModal = () => {
    setTempStartDate(dateFilterStart || '')
    setTempEndDate(dateFilterEnd || '')
    setTempNoteSearch(noteSearch || '')
    setSearchTab(noteSearch ? 'note' : 'date')
    setShowSearchModal(true)
  }
  
  const handleApplyFilter = () => {
    if (searchTab === 'date') {
      onDateFilterChange && onDateFilterChange(tempStartDate || null, tempEndDate || null)
      onNoteSearchChange && onNoteSearchChange(null)
    } else {
      onNoteSearchChange && onNoteSearchChange(tempNoteSearch.trim() || null)
      onDateFilterChange && onDateFilterChange(null, null)
    }
    setShowSearchModal(false)
  }
  
  const handleClearFilter = () => {
    onDateFilterChange && onDateFilterChange(null, null)
    onNoteSearchChange && onNoteSearchChange(null)
    setShowSearchModal(false)
  }
  
  const isDateFilterActive = dateFilterStart || dateFilterEnd
  const isNoteFilterActive = !!noteSearch
  const isAnyFilterActive = isDateFilterActive || isNoteFilterActive
  
  console.log('[DEBUG] ScreenshotGrid render:', { 
    currentPage, 
    totalPages, 
    hasOnLoadPage: !!onLoadPage,
    screenshotsCount: screenshots?.length 
  })
  
  return (
    <div className="screenshot-grid" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        ...styles.header, 
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        background: theme.bg,
        zIndex: 10
      }}>
        <NavDropdown
          theme={theme}
          currentView={currentView}
          t={t}
          onNavigate={onNavigate}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isMultiSelectMode ? (
            <>
              <button style={styles.btn} {...btnEvents} onClick={() => onToggleMultiSelect(false)}>
                {t.header.cancel_select}
              </button>
              <button 
                style={selectedScreenshots.length > 0 ? styles.btnDanger : styles.btnDisabled}
                {...(selectedScreenshots.length > 0 ? btnEvents : {})}
                onClick={() => onSelectScreenshot && onSelectScreenshot('delete')}
                disabled={selectedScreenshots.length === 0}
              >
                {t.header.confirm_delete} ({selectedScreenshots.length})
              </button>
            </>
          ) : (
            <>
              {isAnyFilterActive && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: theme.primary,
                  padding: '6px 10px',
                  borderRadius: 20,
                  fontSize: 13,
                  color: '#fff'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isNoteFilterActive ? (
                      <>
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </>
                    ) : (
                      <>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </>
                    )}
                  </svg>
                  <span>
                    {isNoteFilterActive 
                      ? `"${noteSearch}"`
                      : dateFilterStart && dateFilterEnd 
                        ? `${dateFilterStart} ${t.header.to} ${dateFilterEnd}`
                        : dateFilterStart 
                          ? `${t.header.from} ${dateFilterStart}`
                          : `${t.header.until} ${dateFilterEnd}`}
                  </span>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      marginLeft: 2
                    }}
                    onClick={() => {
                      onDateFilterChange && onDateFilterChange(null, null)
                      onNoteSearchChange && onNoteSearchChange(null)
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )}
              <button 
                style={{ 
                  ...styles.btn,
                  background: isAnyFilterActive ? theme.primary : theme.accent,
                  color: isAnyFilterActive ? '#fff' : theme.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }} 
                {...btnEvents} 
                onClick={handleOpenSearchModal}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                {t.header.search}
              </button>
              <select 
                value={sortOrder}
                onChange={(e) => onSortChange(e.target.value)}
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
                <option value="desc">{t.header.sort_newest}</option>
                <option value="asc">{t.header.sort_oldest}</option>
              </select>
              <select 
                value={iconSize}
                onChange={(e) => onIconSizeChange(e.target.value)}
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
                <option value="large">{t.header.icon_large}</option>
                <option value="small">{t.header.icon_small}</option>
              </select>
              <button style={styles.btn} {...btnEvents} onClick={() => onToggleMultiSelect(true)}>
                {t.header.multi_select}
              </button>
            </>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }} ref={scrollContainerRef}>
      {screenshots.length === 0 ? (
        <div style={styles.empty}>
          <p>{t.empty.no_screenshots}</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>{t.empty.screenshot_hint}</p>
        </div>
      ) : (
        <>
          <div style={styles.grid}>
            {screenshots.map((ss, index) => (
              <div 
                key={ss.id} 
                style={{ 
                  ...styles.card, 
                  ...(isMultiSelectMode ? styles.cardWithCheckbox : {}),
                  ...(isMultiSelectMode && selectedScreenshots.includes(ss.id) ? styles.cardSelected : {})
                }}
                onClick={() => onToggleSelect && onToggleSelect(ss.id, index)}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'
                  e.currentTarget.style.borderColor = theme.primary
                  const img = e.currentTarget.querySelector('.card-img')
                  if (img) img.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = 'transparent'
                  const img = e.currentTarget.querySelector('.card-img')
                  if (img) img.style.transform = 'scale(1)'
                }}
                onMouseDown={e => {
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'
                  e.currentTarget.style.transform = 'translateY(1px)'
                }}
                onMouseUp={e => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {isMultiSelectMode && (
                  <div style={{
                    ...styles.selectCheckbox,
                    ...(selectedScreenshots.includes(ss.id) ? styles.selectCheckboxChecked : {})
                  }}>
                    {selectedScreenshots.includes(ss.id) && (
                      <div style={styles.selectCheckboxInner} />
                    )}
                  </div>
                )}
                <div style={{ 
                  width: '100%', 
                  aspectRatio: '16 / 9', 
                  background: theme.accent, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  <ThumbnailImage 
                    key={ss._thumbVersion || 0}
                    thumbnailPath={ss.thumbnail_path}
                    theme={theme}
                  />
                </div>
                <div style={styles.cardInfo}>
                  <div style={styles.cardTitle}>{ss.display_title || ss.game_title}</div>
                  <div style={styles.cardDate}>{formatDate(ss.timestamp)}</div>
                  {ss.note && <div style={{ fontSize: 11, color: theme.text, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>{ss.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
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
      
      {showSearchModal && (
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
          onClick={() => setShowSearchModal(false)}
        >
          <div 
            style={{
              background: theme.card,
              borderRadius: 12,
              padding: 24,
              minWidth: 360,
              maxWidth: 420,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', marginBottom: 20, borderBottom: `1px solid ${theme.border}` }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: searchTab === 'date' ? `2px solid ${theme.primary}` : '2px solid transparent',
                  color: searchTab === 'date' ? theme.primary : theme.textMuted,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: searchTab === 'date' ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => setSearchTab('date')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {t.header.search_by_date}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: searchTab === 'note' ? `2px solid ${theme.primary}` : '2px solid transparent',
                  color: searchTab === 'note' ? theme.primary : theme.textMuted,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: searchTab === 'note' ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onClick={() => setSearchTab('note')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {t.header.search_by_note}
              </button>
            </div>
            
            {searchTab === 'date' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, color: theme.text, fontSize: 14 }}>
                    {t.header.start_date}
                  </label>
                  <input 
                    type="date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: theme.accent,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      color: theme.text,
                      fontSize: 14
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 8, color: theme.text, fontSize: 14 }}>
                    {t.header.end_date}
                  </label>
                  <input 
                    type="date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: theme.accent,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      color: theme.text,
                      fontSize: 14
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <div style={{ position: 'relative' }}>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={theme.textMuted}
                    strokeWidth="2"
                    style={{ position: 'absolute', left: 12, top: 12 }}
                  >
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder={t.header.note_search_placeholder}
                    value={tempNoteSearch}
                    onChange={(e) => setTempNoteSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      background: theme.accent,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      color: theme.text,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {tempNoteSearch && (
                    <button
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        background: 'transparent',
                        border: 'none',
                        color: theme.textMuted,
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onClick={() => setTempNoteSearch('')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            
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
                onClick={handleClearFilter}
              >
                {t.header.clear_filter}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: theme.primary,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14
                }}
                onClick={handleApplyFilter}
              >
                {t.header.apply_filter}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
