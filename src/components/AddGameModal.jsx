import { invoke } from '@tauri-apps/api/core'
import { btnEvents } from '../styles/sharedStyles'

export function AddGameModal({
  theme,
  styles,
  t,
  steamLanguage,
  show,
  step,
  searchTerm,
  searchResults,
  isAdding,
  source,
  onClose,
  onStepChange,
  onSearchTermChange,
  onAddGame,
  onNotification,
}) {
  if (!show) return null

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalContent, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        {step === 'platform' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ marginBottom: 24, textAlign: 'center' }}>{t.add_game.select_platform}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                style={{ 
                  ...styles.btn, 
                  padding: '16px 24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 12,
                  fontSize: 16
                }}
                {...btnEvents}
                onClick={() => onStepChange('search')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                {t.add_game.steam}
              </button>
              <button
                style={{ 
                  ...styles.btn, 
                  padding: '16px 24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 12,
                  fontSize: 16
                }}
                {...btnEvents}
                onClick={() => onStepChange('bangumi-search')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9"/>
                  <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
                {t.add_game.bangumi}
              </button>
            </div>
          </div>
        )}
        
        {step === 'search' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ marginBottom: 16, textAlign: 'center' }}>{t.add_game.title}</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    onAddGame && onAddGame('search', searchTerm)
                  }
                }}
                placeholder={t.add_game.search_placeholder}
                style={{ ...styles.input, flex: 1 }}
                autoFocus
              />
              <button 
                style={styles.btnPrimary}
                {...btnEvents}
                onClick={() => onAddGame && onAddGame('search', searchTerm)}
                disabled={isAdding}
              >
                {isAdding ? t.add_game.searching : t.add_game.search}
              </button>
            </div>
            <button 
              style={{ ...styles.btn, width: '100%' }}
              {...btnEvents}
              onClick={() => onStepChange('platform')}
            >
              {t.add_game.back}
            </button>
          </div>
        )}
        
        {step === 'bangumi-search' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ marginBottom: 16, textAlign: 'center' }}>{t.add_game.title}</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    onAddGame && onAddGame('bangumi-search', searchTerm)
                  }
                }}
                placeholder={t.add_game.search_placeholder}
                style={{ ...styles.input, flex: 1 }}
                autoFocus
              />
              <button 
                style={styles.btnPrimary}
                {...btnEvents}
                onClick={() => onAddGame && onAddGame('bangumi-search', searchTerm)}
                disabled={isAdding}
              >
                {isAdding ? t.add_game.searching : t.add_game.search}
              </button>
            </div>
            <button 
              style={{ ...styles.btn, width: '100%' }}
              {...btnEvents}
              onClick={() => onStepChange('platform')}
            >
              {t.add_game.back}
            </button>
          </div>
        )}
        
        {step === 'results' && (
          <div style={{ padding: 24 }}>
            {isAdding ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  border: `3px solid ${theme.border}`,
                  borderTop: `3px solid ${theme.primary}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: theme.text }}>{t.add_game.creating}</p>
              </div>
            ) : (
              <>
                <p style={{ color: theme.textMuted, marginBottom: 16 }}>
                  {t.add_game.found_results.replace('{count}', searchResults.length)}
                </p>
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.map(result => (
                    <div 
                      key={result.appid}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12, 
                        padding: 12, 
                        background: theme.accent, 
                        borderRadius: 8, 
                        cursor: 'pointer',
                        transition: 'transform 0.15s, background 0.15s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.02)'
                        e.currentTarget.style.background = theme.card
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.background = theme.accent
                      }}
                      onClick={() => onAddGame && onAddGame(source === 'bangumi' ? 'create-bangumi' : 'create', result)}
                    >
                      {result.tiny_image && (
                        <img 
                          src={result.tiny_image} 
                          alt={result.name}
                          style={{ width: 60, height: 30, objectFit: 'cover', borderRadius: 4 }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{result.name}</div>
                        <div style={{ fontSize: 12, color: theme.textMuted }}>AppID: {result.appid}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  style={{ ...styles.btn, width: '100%', marginTop: 16 }}
                  {...btnEvents}
                  onClick={() => onStepChange('search')}
                >
                  {t.add_game.back}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
