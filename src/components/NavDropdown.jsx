export function NavDropdown({ theme, currentView, t, onNavigate }) {
  const tabs = [
    { key: 'time', label: t.nav.time },
    { key: 'games', label: t.nav.games },
  ]

  const isActive = (key) => {
    if (key === 'games') return currentView === 'games' || currentView === 'game-detail'
    return currentView === key
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: theme.accent,
      borderRadius: 8,
      padding: 4,
      gap: 2,
    }}>
      {tabs.map(tab => {
        const active = isActive(tab.key)
        return (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.key)}
            style={{
              padding: '7px 16px',
              border: 'none',
              borderRadius: 6,
              background: active ? theme.primary : 'transparent',
              color: active ? '#fff' : theme.text,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: active ? 600 : 400,
              transition: 'background 0.2s ease, color 0.2s ease',
              whiteSpace: 'nowrap',
              outline: 'none',
              lineHeight: '18px',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = theme.card
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
