import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'
import { Pagination } from './Pagination'
import { NavDropdown } from './NavDropdown'
import { formatGameTitle } from '../utils'

function StarRating({ rating, theme, size = 12 }) {
  if (rating === null || rating === undefined || rating < 0) return null
  const stars = []
  const fullStars = Math.floor(rating / 2)
  const halfStar = rating % 2 === 1
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0)
  const starColor = theme.primary
  const emptyColor = theme.border

  for (let i = 0; i < fullStars; i++) {
    stars.push(
      <svg key={`full-${i}`} width={size} height={size} viewBox="0 0 24 24" fill={starColor}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    )
  }
  if (halfStar) {
    stars.push(
      <svg key="half" width={size} height={size} viewBox="0 0 24 24">
        <defs>
          <linearGradient id={`halfGrad-${rating}`}>
            <stop offset="50%" stopColor={starColor} />
            <stop offset="50%" stopColor={emptyColor} />
          </linearGradient>
        </defs>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#halfGrad-${rating})`} />
      </svg>
    )
  }
  for (let i = 0; i < emptyStars; i++) {
    stars.push(
      <svg key={`empty-${i}`} width={size} height={size} viewBox="0 0 24 24" fill={emptyColor}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    )
  }
  return <div style={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>{stars}</div>
}

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
  if (!timestamp || timestamp === 0) return ''
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

