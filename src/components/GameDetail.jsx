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

export function GameDetail({
  theme,
  styles,
  t,
  selectedGame,
  screenshots,
  isMultiSelectMode,
  selectedScreenshots,
  sortOrder,
  iconSize,
  showMenu,
  showSortMenu,
  onBack,
  onSortChange,
  onIconSizeChange,
  onToggleMultiSelect,
  onSelectScreenshot,
  onToggleSelect,
  onOpenSearch,
  onOpenImport,
  onToggleMenu,
  onToggleSortMenu,
}) {
  console.log('[DEBUG] GameDetail render, showMenu:', showMenu, 'showSortMenu:', showSortMenu, 'screenshots count:', screenshots?.length)
  
  const handleMenuToggle = (show) => {
    console.log('[DEBUG] GameDetail handleMenuToggle:', show)
    onToggleMenu && onToggleMenu(show)
  }
  
  const handleSortMenuToggle = (show) => {
    console.log('[DEBUG] GameDetail handleSortMenuToggle:', show)
    onToggleSortMenu && onToggleSortMenu(show)
  }
  
  return (
    <div>
      <div style={{ ...styles.header, position: 'relative' }}>
        <button 
          style={{ ...styles.btn, padding: '8px 12px' }} 
          {...btnEvents}
          onClick={onBack}
          title="返回游戏列表"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 6, 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {selectedGame?.game_icon_path ? (
              <img 
                src={getImageSrc(selectedGame.game_icon_path)} 
                alt={`${selectedGame.display_title || selectedGame.game_title} 图标`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : selectedGame?.steam_logo_path ? (
              <img 
                src={getImageSrc(selectedGame.steam_logo_path)} 
                alt={`${selectedGame.display_title || selectedGame.game_title} 图标`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : null}
          </div>
          <h1 style={styles.title}>{selectedGame?.display_title || selectedGame?.game_title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
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
            <div style={{ position: 'relative' }}>
              <button 
                style={{ 
                  ...styles.btn, 
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} 
                {...btnEvents}
                onClick={() => {
                  console.log('[DEBUG] GameDetail menu button clicked, current showMenu:', showMenu)
                  handleMenuToggle(!showMenu)
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              
              {showMenu && (
                <>
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                    onClick={() => {
                      console.log('[DEBUG] GameDetail overlay clicked, closing menu')
                      handleMenuToggle(false)
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: theme.card,
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    minWidth: 160,
                    zIndex: 999,
                    overflow: 'hidden'
                  }}>
                    <div
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'background 0.2s'
                      }}
                      onClick={() => {
                        console.log('[DEBUG] GameDetail search clicked')
                        onOpenSearch && onOpenSearch()
                        handleMenuToggle(false)
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.accent}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35"/>
                      </svg>
                      {t.header.search_info}
                    </div>
                    
                    <div
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.2s'
                      }}
                      onClick={() => {
                        console.log('[DEBUG] GameDetail sort submenu toggled')
                        handleSortMenuToggle(!showSortMenu)
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.accent}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M6 12h12M9 18h6"/>
                        </svg>
                        {t.header.sort_by}
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSortMenu ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                    
                    {showSortMenu && (
                      <div style={{ background: theme.accent }}>
                        {[
                          { value: 'desc', label: t.header.game_sort_newest },
                          { value: 'asc', label: t.header.game_sort_oldest }
                        ].map(option => (
                          <div
                            key={option.value}
                            style={{
                              padding: '8px 16px 8px 32px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              background: sortOrder === option.value ? theme.primary : 'transparent',
                              color: sortOrder === option.value ? '#fff' : theme.text,
                              transition: 'background 0.2s'
                            }}
                            onClick={() => {
                              console.log('[DEBUG] GameDetail sort option selected:', option.value)
                              onSortChange(option.value)
                              handleSortMenuToggle(false)
                              handleMenuToggle(false)
                            }}
                          >
                            {option.label}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                    
                    <div
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'background 0.2s'
                      }}
                      onClick={() => {
                        console.log('[DEBUG] GameDetail icon size toggled')
                        onIconSizeChange(iconSize === 'large' ? 'small' : 'large')
                        handleMenuToggle(false)
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.accent}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                      {iconSize === 'large' ? t.header.icon_small : t.header.icon_large}
                    </div>
                    
                    <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                    
                    <div
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'background 0.2s'
                      }}
                      onClick={() => {
                        console.log('[DEBUG] GameDetail multi select clicked')
                        onToggleMultiSelect(true)
                        handleMenuToggle(false)
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.accent}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                      </svg>
                      {t.header.multi_select}
                    </div>
                    
                    <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                    
                    <div
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'background 0.2s'
                      }}
                      onClick={() => {
                        console.log('[DEBUG] GameDetail import clicked')
                        onOpenImport && onOpenImport()
                        handleMenuToggle(false)
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.accent}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      {t.import.title}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {screenshots.length === 0 ? (
        <div style={styles.empty}>{t.empty.no_game_screenshots}</div>
      ) : (
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
                <div style={styles.cardDate}>{formatDate(ss.timestamp)}</div>
                {ss.note && <div style={{ fontSize: 11, color: theme.text, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>{ss.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
