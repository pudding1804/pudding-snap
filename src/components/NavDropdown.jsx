import { useState, useRef, useEffect, useCallback } from 'react'

const ICONS = {
  time: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  games: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="15" y1="13" x2="15.01" y2="13" />
      <line x1="18" y1="11" x2="18.01" y2="11" />
      <rect x="2" y="6" width="20" height="12" rx="2" />
    </svg>
  ),
  'recycle-bin': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
}

const NAV_ITEMS = [
  { key: 'time', labelKey: 'time' },
  { key: 'games', labelKey: 'games' },
  { key: 'recycle-bin', labelKey: 'recycle_bin' },
  { key: 'settings', labelKey: 'settings' },
]

const OPEN_DELAY = 200
const CLOSE_DELAY = 300

export function NavDropdown({ theme, currentView, t, recycleBinCount = 0, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const openTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const containerRef = useRef(null)
  const menuRef = useRef(null)
  const itemRefs = useRef([])

  const currentLabel = currentView === 'game-detail'
    ? t.nav.games
    : t.nav[NAV_ITEMS.find(n => n.key === currentView)?.labelKey] || t.nav.time

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
  }, [])

  const openMenu = useCallback(() => {
    clearTimers()
    openTimerRef.current = setTimeout(() => {
      setIsOpen(true)
      requestAnimationFrame(() => setIsVisible(true))
      setFocusedIndex(-1)
    }, OPEN_DELAY)
  }, [clearTimers])

  const closeMenu = useCallback(() => {
    clearTimers()
    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => setIsOpen(false), 200)
      setFocusedIndex(-1)
    }, CLOSE_DELAY)
  }, [clearTimers])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        clearTimers()
        setIsVisible(false)
        setTimeout(() => setIsOpen(false), 200)
        setFocusedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, clearTimers])

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex].focus()
    }
  }, [focusedIndex])

  const handleNavigate = useCallback((view) => {
    onNavigate(view)
    clearTimers()
    setIsVisible(false)
    setTimeout(() => setIsOpen(false), 200)
    setFocusedIndex(-1)
  }, [onNavigate, clearTimers])

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isOpen) {
        setIsVisible(false)
        setTimeout(() => setIsOpen(false), 200)
      } else {
        setIsOpen(true)
        requestAnimationFrame(() => setIsVisible(true))
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        requestAnimationFrame(() => setIsVisible(true))
      }
      setFocusedIndex(0)
    }
  }

  const handleItemKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleNavigate(NAV_ITEMS[index].key)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((index + 1) % NAV_ITEMS.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(index === 0 ? NAV_ITEMS.length - 1 : index - 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsVisible(false)
      setTimeout(() => setIsOpen(false), 200)
      setFocusedIndex(-1)
    } else if (e.key === 'Tab') {
      setIsVisible(false)
      setTimeout(() => setIsOpen(false), 200)
      setFocusedIndex(-1)
    }
  }

  const isActive = (key) => {
    if (key === 'games') return currentView === 'games' || currentView === 'game-detail'
    return currentView === key
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => { cancelClose(); openMenu() }}
      onMouseLeave={closeMenu}
    >
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          border: 'none',
          borderRadius: 6,
          background: isOpen ? theme.accent : 'transparent',
          color: theme.text,
          cursor: 'pointer',
          fontSize: 24,
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 'bold',
          transition: 'background 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = theme.accent }}
        onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span>{currentLabel}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 180,
            background: theme.card,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            border: `1px solid ${theme.border}`,
            padding: 4,
            zIndex: 200,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={closeMenu}
        >
          {NAV_ITEMS.map((item, index) => {
            const active = isActive(item.key)
            const label = t.nav[item.labelKey]
            const isRecycleBin = item.key === 'recycle-bin'

            return (
              <div
                key={item.key}
                ref={(el) => { itemRefs.current[index] = el }}
                role="menuitem"
                tabIndex={-1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  fontSize: 14,
                  fontFamily: 'system-ui, sans-serif',
                  color: active ? theme.primary : theme.text,
                  cursor: 'pointer',
                  borderRadius: 6,
                  position: 'relative',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  background: 'transparent',
                  outline: 'none',
                  fontWeight: active ? 600 : 400,
                  gap: 10,
                }}
                onClick={() => handleNavigate(item.key)}
                onKeyDown={(e) => handleItemKeyDown(e, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.accent
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = theme.accent
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: 6,
                    bottom: 6,
                    width: 3,
                    borderRadius: 2,
                    background: theme.primary,
                  }} />
                )}
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  opacity: active ? 1 : 0.7,
                  transition: 'opacity 0.15s ease',
                  marginLeft: active ? 5 : 0,
                }}>
                  {ICONS[item.key]}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {isRecycleBin && recycleBinCount > 0 && (
                  <span style={{
                    background: '#e74c3c',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 'bold',
                    minWidth: 18,
                    textAlign: 'center',
                    lineHeight: '16px',
                  }}>
                    {recycleBinCount > 99 ? '99+' : recycleBinCount}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