export function GameList({
  theme,
  styles,
  t,
  games,
  isGameMultiSelectMode,
  selectedGames,
  gameSortOrder,
  iconSize,
  showMenu,
  currentPage = 1,
  totalPages = 1,
  isLoading = false,
  onSortChange,
  onIconSizeChange,
  onToggleMultiSelect,
  onSelectGame,
  onToggleSelectGame,
  onAddGame,
  onToggleMenu,
  onLoadPage,
  currentView,
  onNavigate,
  onSearchGames,
  onClearSearch,
}) {
  const scrollContainerRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const searchTimerRef = useRef(null)

  const handleSearch = useCallback((term) => {
    setSearchTerm(term)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!term.trim()) {
      setSearchResults(null)
      onClearSearch && onClearSearch()
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await invoke('search_all_games', { searchTerm: term })
        setSearchResults(results)
        onSearchGames && onSearchGames(results)
      } catch (e) {
        console.error('搜索游戏失败:', e)
      }
    }, 300)
  }, [onSearchGames, onClearSearch])

  const displayGames = searchResults !== null ? searchResults : games

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])

  const handleMenuToggle = (show) => {
    console.log('[DEBUG] GameList handleMenuToggle:', show)
    onToggleMenu && onToggleMenu(show)
  }

  return (
    <div className="game-list" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          {isGameMultiSelectMode ? (
            <>
              <button style={styles.btn} {...btnEvents} onClick={() => onToggleMultiSelect(false)}>
                {t.game_multi_select.cancel_select}
              </button>
              <button
                style={selectedGames.length > 0 ? styles.btnDanger : styles.btnDisabled}
                {...(selectedGames.length > 0 ? btnEvents : {})}
                onClick={() => onSelectGame && onSelectGame('delete')}
                disabled={selectedGames.length === 0}
              >
                {t.game_multi_select.confirm_delete} ({selectedGames.length})
              </button>
            </>
          ) : (
            <>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.textMuted}
                  strokeWidth="2"
                  style={{ position: 'absolute', left: 10 }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder={t.header.search_game}
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 32px',
                    background: theme.accent,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 6,
                    color: theme.text,
                    fontSize: 14,
                    width: 180,
                    outline: 'none'
                  }}
                />
                {searchTerm && (
                  <button
                    style={{
                      position: 'absolute',
                      right: 6,
                      background: 'transparent',
                      border: 'none',
                      color: theme.textMuted,
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onClick={() => handleSearch('')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <select
                value={gameSortOrder}
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
                <option value="time_desc">{t.header.game_sort_newest}</option>
                <option value="time_asc">{t.header.game_sort_oldest}</option>
                <option value="alpha_asc">{t.header.game_sort_alpha_asc}</option>
                <option value="alpha_desc">{t.header.game_sort_alpha_desc}</option>
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
              <div style={{ position: 'relative' }}>
                <button
                  style={{ ...styles.btn, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  {...btnEvents}
                  onClick={() => {
                    console.log('[DEBUG] GameList menu button clicked, current showMenu:', showMenu)
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
                        console.log('[DEBUG] GameList overlay clicked, closing menu')
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
                          console.log('[DEBUG] GameList add game clicked')
                          onAddGame && onAddGame()
                          handleMenuToggle(false)
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.accent}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        {t.add_game.title}
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
                          console.log('[DEBUG] GameList multi select clicked')
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
                        {t.game_multi_select.multi_delete}
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
        {displayGames.length === 0 ? (
          <div style={styles.empty}>
            {searchTerm ? (
              <>
                <p>{t.header.no_search_results}</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>{t.header.try_other_keywords}</p>
              </>
            ) : (
              <>
                <p>{t.empty.no_games}</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>{t.empty.game_hint}</p>
              </>
            )}
          </div>
        ) : (
          <>
            {searchTerm && (
              <div style={{
                padding: '8px 16px',
                background: theme.accent,
                borderBottom: `1px solid ${theme.border}`,
                fontSize: 13,
                color: theme.textMuted
              }}>
                {t.header.search_result_for} "{searchTerm}" ({displayGames.length})
              </div>
            )}
            <div style={styles.grid}>
              {displayGames.map((game, index) => {
                const hasSteamLogo = !!game.steam_logo_path;
                const iconSrc = game.steam_logo_path || game.game_icon_path;
                return (
                  <div
                    key={game.game_id}
                    style={{
                      ...styles.gameCard,
                      ...(isGameMultiSelectMode ? styles.cardWithCheckbox : {}),
                      ...(isGameMultiSelectMode && selectedGames.includes(game.game_id) ? styles.cardSelected : {})
                    }}
                    onClick={() => onToggleSelectGame && onToggleSelectGame(game)}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'
                      e.currentTarget.style.borderColor = theme.primary
                      const icon = e.currentTarget.querySelector('.game-icon-inner')
                      if (icon) icon.style.transform = 'scale(1.05)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = 'transparent'
                      const icon = e.currentTarget.querySelector('.game-icon-inner')
                      if (icon) icon.style.transform = 'scale(1)'
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
                    {isGameMultiSelectMode && (
                      <div style={{
                        ...styles.selectCheckbox,
                        ...(selectedGames.includes(game.game_id) ? styles.selectCheckboxChecked : {})
                      }}>
                        {selectedGames.includes(game.game_id) && (
                          <div style={styles.selectCheckboxInner} />
                        )}
                      </div>
                    )}
                    <div style={styles.gameIcon}>
                      <div className="game-icon-inner" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'transform 0.3s ease' }}>
                        {iconSrc ? (
                          hasSteamLogo ? (
                            <img
                              src={getImageSrc(iconSrc)}
                              alt={`${formatGameTitle(game.display_title, game.game_title)} 图标`}
                              style={styles.gameLogoImage}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = formatGameTitle(game.display_title, game.game_title)?.charAt(0) || '?';
                                e.target.parentElement.style.background = theme.accent;
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: theme.accent
                            }}>
                              <img
                                src={getImageSrc(iconSrc)}
                                alt={`${formatGameTitle(game.display_title, game.game_title)} 图标`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = formatGameTitle(game.display_title, game.game_title)?.charAt(0) || '?';
                                }}
                              />
                            </div>
                          )
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: theme.accent,
                            borderRadius: 6
                          }}>
                            {formatGameTitle(game.display_title, game.game_title)?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={styles.gameTitle}>{formatGameTitle(game.display_title, game.game_title)}</div>
                    <StarRating rating={game.rating} theme={theme} size={12} />
                    <div style={{ ...styles.gameCount, marginTop: 4 }}>{game.count} {t.game.screenshots}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                      {formatDate(game.last_timestamp) ? `${t.game.last_updated} ${formatDate(game.last_timestamp)}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {isLoading && (
              <div style={styles.loading}>加载中...</div>
            )}
          </>
        )}
      </div>

      {!searchTerm && totalPages > 1 && onLoadPage && (
        <Pagination
          theme={theme}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onLoadPage}
        />
      )}
    </div>
  )
}
