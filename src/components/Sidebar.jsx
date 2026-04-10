export function Sidebar({ 
  theme, 
  styles, 
  currentView, 
  sidebarCollapsed, 
  logs, 
  showDebug,
  t,
  onNavigate,
  onToggleSidebar 
}) {
  return (
    <nav style={{
      ...styles.sidebar,
      width: sidebarCollapsed ? 48 : 200,
      padding: sidebarCollapsed ? 8 : 16,
      transition: 'width 0.25s ease, padding 0.25s ease',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ flex: 1 }}>
        <div 
          style={{ 
            ...styles.navItem, 
            ...(currentView === 'time' ? styles.navItemActive : {}),
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onClick={() => onNavigate('time')}
        >
          {t.nav.time}
        </div>
        <div 
          style={{ 
            ...styles.navItem, 
            ...(currentView === 'games' || currentView === 'game-detail' ? styles.navItemActive : {}),
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onClick={() => onNavigate('games')}
        >
          {t.nav.games}
        </div>
        <div 
          style={{ 
            ...styles.navItem, 
            ...(currentView === 'settings' ? styles.navItemActive : {}),
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onClick={() => onNavigate('settings')}
        >
          {t.nav.settings}
        </div>

        {showDebug && (
          <div style={{ 
            ...styles.debugPanel,
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease'
          }}>
            {logs.slice(-5).map((log, i) => (
              <div key={i} style={styles.debugLine}>{log}</div>
            ))}
          </div>
        )}
      </div>
      
      <button
        onClick={onToggleSidebar}
        style={{
          width: '100%',
          height: 36,
          background: theme.accent,
          border: 'none',
          borderRadius: 6,
          color: theme.text,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
          marginTop: 8
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = theme.card
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = theme.accent
        }}
        title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ 
            transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease'
          }}
        >
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
    </nav>
  )
}
