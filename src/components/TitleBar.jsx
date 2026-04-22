import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function TitleBar({ theme, t, onCloseConfirm, currentView, onNavigate, recycleBinCount = 0 }) {
  const handleMinimize = async () => {
    await invoke('minimize_to_tray')
  }

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow()
    await appWindow.toggleMaximize()
  }

  const handleClose = () => {
    onCloseConfirm()
  }

  const buttonStyle = {
    width: 46,
    height: 32,
    border: 'none',
    background: 'transparent',
    color: theme.text,
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
    position: 'relative',
  }

  const iconBtnStyle = {
    width: 36,
    height: 32,
    border: 'none',
    background: 'transparent',
    color: theme.textMuted,
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
    position: 'relative',
  }

  return (
    <div 
      style={{ 
        height: 32,
        background: theme.sidebar,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 100
      }}
      data-tauri-drag-region
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        WebkitAppRegion: 'no-drag'
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>
          PuddingSnap
        </span>
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        WebkitAppRegion: 'no-drag'
      }}>
        <button
          style={{
            ...iconBtnStyle,
            color: currentView === 'settings' ? theme.primary : theme.textMuted,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.color = theme.text
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = currentView === 'settings' ? theme.primary : theme.textMuted
          }}
          onClick={() => onNavigate && onNavigate('settings')}
          title={t.nav.settings}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          style={{
            ...iconBtnStyle,
            color: currentView === 'recycle-bin' ? theme.primary : theme.textMuted,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.color = theme.text
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = currentView === 'recycle-bin' ? theme.primary : theme.textMuted
          }}
          onClick={() => onNavigate && onNavigate('recycle-bin')}
          title={t.nav.recycle_bin}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {recycleBinCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: '#e74c3c',
              color: '#fff',
              borderRadius: 8,
              padding: '0 4px',
              fontSize: 10,
              fontWeight: 'bold',
              minWidth: 14,
              textAlign: 'center',
              lineHeight: '14px',
              pointerEvents: 'none',
            }}>
              {recycleBinCount > 99 ? '99+' : recycleBinCount}
            </span>
          )}
        </button>
        <div style={{ width: 1, height: 16, background: theme.border, margin: '0 2px' }} />
        <button
          style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={handleMinimize}
          title={t.close_confirm?.minimize || '最小化到托盘'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="1" y="5.5" width="10" height="1" />
          </svg>
        </button>
        <button
          style={buttonStyle}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={handleMaximize}
          title="最大化"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
          </svg>
        </button>
        <button
          style={{ ...buttonStyle, width: 46 }}
          onMouseEnter={e => e.currentTarget.style.background = theme.danger}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={handleClose}
          title={t.settings?.close || '关闭'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
