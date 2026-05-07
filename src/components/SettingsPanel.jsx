import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
  shutterSound,
  screenshotFormat,
  screenshotQuality,
  bangumiAccessToken,
  bangumiCookie,
  onLanguageChange,
  onSteamLanguageChange,
  onThemeChange,
  onChangeStoragePath,
  onAutostartChange,
  onShutterSoundChange,
  onPlaySoundPreview,
  onScreenshotFormatChange,
  onScreenshotQualityChange,
  onBangumiAuthChange,
  onDeleteAll,
  backupEnabled,
  onBackupEnabledChange,
  onManualBackup,
  screenshotNotificationEnabled,
  onScreenshotNotificationChange,
  windowTitleMatchEnabled,
  onWindowTitleMatchChange,
  activeHotkeys,
  onActiveHotkeysChange,
  emulatorKeywords,
  onEmulatorKeywordsChange,
  onSaveEmulatorKeywords,
  emulatorKeywordsSaved,
  onNavigate,
}) {
  const [backupStatus, setBackupStatus] = useState('')
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button 
          style={{ ...styles.btn, padding: '8px 12px' }} 
          {...btnEvents}
          onClick={() => onNavigate && onNavigate('back')}
          title={t.nav.back || '返回'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>
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
            {Object.entries(themes).map(([key, th]) => {
              const isSelected = currentTheme === key
              return (
                <button
                  key={key}
                  onClick={() => onThemeChange(key)}
                  style={{
                    ...styles.themeBtn,
                    background: th.colors.primary,
                    color: '#fff',
                    position: 'relative',
                    outline: isSelected ? '3px solid #fff' : 'none',
                    outlineOffset: isSelected ? '2px' : '0',
                    boxShadow: isSelected ? `0 0 0 1px ${th.colors.primary}, 0 4px 12px rgba(0,0,0,0.3)` : 'none',
                    opacity: isSelected ? 1 : 0.75,
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
                      e.currentTarget.style.opacity = '1'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.opacity = '0.75'
                    }
                  }}
                  onMouseDown={e => {
                    e.currentTarget.style.transform = 'translateY(1px)'
                  }}
                  onMouseUp={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {isSelected && '✓ '}{th.name}
                </button>
              )
            })}
          </div>
        </div>
        
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.storage}</h3>
          <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
            {t.settings.current_path} {storagePath}
          </p>
          <button 
            style={styles.btnPrimary} 
            {...btnEvents}
            onClick={onChangeStoragePath}
            disabled={isMigrating}
          >
            {isMigrating ? t.settings.migrating : t.settings.change_path}
          </button>
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
          <p style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
            提示：如果选择已有数据目录，将直接切换；否则将迁移当前数据到新目录。
          </p>
        </div>
        
        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>{t.settings.hotkeys}</h3>
          {[
            { id: 'printscreen', label: 'PrintScreen' },
            { id: 'f11', label: 'F11' },
            { id: 'f12', label: 'F12' },
          ].map(key => (
            <div key={key.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <input
                type="checkbox"
                id={`hotkey_${key.id}`}
                checked={activeHotkeys.includes(key.id)}
                onChange={(e) => {
                  const newKeys = e.target.checked
                    ? [...activeHotkeys, key.id]
                    : activeHotkeys.filter(k => k !== key.id)
                  onActiveHotkeysChange(newKeys)
                }}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor={`hotkey_${key.id}`} style={{ cursor: 'pointer', color: theme.text, fontSize: 14 }}>
                {key.label}
              </label>
            </div>
          ))}
          <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
            {t.settings.hotkey_hint}
          </p>
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
          
          <div style={{ marginTop: 0, paddingTop: 0 }}>
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
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (shutterSound !== sound.id) {
                      e.currentTarget.style.boxShadow = 'none'
                    }
                  }}
                >
                  {sound.name}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                id="screenshot_notification"
                checked={screenshotNotificationEnabled}
                onChange={(e) => onScreenshotNotificationChange(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor="screenshot_notification" style={{ cursor: 'pointer', color: theme.text, fontSize: 14 }}>
                {t.settings.screenshot_notification}
              </label>
            </div>
            <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
              {t.settings.screenshot_notification_hint}
            </p>
          </div>
          
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                id="window_title_match"
                checked={windowTitleMatchEnabled}
                onChange={(e) => onWindowTitleMatchChange(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor="window_title_match" style={{ cursor: 'pointer', color: theme.text, fontSize: 14 }}>
                {t.settings.window_title_match}
              </label>
            </div>
            <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
              {t.settings.window_title_match_hint}
            </p>
          </div>
          
          {false && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
            <h4 style={{ marginBottom: 8, color: theme.text, fontSize: 14 }}>
              {t.settings.emulator_keywords}
            </h4>
            <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 10 }}>
              {t.settings.emulator_keywords_hint}
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="text"
                value={emulatorKeywords}
                onChange={(e) => onEmulatorKeywordsChange(e.target.value)}
                placeholder="dosbox, retroarch, pcsx2, ..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: theme.primary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  color: theme.text,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                style={{
                  ...styles.btn,
                  padding: '8px 16px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                {...btnEvents}
                onClick={onSaveEmulatorKeywords}
              >
                {emulatorKeywordsSaved ? t.settings.emulator_keywords_saved : t.settings.emulator_keywords_save}
              </button>
            </div>
          </div>
          )}
          
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
          <h3 style={{ marginBottom: 12 }}>{t.settings.backup_title}</h3>
          <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
            {t.settings.backup_hint}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              cursor: 'pointer',
              fontSize: 14,
              color: theme.text
            }}>
              <input 
                type="checkbox" 
                checked={backupEnabled || false}
                onChange={(e) => onBackupEnabledChange(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              {t.settings.backup_daily}
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={{
                ...styles.btnPrimary,
                padding: '8px 16px',
                fontSize: 13
              }}
              {...btnEvents}
              onClick={async () => {
                try {
                  setBackupStatus(t.settings.backup_in_progress)
                  await onManualBackup()
                  setBackupStatus(t.settings.backup_success)
                  setTimeout(() => setBackupStatus(''), 3000)
                } catch (e) {
                  setBackupStatus(t.settings.backup_failed + ': ' + String(e))
                  setTimeout(() => setBackupStatus(''), 5000)
                }
              }}
            >
              {t.settings.backup_manual}
            </button>
            {backupStatus && (
              <span style={{ fontSize: 12, color: backupStatus.includes(t.settings.backup_failed) ? '#e74c3c' : theme.primary }}>
                {backupStatus}
              </span>
            )}
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

        <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Bangumi 认证</h3>
          <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>
            部分 Bangumi 游戏需要登录才能搜索。请输入您的 Access Token 或 Cookie。
          </p>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: theme.textMuted }}>
              Access Token
            </label>
            <input
              type="password"
              value={bangumiAccessToken || ''}
              onChange={(e) => onBangumiAuthChange(e.target.value, bangumiCookie)}
              placeholder="输入 Bangumi Access Token"
              style={{ 
                ...styles.input, 
                width: '100%',
                fontSize: 12
              }}
            />
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: theme.textMuted }}>
              Cookie (可选)
            </label>
            <textarea
              value={bangumiCookie || ''}
              onChange={(e) => onBangumiAuthChange(bangumiAccessToken, e.target.value)}
              placeholder="输入 Bangumi Cookie"
              style={{ 
                ...styles.input, 
                width: '100%',
                minHeight: 60,
                fontSize: 12,
                resize: 'vertical'
              }}
            />
          </div>
          
          <button
            style={{
              ...styles.btnPrimary,
              width: '100%',
              padding: '10px 16px',
              fontSize: 14,
              marginTop: 8
            }}
            {...btnEvents}
            onClick={() => onBangumiAuthChange(bangumiAccessToken, bangumiCookie, true)}
          >
            保存认证信息
          </button>
          
          <p style={{ color: theme.textMuted, fontSize: 11, marginTop: 8 }}>
            提示：您可以在 next.bgm.tv/demo/access-token 生成 Access Token
          </p>
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
