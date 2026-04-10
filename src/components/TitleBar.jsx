import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function TitleBar({ theme, t, onCloseConfirm }) {
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
    transition: 'background 0.15s'
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
