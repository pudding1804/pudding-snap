import { btnEvents } from '../styles/sharedStyles'

const ESTIMATED_SIZES = {
  jpg: { low: { '1080p': '~200KB', '4k': '~800KB' }, medium: { '1080p': '~500KB', '4k': '~2MB' }, high: { '1080p': '~1MB', '4k': '~4MB' } },
  png: { low: { '1080p': '~1MB', '4k': '~4MB' }, medium: { '1080p': '~2MB', '4k': '~8MB' }, high: { '1080p': '~3MB', '4k': '~12MB' } },
  webp: { low: { '1080p': '~150KB', '4k': '~600KB' }, medium: { '1080p': '~300KB', '4k': '~1.2MB' }, high: { '1080p': '~600KB', '4k': '~2.4MB' } }
}

export function SettingsPanel({
  theme,
  styles,
  t,
  themes,
  language,
  steamLanguage,
  currentTheme,
  storagePath,
  isMigrating,
  migrationProgress,
  migrationTotal,
  migrationStatus,
  autostart,
  captureMouse,
  shutterSound,
  screenshotFormat,
  screenshotQuality,
  onLanguageChange,
  onSteamLanguageChange,
  onThemeChange,
  onChangeStoragePath,
  onImportDirectory,
  onAutostartChange,
  onCaptureMouseChange,
  onShutterSoundChange,
  onPlaySoundPreview,
  onScreenshotFormatChange,
  onScreenshotQualityChange,
  onDeleteAll,
}) {
  return (
    <div>
      <h1 style={styles.title}>{t.settings.title}</h1>
      <div style={{ marginTop: 24 }}>
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.language}</h3>
          <select 
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              background: theme.primary, 
              border: 'none', 
              borderRadius: 6, 
              color: theme.text, 
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            <option value="zh">{t.settings.languages.zh}</option>
            <option value="en">{t.settings.languages.en}</option>
            <option value="ja">{t.settings.languages.ja}</option>
          </select>
        </div>
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.steam_language}</h3>
          <select 
            value={steamLanguage}
            onChange={(e) => onSteamLanguageChange(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              background: theme.primary, 
              border: 'none', 
              borderRadius: 6, 
              color: theme.text, 
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            <option value="schinese">{t.settings.steam_languages.schinese}</option>
            <option value="english">{t.settings.steam_languages.english}</option>
            <option value="japanese">{t.settings.steam_languages.japanese}</option>
          </select>
        </div>
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.theme}</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(themes).map(([key, th]) => (
              <button
                key={key}
                onClick={() => onThemeChange(key)}
                style={{
                  ...styles.themeBtn,
                  ...(currentTheme === key ? styles.themeBtnActive : {}),
                  background: th.colors.primary,
                  color: key === 'night' ? '#fff' : '#333',
                }}
                onMouseEnter={e => {
                  if (currentTheme !== key) {
                    e.currentTarget.style.transform = 'scale(1.05)'
                  }
                }}
                onMouseLeave={e => {
                  if (currentTheme !== key) {
                    e.currentTarget.style.transform = 'scale(1)'
                  }
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'scale(0.95)'
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = currentTheme === key ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                {th.name}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.storage}</h3>
          <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
            {t.settings.current_path} {storagePath}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button 
              style={styles.btnPrimary} 
              {...btnEvents}
              onClick={onChangeStoragePath}
              disabled={isMigrating}
            >
              {isMigrating ? t.settings.migrating : t.settings.change_path}
            </button>
            <button 
              style={{ ...styles.btn, borderColor: theme.primary, color: theme.primary }} 
              {...btnEvents}
              onClick={onImportDirectory}
              disabled={isMigrating}
            >
              {t.settings.import_directory || '导入已有目录'}
            </button>
          </div>
          {isMigrating && (
            <div style={{ marginTop: 12 }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: 4,
                fontSize: 12,
                color: theme.textMuted
              }}>
                <span>{migrationStatus || '准备迁移...'}</span>
                <span>{migrationProgress}/{migrationTotal}</span>
              </div>
              <div style={styles.migrationProgress}>
                <div 
                  style={{
                    ...styles.migrationProgressBar,
                    width: `${migrationTotal > 0 ? (migrationProgress / migrationTotal * 100) : 0}%`
                  }}
                />
              </div>
            </div>
          )}
          <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
            {t.settings.storage_hint}
          </p>
        </div>
        
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.hotkeys}</h3>
          <p style={{ color: theme.textMuted, fontSize: 14 }}>{t.settings.hotkey_print}</p>
          <p style={{ color: theme.textMuted, fontSize: 14 }}>{t.settings.hotkey_f12}</p>
        </div>

        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.system}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              id="autostart"
              checked={autostart}
              onChange={(e) => onAutostartChange(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="autostart" style={{ cursor: 'pointer', color: theme.text }}>
              {t.settings.autostart}
            </label>
          </div>
          <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
            {t.settings.autostart_hint}
          </p>
        </div>

        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.screenshot}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              id="captureMouse"
              checked={captureMouse}
              onChange={(e) => onCaptureMouseChange(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="captureMouse" style={{ cursor: 'pointer', color: theme.text }}>
              {t.settings.capture_mouse}
            </label>
          </div>
          <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
            {t.settings.capture_mouse_hint}
          </p>
          
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
            <h4 style={{ marginBottom: 12 }}>{t.settings.shutter_sound}</h4>
            <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>
              {t.settings.shutter_sound_hint}
            </p>
            
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'none', name: t.settings.sound_none },
                { id: 'default', name: t.settings.sound_default },
                { id: 'camera1', name: t.settings.sound_camera1 },
                { id: 'camera2', name: t.settings.sound_camera2 },
                { id: 'click', name: t.settings.sound_click },
                { id: 'soft', name: t.settings.sound_soft },
                { id: 'digital', name: t.settings.sound_digital }
              ].map(sound => (
                <button
                  key={sound.id}
                  onClick={() => {
                    onShutterSoundChange(sound.id)
                    if (sound.id !== 'none') {
                      onPlaySoundPreview(sound.id)
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    background: shutterSound === sound.id ? theme.primary : theme.accent,
                    border: `1px solid ${shutterSound === sound.id ? theme.primary : theme.border}`,
                    borderRadius: 6,
                    color: shutterSound === sound.id ? '#fff' : theme.text,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    if (shutterSound !== sound.id) {
                      e.currentTarget.style.background = theme.accent
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (shutterSound !== sound.id) {
                      e.currentTarget.style.transform = 'scale(1)'
                    }
                  }}
                >
                  {sound.name}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
            <h4 style={{ marginBottom: 12 }}>{t.settings.screenshot_quality}</h4>
            <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>
              {t.settings.quality_hint}
            </p>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: theme.text, fontSize: 13 }}>
                {t.settings.format}
              </label>
              <select 
                value={screenshotFormat || 'jpg'}
                onChange={(e) => onScreenshotFormatChange(e.target.value)}
                style={{ 
                  padding: '8px 12px', 
                  background: theme.primary, 
                  border: 'none', 
                  borderRadius: 6, 
                  color: theme.text, 
                  cursor: 'pointer',
                  fontSize: 14,
                  width: '100%'
                }}
              >
                <option value="jpg">{t.settings.format_jpg}</option>
                <option value="png">{t.settings.format_png}</option>
                <option value="webp">{t.settings.format_webp}</option>
              </select>
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, color: theme.text, fontSize: 13 }}>
                {t.settings.quality}
              </label>
              <select 
                value={screenshotQuality || 'medium'}
                onChange={(e) => onScreenshotQualityChange(e.target.value)}
                style={{ 
                  padding: '8px 12px', 
                  background: theme.primary, 
                  border: 'none', 
                  borderRadius: 6, 
                  color: theme.text, 
                  cursor: 'pointer',
                  fontSize: 14,
                  width: '100%'
                }}
              >
                <option value="low">{t.settings.quality_low}</option>
                <option value="medium">{t.settings.quality_medium}</option>
                <option value="high">{t.settings.quality_high}</option>
              </select>
            </div>
            
            <div style={{ 
              background: theme.accent, 
              padding: 12, 
              borderRadius: 6,
              marginTop: 12,
              border: `1px solid ${theme.border}`
            }}>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>
                {t.settings.estimated_size}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>{t.settings.resolution_1080p}: </span>
                  <span style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>
                    {ESTIMATED_SIZES[screenshotFormat || 'jpg']?.[screenshotQuality || 'medium']?.['1080p'] || '-'}
                  </span>
                </div>
                <div>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>{t.settings.resolution_4k}: </span>
                  <span style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>
                    {ESTIMATED_SIZES[screenshotFormat || 'jpg']?.[screenshotQuality || 'medium']?.['4k'] || '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.delete_all}</h3>
          <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
            {t.settings.delete_all_hint}
          </p>
          <button 
            style={{ 
              ...styles.btnDanger, 
              width: '100%',
              padding: '10px 16px',
              fontSize: 14
            }} 
            {...btnEvents}
            onClick={onDeleteAll}
          >
            {t.settings.delete_all}
          </button>
        </div>

        <div style={{ background: theme.card, padding: 16, borderRadius: 8 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.about}</h3>
          <p style={{ color: theme.textMuted, fontSize: 14 }}>{t.settings.version}</p>
          <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>{t.settings.tech}</p>
        </div>
      </div>
    </div>
  )
}
