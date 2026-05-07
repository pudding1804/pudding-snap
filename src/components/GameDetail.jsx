import { useRef, useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'
import { Pagination } from './Pagination'
import { ThumbnailImage } from './ThumbnailImage'
import { formatGameTitle } from '../utils'

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

function RatingModal({ theme, styles, t, currentRating, onConfirm, onCancel }) {
  const [hoverRating, setHoverRating] = useState(-1)
  const [selectedRating, setSelectedRating] = useState(currentRating >= 0 ? currentRating : -1)
  const displayRating = hoverRating >= 0 ? hoverRating : selectedRating

  const handleStarClick = (e, starIndex) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isHalf = x < rect.width / 2
    const newRating = isHalf ? starIndex * 2 : starIndex * 2 + 1
    setSelectedRating(newRating)
  }

  const handleStarHover = (e, starIndex) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isHalf = x < rect.width / 2
    setHoverRating(isHalf ? starIndex * 2 : starIndex * 2 + 1)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000
    }} onClick={onCancel}>
      <div style={{
        ...styles.modalContent, maxWidth: 360, padding: 24
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 20, textAlign: 'center', color: theme.text }}>
          {t.rating?.title || '评分'}
        </h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {[0, 1, 2, 3, 4].map(starIndex => {
            const ratingForStar = displayRating >= 0 ? displayRating : 0
            const isFull = ratingForStar >= (starIndex * 2 + 2)
            const isHalf = !isFull && ratingForStar >= (starIndex * 2 + 1)
            const fillColor = theme.primary
            const emptyColor = theme.border

            return (
              <div
                key={starIndex}
                style={{ cursor: 'pointer', position: 'relative' }}
                onClick={(e) => handleStarClick(e, starIndex)}
                onMouseMove={(e) => handleStarHover(e, starIndex)}
                onMouseLeave={() => setHoverRating(-1)}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill={emptyColor}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {(isFull || isHalf) && (
                  <svg width="36" height="36" viewBox="0 0 24 24" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                    <defs>
                      <clipPath id={`clip-full-${starIndex}`}>
                        <rect x="0" y="0" width={isFull ? "24" : "12"} height="24" />
                      </clipPath>
                    </defs>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={fillColor} clipPath={`url(#clip-full-${starIndex})`} />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20, color: theme.textMuted, fontSize: 14 }}>
          {selectedRating >= 0 ? `${selectedRating}/10` : (t.rating?.not_rated || '未评分')}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            style={{ ...styles.btn, padding: '8px 24px' }}
            {...btnEvents}
            onClick={onCancel}
          >
            {t.rating?.cancel || '取消'}
          </button>
          <button
            style={{ ...styles.btnPrimary, padding: '8px 24px' }}
            {...btnEvents}
            onClick={() => {
              if (selectedRating >= 0) {
                onConfirm(selectedRating)
              }
            }}
            disabled={selectedRating < 0}
          >
            {t.rating?.confirm || '确认'}
          </button>
        </div>
      </div>
    </div>
  )
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
  currentPage = 1,
  totalPages = 1,
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
  onLoadPage,
  onRateGame,
}) {
  const scrollContainerRef = useRef(null)
  const [showRatingModal, setShowRatingModal] = useState(false)

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])

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
    <div className="game-detail" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        ...styles.header,
        position: 'relative',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        background: theme.bg,
        zIndex: 10
      }}>
        <button
          style={{ ...styles.btn, padding: '8px 12px' }}
          {...btnEvents}
          onClick={onBack}
          title="返回游戏列表"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
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
                alt={`${formatGameTitle(selectedGame.display_title, selectedGame.game_title)} 图标`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : selectedGame?.steam_logo_path ? (
              <img
                src={getImageSrc(selectedGame.steam_logo_path)}
                alt={`${formatGameTitle(selectedGame.display_title, selectedGame.game_title)} 图标`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : null}
          </div>
          <h1 style={styles.title}>{formatGameTitle(selectedGame?.display_title, selectedGame?.game_title)}</h1>
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
            <>
              <button
                style={{
                  ...styles.btn,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
                {...btnEvents}
                onClick={() => setShowRatingModal(true)}
                title={t.rating?.title || '评分'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={theme.primary} stroke="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {selectedGame?.rating != null && selectedGame.rating >= 0 && (
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{selectedGame.rating}</span>
                )}
              </button>
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
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
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
                          <circle cx="11" cy="11" r="8" />
                          <path d="M21 21l-4.35-4.35" />
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
                            <path d="M3 6h18M6 12h12M9 18h6" />
                          </svg>
                          {t.header.sort_by}
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSortMenu ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                          <path d="M9 18l6-6-6-6" />
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
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
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
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
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
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {t.import.title}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }} ref={scrollContainerRef}>
        {screenshots.length === 0 ? (
          <div style={styles.empty}>{t.empty.no_game_screenshots}</div>
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

      {showRatingModal && (
        <RatingModal
          theme={theme}
          styles={styles}
          t={t}
          currentRating={selectedGame?.rating ?? -1}
          onConfirm={async (rating) => {
            setShowRatingModal(false)
            if (onRateGame) {
              onRateGame(selectedGame?.game_id, rating)
            }
          }}
          onCancel={() => setShowRatingModal(false)}
        />
      )}
    </div>
  )
}
