export const createStyles = (theme, iconSize = 'large') => {
  const cardWidth = iconSize === 'large' ? 200 : 150
  const cardGap = iconSize === 'large' ? 16 : 12
  
  return {
    container: { display: 'flex', height: '100vh', background: theme.bg, color: theme.text, fontFamily: 'system-ui, sans-serif' },
    sidebar: { width: 200, background: theme.sidebar, padding: 16, display: 'flex', flexDirection: 'column' },
    sidebarTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 24, color: theme.primary },
    navItem: { padding: '12px 16px', cursor: 'pointer', borderRadius: 8, marginBottom: 4, transition: 'background 0.2s' },
    navItemActive: { background: theme.accent },
    main: { flex: 1, padding: 24, overflow: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 'bold' },
    btn: { padding: '8px 16px', background: theme.accent, border: 'none', borderRadius: 6, color: theme.text, cursor: 'pointer', transition: 'transform 0.15s, background 0.15s, opacity 0.15s' },
    btnPrimary: { padding: '8px 16px', background: theme.primary, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.15s, background 0.15s, opacity 0.15s' },
    btnDanger: { padding: '8px 16px', background: theme.danger, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', transition: 'transform 0.15s, background 0.15s, opacity 0.15s' },
    btnDisabled: { padding: '8px 16px', background: theme.accent, border: 'none', borderRadius: 6, color: theme.textMuted, cursor: 'not-allowed', opacity: 0.6, transition: 'transform 0.15s' },
    grid: { display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)`, gap: cardGap, justifyContent: 'flex-start' },
    card: { background: theme.card, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', width: cardWidth },
    cardImage: { width: '100%', aspectRatio: '16 / 9', objectFit: 'contain', background: theme.accent },
    cardInfo: { padding: 12 },
    cardTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    cardDate: { fontSize: 12, color: theme.textMuted },
    gameCard: { background: theme.card, borderRadius: 8, padding: 12, cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', width: cardWidth },
    gameIcon: { width: '100%', height: iconSize === 'large' ? 94 : 71, borderRadius: 6, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: iconSize === 'large' ? 32 : 24, overflow: 'hidden' },
    gameIconImage: { width: '100%', height: '100%', objectFit: 'contain' },
    gameLogoImage: { width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 },
    gameTitle: { fontWeight: 'bold', marginBottom: 4 },
    gameCount: { fontSize: 12, color: theme.textMuted },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: theme.card, borderRadius: 12, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' },
    modalHeader: { padding: 16, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    closeBtn: { background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: theme.textMuted, padding: 0, lineHeight: 1, transition: 'transform 0.15s, color 0.15s' },
    modalBody: { padding: 16 },
    modalFooter: { padding: 16, borderTop: `1px solid ${theme.border}` },
    input: { width: '100%', padding: 8, background: theme.accent, border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.text, boxSizing: 'border-box' },
    notification: { position: 'fixed', top: 16, right: 16, background: theme.primary, color: '#fff', padding: '12px 24px', borderRadius: 8, zIndex: 2000, fontWeight: 'bold' },
    debugPanel: { marginTop: 'auto', padding: 8, background: theme.accent, borderRadius: 4, fontSize: 10, maxHeight: 100, overflow: 'auto' },
    debugLine: { color: theme.primary, marginBottom: 2 },
    empty: { textAlign: 'center', padding: 48, color: theme.textMuted },
    loading: { textAlign: 'center', padding: 48, color: theme.primary },
    themeBtn: { padding: '10px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.15s, box-shadow 0.15s' },
    themeBtnActive: { transform: 'scale(1.05)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
    pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 16, background: theme.card, borderRadius: 8 },
    paginationBtn: { padding: '6px 12px', background: theme.accent, border: 'none', borderRadius: 4, color: theme.text, cursor: 'pointer', transition: 'transform 0.15s, opacity 0.15s' },
    paginationBtnActive: { background: theme.primary, color: '#fff' },
    paginationInfo: { fontSize: 14, color: theme.textMuted },
    selectCheckbox: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, border: `2px solid ${theme.border}`, borderRadius: 3, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    selectCheckboxChecked: { background: theme.primary, borderColor: theme.primary },
    selectCheckboxInner: { width: 8, height: 8, background: '#fff' },
    cardWithCheckbox: { position: 'relative' },
    cardSelected: { transform: 'scale(0.98)', boxShadow: `0 0 0 2px ${theme.primary}` },
    migrationProgress: { width: '100%', height: 8, background: theme.accent, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
    migrationProgressBar: { height: '100%', background: theme.primary, transition: 'width 0.3s ease' },
  }
}

export const btnEvents = {
  onMouseEnter: e => {
    e.currentTarget.style.transform = 'scale(1.05)'
    e.currentTarget.style.opacity = '0.9'
  },
  onMouseLeave: e => {
    e.currentTarget.style.transform = 'scale(1)'
    e.currentTarget.style.opacity = '1'
  },
  onMouseDown: e => {
    e.currentTarget.style.transform = 'scale(0.95)'
  },
  onMouseUp: e => {
    e.currentTarget.style.transform = 'scale(1.05)'
  }
}

export const modalKeyframes = `
  @keyframes modalFadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes modalFadeOut {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes slideInLeft {
    0% { opacity: 0; transform: translateX(-30px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes fadeOut {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes slideInRight {
    0% { opacity: 0; transform: translateX(100%); }
    100% { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOutRight {
    0% { opacity: 1; transform: translateX(0); }
    100% { opacity: 0; transform: translateX(100%); }
  }
`
