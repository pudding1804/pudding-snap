import { useRef, useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'
import { Pagination } from './Pagination'

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
  onSortChange,
  onIconSizeChange,
  onToggleMultiSelect,
  onSelectScreenshot,
  onToggleSelect,
  onLoadPage,
  onDateFilterChange,
}) {
  const scrollContainerRef = useRef(null)
  const [showDateModal, setShowDateModal] = useState(false)
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')
  
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])
  
  const handleOpenDateModal = () => {
    setTempStartDate(dateFilterStart || '')
    setTempEndDate(dateFilterEnd || '')
    setShowDateModal(true)
  }
  
  const handleApplyDateFilter = () => {
    onDateFilterChange && onDateFilterChange(tempStartDate || null, tempEndDate || null)
    setShowDateModal(false)
  }
  
  const handleClearDateFilter = () => {
    onDateFilterChange && onDateFilterChange(null, null)
    setShowDateModal(false)
  }
  
  const isDateFilterActive = dateFilterStart || dateFilterEnd
  
  console.log('[DEBUG] ScreenshotGrid render:', { 
    currentPage, 
    totalPages, 
    hasOnLoadPage: !!onLoadPage,
    screenshotsCount: screenshots?.length 
  })
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        ...styles.header, 
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        background: theme.bg,
        zIndex: 10
      }}>
        <h1 style={styles.title}>{t.nav.time}</h1>
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
              {isDateFilterActive && (
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
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>
                    {dateFilterStart && dateFilterEnd 
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
                    onClick={() => onDateFilterChange && onDateFilterChange(null, null)}
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
                  background: isDateFilterActive ? theme.primary : theme.accent,
                  color: isDateFilterActive ? '#fff' : theme.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }} 
                {...btnEvents} 
                onClick={handleOpenDateModal}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {t.header.date_filter}
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
                  e.currentTarget.style.transform = 'scale(1.03)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = 'scale(1.03)'
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
                  <img 
                    src={getImageSrc(ss.thumbnail_path)} 
                    alt="截图缩略图" 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      objectPosition: 'center center'
                    }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                    loading="lazy"
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
          styles={styles}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onLoadPage}
        />
      )}
      
      {showDateModal && (
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
          onClick={() => setShowDateModal(false)}
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
            <h3 style={{ margin: '0 0 20px 0', color: theme.text, fontSize: 18 }}>
              {t.header.date_filter}
            </h3>
            
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
                onClick={handleClearDateFilter}
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
                onClick={handleApplyDateFilter}
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
