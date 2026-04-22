import { useState, useRef, useEffect, useCallback } from 'react'

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
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  fontSize: 14,
                  fontFamily: 'system-ui, sans-serif',
                  color: active ? theme.primary : theme.text,
                  cursor: 'pointer',
                  borderRadius: 6,
                  position: 'relative',
                  transition: 'background 0.15s ease, transform 0.15s ease, color 0.15s ease',
                  background: 'transparent',
                  outline: 'none',
                  fontWeight: active ? 600 : 400,
                }}
                onClick={() => handleNavigate(item.key)}
                onKeyDown={(e) => handleItemKeyDown(e, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.accent
                  e.currentTarget.style.transform = 'translateX(2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transform = 'translateX(0)'
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
                <span style={{ paddingLeft: active ? 8 : 0, transition: 'padding-left 0.15s ease' }}>
                  {label}
                </span>
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
