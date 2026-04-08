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
  onSortChange,
  onIconSizeChange,
  onToggleMultiSelect,
  onSelectGame,
  onToggleSelectGame,
  onAddGame,
  onToggleMenu,
}) {
  console.log('[DEBUG] GameList render, showMenu:', showMenu, 'games count:', games?.length)
  
  const handleMenuToggle = (show) => {
    console.log('[DEBUG] GameList handleMenuToggle:', show)
    onToggleMenu && onToggleMenu(show)
  }
  
  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>{t.nav.games}</h1>
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
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="16"/>
                          <line x1="8" y1="12" x2="16" y2="12"/>
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
                          <rect x="3" y="3" width="7" height="7" rx="1"/>
                          <rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/>
                          <rect x="14" y="14" width="7" height="7" rx="1"/>
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
      
      {games.length === 0 ? (
        <div style={styles.empty}>
          <p>{t.empty.no_games}</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>{t.empty.game_hint}</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {games.map((game, index) => {
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
                {iconSrc ? (
                  hasSteamLogo ? (
                    <img 
                      src={getImageSrc(iconSrc)} 
                      alt={`${game.display_title || game.game_title} 图标`}
                      style={styles.gameLogoImage}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?';
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
                      justifyContent: 'center'
                    }}>
                      <img 
                        src={getImageSrc(iconSrc)} 
                        alt={`${game.display_title || game.game_title} 图标`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?';
                        }}
                      />
                    </div>
                  )
                ) : (
                  game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?'
                )}
              </div>
              <div style={styles.gameTitle}>{game.display_title || game.game_title}</div>
              <div style={styles.gameCount}>{game.count} {t.game.screenshots}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                {t.game.last_updated} {formatDate(game.last_timestamp)}
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  )
}
