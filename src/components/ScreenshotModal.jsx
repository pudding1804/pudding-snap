import { useEffect } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'

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

export function ScreenshotModal({
  theme,
  styles,
  t,
  selectedScreenshot,
  selectedScreenshotIndex,
  screenshots,
  noteText,
  isModalClosing,
  onClose,
  onNavigate,
  onNoteChange,
  onSaveNote,
  onOpenFolder,
  onDelete,
  onShare,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          if (selectedScreenshotIndex > 0) {
            onNavigate('prev')
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (selectedScreenshotIndex < screenshots.length - 1) {
            onNavigate('next')
          }
          break
        case 'Escape':
        case 'Backspace':
          e.preventDefault()
          onClose()
          break
        case 'Delete':
          e.preventDefault()
          if (selectedScreenshot) {
            onDelete(selectedScreenshot.id)
          }
          break
      }
    }

    const handleMouseDown = (e) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [selectedScreenshotIndex, screenshots.length, selectedScreenshot, onNavigate, onClose, onDelete])

  if (!selectedScreenshot) return null

  return (
    <div 
      style={{
        ...styles.modal,
        animation: isModalClosing ? 'modalFadeOut 0.25s ease-in forwards' : 'modalFadeIn 0.3s ease-out'
      }} 
      onClick={onClose}
    >
      <div 
        style={{
          ...styles.modalContent,
          width: '95vw',
          maxWidth: 1200,
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ 
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: theme.textMuted, 
                cursor: 'pointer', 
                fontSize: 16, 
                padding: '2px 6px',
                lineHeight: 1,
                transition: 'color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
              onMouseEnter={e => e.currentTarget.style.color = theme.text}
              onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}
              onClick={onClose}
            >
              ‹ 返回
            </button>
            <span style={{ fontSize: 12, color: theme.textMuted }}>|</span>
            <span style={{ fontSize: 13, color: theme.text, fontWeight: 500 }}>
              {formatDate(selectedScreenshot.timestamp)}
            </span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>|</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              {selectedScreenshot.display_title || selectedScreenshot.game_title}
            </span>
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: 8,
          minHeight: 0
        }}>
          <img 
            src={getImageSrc(selectedScreenshot.file_path)} 
            alt="截图" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: 'calc(95vh - 145px)',
              objectFit: 'contain'
            }} 
          />
        </div>
        
        <div style={{ 
          padding: '10px 16px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: selectedScreenshotIndex > 0 ? theme.accent : 'transparent',
                border: `1px solid ${selectedScreenshotIndex > 0 ? theme.border : 'transparent'}`,
                color: selectedScreenshotIndex > 0 ? theme.text : theme.textMuted,
                cursor: selectedScreenshotIndex > 0 ? 'pointer' : 'default',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                opacity: selectedScreenshotIndex > 0 ? 1 : 0.4
              }}
              onMouseEnter={e => {
                if (selectedScreenshotIndex > 0) {
                  e.currentTarget.style.background = theme.border
                }
              }}
              onMouseLeave={e => {
                if (selectedScreenshotIndex > 0) {
                  e.currentTarget.style.background = theme.accent
                }
              }}
              onClick={() => onNavigate('prev')}
              disabled={selectedScreenshotIndex === 0}
            >
              ‹
            </button>
            <span style={{ 
              fontSize: 12, 
              color: theme.textMuted, 
              minWidth: 50, 
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {selectedScreenshotIndex + 1} / {screenshots.length}
            </span>
            <button
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: selectedScreenshotIndex < screenshots.length - 1 ? theme.accent : 'transparent',
                border: `1px solid ${selectedScreenshotIndex < screenshots.length - 1 ? theme.border : 'transparent'}`,
                color: selectedScreenshotIndex < screenshots.length - 1 ? theme.text : theme.textMuted,
                cursor: selectedScreenshotIndex < screenshots.length - 1 ? 'pointer' : 'default',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                opacity: selectedScreenshotIndex < screenshots.length - 1 ? 1 : 0.4
              }}
              onMouseEnter={e => {
                if (selectedScreenshotIndex < screenshots.length - 1) {
                  e.currentTarget.style.background = theme.border
                }
              }}
              onMouseLeave={e => {
                if (selectedScreenshotIndex < screenshots.length - 1) {
                  e.currentTarget.style.background = theme.accent
                }
              }}
              onClick={() => onNavigate('next')}
              disabled={selectedScreenshotIndex === screenshots.length - 1}
            >
              ›
            </button>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            flex: 1,
            background: theme.accent,
            borderRadius: 6,
            border: `1px solid ${theme.border}`,
            overflow: 'hidden'
          }}>
            <textarea
              value={noteText}
              onChange={e => onNoteChange(e.target.value)}
              onKeyDown={e => {
                if (e.ctrlKey && e.key === 'Enter') {
                  e.preventDefault()
                  onSaveNote(selectedScreenshot.id, noteText)
                }
              }}
              maxLength={120}
              placeholder={t.header.note_hint}
              style={{ 
                flex: 1,
                height: 52, 
                resize: 'none',
                fontSize: 13,
                lineHeight: 1.5,
                padding: '6px 10px',
                background: 'transparent',
                border: 'none',
                color: theme.text,
                outline: 'none',
                overflow: 'hidden'
              }}
            />
            <button 
              style={{ 
                padding: '0 12px', 
                height: 52,
                background: theme.primary, 
                border: 'none', 
                color: '#fff', 
                cursor: 'pointer', 
                fontSize: 12,
                fontWeight: 500,
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              onClick={() => onSaveNote(selectedScreenshot.id, noteText)}
            >
              {t.detail.save_note}
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button 
              style={{ 
                width: 28,
                height: 28,
                background: theme.accent, 
                border: `1px solid ${theme.border}`,
                borderRadius: 6, 
                color: theme.text, 
                cursor: 'pointer', 
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = theme.border}
              onMouseLeave={e => e.currentTarget.style.background = theme.accent}
              onClick={() => onOpenFolder(selectedScreenshot.file_path)}
              title={t.detail.open_folder}
            >
              📁
            </button>
            <button 
              style={{ 
                width: 28,
                height: 28,
                background: theme.primary, 
                border: 'none', 
                borderRadius: 6, 
                color: '#fff', 
                cursor: 'pointer', 
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              onClick={() => onShare(selectedScreenshot)}
              title={t.share?.title || '分享'}
            >
              ⬆
            </button>
            <button 
              style={{ 
                width: 28,
                height: 28,
                background: theme.danger, 
                border: 'none', 
                borderRadius: 6, 
                color: '#fff', 
                cursor: 'pointer', 
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              onClick={() => onDelete(selectedScreenshot.id)}
              title={t.detail.delete}
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
