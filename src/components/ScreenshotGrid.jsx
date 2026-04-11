import { useRef, useEffect } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'

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
  onSortChange,
  onIconSizeChange,
  onToggleMultiSelect,
  onSelectScreenshot,
  onToggleSelect,
  onLoadPage,
}) {
  const scrollContainerRef = useRef(null)
  
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])
  
  console.log('[DEBUG] ScreenshotGrid render:', { 
    currentPage, 
    totalPages, 
    hasOnLoadPage: !!onLoadPage,
    screenshotsCount: screenshots?.length 
  })
  
  const handlePageChange = (page) => {
    console.log('[DEBUG] ScreenshotGrid handlePageChange:', page)
    if (onLoadPage) {
      onLoadPage(page)
    }
  }
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
      
      {totalPages > 1 && (
        <div style={{ 
          ...styles.pagination, 
          flexShrink: 0,
          position: 'sticky',
          bottom: 0,
          background: theme.bg,
          zIndex: 10,
          marginTop: 0
        }}>
          <button 
            style={styles.paginationBtn}
            {...btnEvents}
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            首页
          </button>
          <button 
            style={styles.paginationBtn}
            {...btnEvents}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            上一页
          </button>
          <span style={styles.paginationInfo}>
            第 {currentPage} 页，共 {totalPages} 页
          </span>
          <button 
            style={styles.paginationBtn}
            {...btnEvents}
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
          </button>
          <button 
            style={styles.paginationBtn}
            {...btnEvents}
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            末页
          </button>
        </div>
      )}
    </div>
  )
}
