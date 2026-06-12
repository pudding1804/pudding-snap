import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
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

export function ScreenshotModal({
  theme,
  styles,
  t,
  selectedScreenshot,
  selectedScreenshotIndex,
  screenshots,
  noteText,
  isModalClosing,
  globalScreenshotIndex,
  totalScreenshotCount,
  allScreenshotIds,
  onPreloadScreenshots,
  onClose,
  onNavigate,
  onNoteChange,
  onSaveNote,
  onOpenFolder,
  onDelete,
  onShare,
}) {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [showFullImage, setShowFullImage] = useState(false)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [windowHeight, setWindowHeight] = useState(window.innerHeight)
  const imgRef = useRef(null)
  const preloadedImages = useRef(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showRestoreBtn, setShowRestoreBtn] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(false)
  const fullscreenOverlayRef = useRef(null)
  const hideRestoreTimerRef = useRef(null)
  const cursorTimerRef = useRef(null)
  const isFullscreenRef = useRef(false)

  const thumbnailSrc = useMemo(() => {
    return selectedScreenshot?.thumbnail_path ? getImageSrc(selectedScreenshot.thumbnail_path) : null
  }, [selectedScreenshot?.thumbnail_path])

  // Track window dimensions to recalculate modal width on fullscreen exit
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      setWindowHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fullImageSrc = useMemo(() => {
    return selectedScreenshot?.file_path ? getImageSrc(selectedScreenshot.file_path) : null
  }, [selectedScreenshot?.file_path])

  useEffect(() => {
    if (selectedScreenshot?.file_path) {
      setIsImageLoading(true)
      setShowFullImage(false)
      
      const img = new window.Image()
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
        setIsImageLoading(false)
        setShowFullImage(true)
      }
      img.onerror = () => {
        setIsImageLoading(false)
      }
      img.src = getImageSrc(selectedScreenshot.file_path)
    }
  }, [selectedScreenshot?.file_path])

  const PRELOAD_RANGE = 3

  useEffect(() => {
    const effectiveIndex = globalScreenshotIndex >= 0 ? globalScreenshotIndex : selectedScreenshotIndex
    const effectiveTotal = totalScreenshotCount > 0 ? totalScreenshotCount : screenshots.length

    for (let offset = 1; offset <= PRELOAD_RANGE; offset++) {
      if (effectiveIndex - offset >= 0) {
        const prevLocalIdx = selectedScreenshotIndex - offset
        if (prevLocalIdx >= 0 && screenshots[prevLocalIdx]) {
          const src = getImageSrc(screenshots[prevLocalIdx].file_path)
          if (!preloadedImages.current.has(src)) {
            const img = new window.Image()
            img.src = src
            preloadedImages.current.add(src)
          }
        }
      }

      if (effectiveIndex + offset < effectiveTotal) {
        const nextLocalIdx = selectedScreenshotIndex + offset
        if (nextLocalIdx < screenshots.length && screenshots[nextLocalIdx]) {
          const src = getImageSrc(screenshots[nextLocalIdx].file_path)
          if (!preloadedImages.current.has(src)) {
            const img = new window.Image()
            img.src = src
            preloadedImages.current.add(src)
          }
        }
      }
    }

    if (allScreenshotIds.length > 0 && onPreloadScreenshots) {
      const idsToFetch = []
      for (let offset = 1; offset <= PRELOAD_RANGE; offset++) {
        if (effectiveIndex - offset >= 0) {
          const prevId = allScreenshotIds[effectiveIndex - offset]
          if (prevId && !screenshots.find(s => s.id === prevId)) {
            idsToFetch.push(prevId)
          }
        }
        if (effectiveIndex + offset < effectiveTotal) {
          const nextId = allScreenshotIds[effectiveIndex + offset]
          if (nextId && !screenshots.find(s => s.id === nextId)) {
            idsToFetch.push(nextId)
          }
        }
      }
      if (idsToFetch.length > 0) {
        onPreloadScreenshots(idsToFetch)
      }
    }
  }, [globalScreenshotIndex, selectedScreenshotIndex, screenshots, totalScreenshotCount, allScreenshotIds, onPreloadScreenshots])

  // Fullscreen functions
  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true)
    setCursorVisible(true)
    clearTimeout(cursorTimerRef.current)
    cursorTimerRef.current = setTimeout(() => setCursorVisible(false), 3000)
  }, [])

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    setIsFullscreen(false)
    setShowRestoreBtn(false)
    setCursorVisible(false)
    clearTimeout(hideRestoreTimerRef.current)
    clearTimeout(cursorTimerRef.current)
  }, [])

  // Sync isFullscreenRef
  useEffect(() => {
    isFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  // Request W3C fullscreen after overlay renders
  useEffect(() => {
    if (isFullscreen) {
      requestAnimationFrame(() => {
        const el = fullscreenOverlayRef.current
        if (el && !document.fullscreenElement) {
          el.requestFullscreen().catch(() => {})
        }
      })
    }
  }, [isFullscreen])

  // Listen for fullscreen changes (e.g., browser native Esc exit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreenRef.current) {
        setIsFullscreen(false)
        setShowRestoreBtn(false)
        setCursorVisible(false)
        clearTimeout(hideRestoreTimerRef.current)
        clearTimeout(cursorTimerRef.current)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Mouse tracking in fullscreen: cursor auto-hide + restore button in top-right
  useEffect(() => {
    if (!isFullscreen) return

    const handleMouseMove = (e) => {
      setCursorVisible(true)
      clearTimeout(cursorTimerRef.current)
      cursorTimerRef.current = setTimeout(() => setCursorVisible(false), 3000)

      const { x, y } = e
      const threshold = 80
      if (x > window.innerWidth - threshold && y < threshold) {
        setShowRestoreBtn(true)
        clearTimeout(hideRestoreTimerRef.current)
      } else {
        clearTimeout(hideRestoreTimerRef.current)
        hideRestoreTimerRef.current = setTimeout(() => setShowRestoreBtn(false), 1500)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(cursorTimerRef.current)
      clearTimeout(hideRestoreTimerRef.current)
    }
  }, [isFullscreen])

  // Cleanup fullscreen on unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const calculateModalWidth = () => {
    const { width, height } = imageDimensions
    if (width === 0 || height === 0) return 1200
    
    const maxHeight = windowHeight * 0.75
    const maxWidth = windowWidth * 0.95
    
    const aspectRatio = width / height
    
    let displayWidth = width
    let displayHeight = height
    
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight
      displayWidth = displayHeight * aspectRatio
    }
    
    if (displayWidth > maxWidth) {
      displayWidth = maxWidth
      displayHeight = displayWidth / aspectRatio
    }
    
    return Math.min(Math.max(displayWidth + 40, 600), maxWidth)
  }

  const modalWidth = calculateModalWidth()
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          if ((globalScreenshotIndex >= 0 ? globalScreenshotIndex : selectedScreenshotIndex) > 0) {
            onNavigate('prev')
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          {
            const idx = globalScreenshotIndex >= 0 ? globalScreenshotIndex : selectedScreenshotIndex
            const total = totalScreenshotCount > 0 ? totalScreenshotCount : screenshots.length
            if (idx < total - 1) {
              onNavigate('next')
            }
          }
          break
        case 'Enter':
          if (e.altKey) {
            e.preventDefault()
            if (isFullscreenRef.current) {
              exitFullscreen()
            } else {
              enterFullscreen()
            }
          }
          break
        case 'Escape':
          if (document.fullscreenElement) {
            // Browser will handle exiting fullscreen natively
            // Don't close the modal - second Esc will close it
            return
          }
          e.preventDefault()
          if (isFullscreenRef.current) {
            exitFullscreen()
          } else {
            onClose()
          }
          break
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

    const handleWheel = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return
      }
      
      let element = e.target
      while (element) {
        const style = window.getComputedStyle(element)
        const overflow = style.overflow + style.overflowY + style.overflowX
        if (/(auto|scroll)/.test(overflow)) {
          const hasScrollableContent = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth
          if (hasScrollableContent) {
            const atTop = element.scrollTop === 0
            const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1
            const atLeft = element.scrollLeft === 0
            const atRight = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1
            
            const scrollingDown = e.deltaY > 0
            const scrollingRight = e.deltaX > 0
            
            if ((scrollingDown && !atBottom) || (!scrollingDown && !atTop) ||
                (scrollingRight && !atRight) || (!scrollingRight && !atLeft)) {
              return
            }
          }
        }
        element = element.parentElement
      }
      
      e.preventDefault()
      
      if (e.deltaY > 0) {
        const idx = globalScreenshotIndex >= 0 ? globalScreenshotIndex : selectedScreenshotIndex
        const total = totalScreenshotCount > 0 ? totalScreenshotCount : screenshots.length
        if (idx < total - 1) {
          onNavigate('next')
        }
      } else if (e.deltaY < 0) {
        if ((globalScreenshotIndex >= 0 ? globalScreenshotIndex : selectedScreenshotIndex) > 0) {
          onNavigate('prev')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [globalScreenshotIndex, totalScreenshotCount, selectedScreenshot, onNavigate, onClose, onDelete, enterFullscreen, exitFullscreen])

  const effectiveGlobalIndex = globalScreenshotIndex >= 0 ? globalScreenshotIndex : selectedScreenshotIndex
  const effectiveTotalCount = totalScreenshotCount > 0 ? totalScreenshotCount : screenshots.length
  const canGoPrev = effectiveGlobalIndex > 0
  const canGoNext = effectiveGlobalIndex < effectiveTotalCount - 1

  if (!selectedScreenshot) return null

  return (
    <>
      {/* Fullscreen overlay - always in DOM for W3C fullscreen API, visibility controlled */}
      <div 
        ref={fullscreenOverlayRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          cursor: cursorVisible ? 'default' : 'none',
          opacity: isFullscreen ? 1 : 0,
          pointerEvents: isFullscreen ? 'auto' : 'none',
          transition: isFullscreen ? 'opacity 0.3s ease-in-out' : 'none',
        }}
      >
        {selectedScreenshot && (
          <img 
            src={fullImageSrc} 
            alt="截图" 
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              userSelect: 'none',
            }} 
          />
        )}
        {isFullscreen && showRestoreBtn && (
          <button
            onClick={exitFullscreen}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.45)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s, opacity 0.3s',
              opacity: showRestoreBtn ? 1 : 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.65)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.45)'}
            title="退出全屏 (Alt+Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h3v3"/>
              <path d="M20 10h-3V7"/>
              <path d="M14 21h3a2 2 0 0 0 2-2v-3"/>
              <path d="M10 3H7a2 2 0 0 0-2 2v3"/>
            </svg>
          </button>
        )}
      </div>

      {/* Normal modal */}
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
          width: modalWidth,
          maxWidth: '95vw',
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
            <span style={{ fontSize: 13, color: theme.text, fontWeight: 500 }}>
              {formatDate(selectedScreenshot.timestamp)}
            </span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>|</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              {formatGameTitle(selectedScreenshot.display_title, selectedScreenshot.game_title)}
            </span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>|</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              {imageDimensions.width > 0 ? `${imageDimensions.width} × ${imageDimensions.height}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={enterFullscreen}
              style={{
                width: 28,
                height: 28,
                background: 'transparent',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = theme.text
                e.currentTarget.style.background = theme.accent
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = theme.textMuted
                e.currentTarget.style.background = 'transparent'
              }}
              title="全屏 (Alt+Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            </button>
            <button style={styles.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: 8,
          minHeight: 0,
          position: 'relative'
        }}>
          {thumbnailSrc && !showFullImage && (
            <img 
              src={thumbnailSrc} 
              alt="截图预览" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: 'calc(95vh - 145px)',
                objectFit: 'contain',
                filter: isImageLoading ? 'blur(10px)' : 'blur(5px)',
                transition: 'filter 0.3s ease-out',
                position: 'absolute',
                opacity: isImageLoading ? 0.8 : 1
              }} 
            />
          )}
          
          {isImageLoading && (
            <div style={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}>
              <div style={{
                width: 40,
                height: 40,
                border: `3px solid ${theme.border}`,
                borderTopColor: theme.primary,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}
          
          <img 
            ref={imgRef}
            src={fullImageSrc} 
            alt="截图" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: 'calc(95vh - 145px)',
              objectFit: 'contain',
              opacity: showFullImage ? 1 : 0,
              transition: 'opacity 0.3s ease-out'
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
                background: canGoPrev ? theme.accent : 'transparent',
                border: `1px solid ${canGoPrev ? theme.border : 'transparent'}`,
                color: canGoPrev ? theme.text : theme.textMuted,
                cursor: canGoPrev ? 'pointer' : 'default',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                opacity: canGoPrev ? 1 : 0.4
              }}
              onMouseEnter={e => {
                if (canGoPrev) {
                  e.currentTarget.style.background = theme.border
                }
              }}
              onMouseLeave={e => {
                if (canGoPrev) {
                  e.currentTarget.style.background = theme.accent
                }
              }}
              onClick={() => onNavigate('prev')}
              disabled={!canGoPrev}
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
              {effectiveGlobalIndex + 1} / {effectiveTotalCount}
            </span>
            <button
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: canGoNext ? theme.accent : 'transparent',
                border: `1px solid ${canGoNext ? theme.border : 'transparent'}`,
                color: canGoNext ? theme.text : theme.textMuted,
                cursor: canGoNext ? 'pointer' : 'default',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                opacity: canGoNext ? 1 : 0.4
              }}
              onMouseEnter={e => {
                if (canGoNext) {
                  e.currentTarget.style.background = theme.border
                }
              }}
              onMouseLeave={e => {
                if (canGoNext) {
                  e.currentTarget.style.background = theme.accent
                }
              }}
              onClick={() => onNavigate('next')}
              disabled={!canGoNext}
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
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
    </>
  )
}
