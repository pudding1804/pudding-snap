import { useState, useRef, useEffect } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { toPng, toJpeg, toBlob } from 'html-to-image'

const STYLE_TYPES = [
  { id: 'minimalist', name: '极简', nameEn: 'Minimalist' },
  { id: 'cyberpunk', name: '赛博', nameEn: 'Cyberpunk' },
  { id: 'polaroid', name: '拍立得', nameEn: 'Polaroid' },
  { id: 'vaporwave', name: '蒸汽波', nameEn: 'Vaporwave' },
  { id: 'editorial', name: '杂志', nameEn: 'Editorial' }
]

const EXPORT_FORMATS = [
  { id: 'png', name: 'PNG' },
  { id: 'jpg', name: 'JPG' }
]

const CARD_WIDTH = 720
const CARD_HEIGHT = 540

function getImageSrc(path) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try {
    return convertFileSrc(path)
  } catch {
    return path
  }
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}.${month}.${day} ${hour}:${minute}:${second}`
}

function ShareCard({ 
  styleType, 
  screenshot, 
  gameInfo, 
  note, 
  username, 
  cardRef 
}) {
  const gameTitle = gameInfo?.display_title || gameInfo?.game_title || '未知游戏'
  const displayUsername = username || 'Player'
  const dateTime = formatDateTime(screenshot.timestamp)
  const imageSrc = getImageSrc(screenshot.file_path)

  const baseStyle = {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxSizing: 'border-box',
    overflow: 'hidden'
  }

  const renderMinimalist = () => (
    <div style={{
      ...baseStyle,
      background: '#ffffff',
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }} ref={cardRef}>
      <div style={{ 
        flex: 1,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20
      }}>
        <img 
          src={imageSrc} 
          alt="截图" 
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
        />
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ 
          fontSize: 28, 
          fontWeight: 300, 
          color: '#1a1a1a', 
          marginBottom: 8,
          letterSpacing: '-0.5px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {gameTitle}
        </div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 15, 
            color: '#555', 
            lineHeight: 1.6,
            fontStyle: 'italic',
            marginBottom: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            "{note}"
          </div>
        )}
        <div style={{ fontSize: 12, color: '#999' }}>
          by {displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 14,
        fontSize: 10,
        color: 'rgba(0,0,0,0.2)',
        fontWeight: 500,
        letterSpacing: '0.3px'
      }}>
        PuddingSnap
      </div>
    </div>
  )

  const renderCyberpunk = () => (
    <div style={{
      ...baseStyle,
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 100%)',
      padding: 20,
      fontFamily: '"Courier New", monospace',
      border: '2px solid #ff00ff',
      boxShadow: '0 0 30px rgba(255,0,255,0.3)'
    }} ref={cardRef}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'linear-gradient(90deg, transparent, #ff00ff, #00ffff, transparent)'
      }} />
      <div style={{ 
        flex: 1,
        overflow: 'hidden',
        border: '1px solid #00ffff',
        boxShadow: '0 0 20px rgba(0,255,255,0.4)',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
      }}>
        <img 
          src={imageSrc} 
          alt="截图" 
          style={{ 
            maxWidth: '100%', 
            maxHeight: '100%', 
            objectFit: 'contain',
            filter: 'contrast(1.1) saturate(1.2)'
          }} 
        />
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ 
          fontSize: 22, 
          fontWeight: 'bold', 
          color: '#00ffff', 
          marginBottom: 6,
          textShadow: '0 0 10px rgba(0,255,255,0.8)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {gameTitle}
        </div>
        <div style={{ 
          fontSize: 13, 
          color: '#ff00ff', 
          marginBottom: 10,
          textShadow: '0 0 5px rgba(255,0,255,0.5)'
        }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 14, 
            color: '#ddd', 
            lineHeight: 1.5,
            marginBottom: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            "{note}"
          </div>
        )}
        <div style={{ 
          fontSize: 12, 
          color: '#ff00ff',
          letterSpacing: '1px'
        }}>
          @{displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 9,
        color: 'rgba(0,255,255,0.25)',
        letterSpacing: '1px',
        textTransform: 'uppercase'
      }}>
        PuddingSnap
      </div>
    </div>
  )

  const renderPolaroid = () => (
    <div style={{
      ...baseStyle,
      background: '#f5f5f0',
      padding: 20,
      fontFamily: '"Georgia", serif',
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
    }} ref={cardRef}>
      <div style={{ 
        width: '100%',
        background: '#fff',
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        flex: 1,
        overflow: 'hidden'
      }}>
        <img 
          src={imageSrc} 
          alt="截图" 
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
        />
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ 
          fontSize: 22, 
          fontWeight: 'normal', 
          color: '#333', 
          marginBottom: 6,
          fontFamily: '"Georgia", serif',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {gameTitle}
        </div>
        <div style={{ 
          fontSize: 14, 
          color: '#666', 
          marginBottom: 10,
          fontFamily: '"Courier New", monospace'
        }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 15, 
            color: '#555', 
            lineHeight: 1.5,
            fontStyle: 'italic',
            marginBottom: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            "{note}"
          </div>
        )}
        <div style={{ fontSize: 12, color: '#777' }}>
          by {displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 9,
        color: 'rgba(0,0,0,0.18)',
        fontWeight: 500
      }}>
        PuddingSnap
      </div>
    </div>
  )

  const renderVaporwave = () => (
    <div style={{
      ...baseStyle,
      background: 'linear-gradient(180deg, #ff71ce 0%, #01cdfe 50%, #05ffa1 100%)',
      padding: 20,
      fontFamily: '"Courier New", monospace'
    }} ref={cardRef}>
      <div style={{ 
        flex: 1,
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
      }}>
        <div style={{ 
          width: 'calc(100% - 24px)',
          height: 'calc(100% - 24px)',
          margin: 12,
          overflow: 'hidden',
          borderRadius: 4,
          border: '3px solid #ff71ce',
          boxShadow: '0 0 25px rgba(255,113,206,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img 
            src={imageSrc} 
            alt="截图" 
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
          />
        </div>
      </div>
      <div style={{ 
        background: 'rgba(0,0,0,0.75)',
        borderRadius: 8,
        padding: 16,
        textAlign: 'center',
        flexShrink: 0
      }}>
        <div style={{ 
          fontSize: 20, 
          fontWeight: 'bold', 
          color: '#fff', 
          marginBottom: 6,
          textShadow: '2px 2px 0 #ff71ce',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {gameTitle}
        </div>
        <div style={{ 
          fontSize: 13, 
          color: '#05ffa1', 
          marginBottom: 10,
          fontWeight: 'bold'
        }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 14, 
            color: '#fff', 
            lineHeight: 1.5,
            marginBottom: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            "{note}"
          </div>
        )}
        <div style={{ 
          fontSize: 12, 
          color: '#01cdfe'
        }}>
          @{displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 9,
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.5px'
      }}>
        PuddingSnap
      </div>
    </div>
  )

  const renderEditorial = () => (
    <div style={{
      ...baseStyle,
      background: '#1a1a1a',
      fontFamily: '"Georgia", serif'
    }} ref={cardRef}>
      <div style={{ 
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111'
      }}>
        <img 
          src={imageSrc} 
          alt="截图" 
          style={{ 
            maxWidth: '100%', 
            maxHeight: '100%', 
            objectFit: 'contain'
          }} 
        />
      </div>
      <div style={{ 
        background: 'linear-gradient(180deg, rgba(30,30,30,0.95), rgba(10,10,10,0.98))',
        padding: 24,
        textAlign: 'center',
        flexShrink: 0
      }}>
        <div style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          color: '#fff', 
          marginBottom: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {gameTitle}
        </div>
        <div style={{ 
          fontSize: 13, 
          color: 'rgba(255,255,255,0.5)', 
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 15, 
            color: 'rgba(255,255,255,0.7)', 
            lineHeight: 1.6,
            fontStyle: 'italic',
            marginBottom: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            "{note}"
          </div>
        )}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          by {displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 9,
        color: 'rgba(255,255,255,0.18)',
        letterSpacing: '0.3px'
      }}>
        PuddingSnap
      </div>
    </div>
  )

  switch (styleType) {
    case 'minimalist': return renderMinimalist()
    case 'cyberpunk': return renderCyberpunk()
    case 'polaroid': return renderPolaroid()
    case 'vaporwave': return renderVaporwave()
    case 'editorial': return renderEditorial()
    default: return renderMinimalist()
  }
}

export function ShareModal({
  theme,
  styles,
  t,
  screenshot,
  gameInfo,
  onClose,
  username,
  onUsernameChange,
  onExport
}) {
  const [styleType, setStyleType] = useState('minimalist')
  const [exportFormat, setExportFormat] = useState('png')
  const [isExporting, setIsExporting] = useState(false)
  const [showUsernameInput, setShowUsernameInput] = useState(false)
  const [tempUsername, setTempUsername] = useState(username || '')
  const [editNote, setEditNote] = useState(screenshot?.note || '')
  const cardRef = useRef(null)

  useEffect(() => {
    if (!username) {
      setShowUsernameInput(true)
    }
  }, [username])

  const handleSaveUsername = () => {
    if (tempUsername.trim()) {
      onUsernameChange(tempUsername.trim())
      setShowUsernameInput(false)
    }
  }

  const handleExport = async () => {
    if (!cardRef.current) return
    
    setIsExporting(true)
    try {
      const options = {
        quality: exportFormat === 'jpg' ? 0.85 : 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      }

      let dataUrl
      if (exportFormat === 'png') {
        dataUrl = await toPng(cardRef.current, options)
      } else {
        dataUrl = await toJpeg(cardRef.current, options)
      }
      await onExport(dataUrl, exportFormat)
    } catch (err) {
      console.error('导出失败:', err)
    }
    setIsExporting(false)
  }

  const handleCopyToClipboard = async () => {
    if (!cardRef.current) return
    
    setIsExporting(true)
    try {
      const blob = await toBlob(cardRef.current, {
        quality: 1,
        pixelRatio: 2
      })
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
      }
    } catch (err) {
      console.error('复制失败:', err)
    }
    setIsExporting(false)
  }

  if (!screenshot) return null

  return (
    <div style={styles.modal} onClick={onClose}>
      <div 
        style={{ 
          ...styles.modalContent, 
          width: '95vw', 
          maxWidth: 1000,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ 
          ...styles.modalHeader, 
          padding: '12px 16px',
          flexShrink: 0
        }}>
          <h3 style={styles.modalTitle}>{t.share?.title || '分享截图'}</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={{ 
          flex: 1, 
          display: 'flex', 
          gap: 20, 
          padding: 16,
          overflow: 'auto',
          minHeight: 0
        }}>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: theme.accent,
            borderRadius: 8,
            padding: 20,
            overflow: 'auto'
          }}>
            <ShareCard
              styleType={styleType}
              screenshot={screenshot}
              gameInfo={gameInfo}
              note={editNote}
              username={username || 'Player'}
              cardRef={cardRef}
            />
          </div>

          <div style={{ 
            width: 180, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12,
            flexShrink: 0
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 11, 
                color: theme.textMuted, 
                marginBottom: 6,
                fontWeight: 500
              }}>
                {t.share?.style || '样式'}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STYLE_TYPES.map(style => (
                  <button
                    key={style.id}
                    style={{
                      padding: '5px 8px',
                      fontSize: 11,
                      borderRadius: 4,
                      border: styleType === style.id ? `1px solid ${theme.primary}` : `1px solid ${theme.border}`,
                      background: styleType === style.id ? theme.primary : theme.accent,
                      color: styleType === style.id ? '#fff' : theme.text,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onClick={() => setStyleType(style.id)}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 11, 
                color: theme.textMuted, 
                marginBottom: 6,
                fontWeight: 500
              }}>
                {t.share?.format || '格式'}
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {EXPORT_FORMATS.map(format => (
                  <button
                    key={format.id}
                    style={{
                      padding: '5px 10px',
                      fontSize: 11,
                      borderRadius: 4,
                      border: exportFormat === format.id ? `1px solid ${theme.primary}` : `1px solid ${theme.border}`,
                      background: exportFormat === format.id ? theme.primary : theme.accent,
                      color: exportFormat === format.id ? '#fff' : theme.text,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onClick={() => setExportFormat(format.id)}
                  >
                    {format.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 11, 
                color: theme.textMuted, 
                marginBottom: 6,
                fontWeight: 500
              }}>
                {t.share?.note || '附注'}
              </label>
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                maxLength={100}
                placeholder={t.share?.note_placeholder || '添加附注...'}
                style={{ 
                  width: '100%',
                  height: 50,
                  resize: 'none',
                  fontSize: 12,
                  padding: 6,
                  borderRadius: 4,
                  border: `1px solid ${theme.border}`,
                  background: theme.accent,
                  color: theme.text,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: 6
              }}>
                <label style={{ 
                  fontSize: 11, 
                  color: theme.textMuted,
                  fontWeight: 500
                }}>
                  {t.share?.username || '用户名'}
                </label>
                <button
                  style={{
                    fontSize: 10,
                    color: theme.primary,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onClick={() => setShowUsernameInput(true)}
                >
                  {t.share?.edit || '修改'}
                </button>
              </div>
              <div style={{ 
                fontSize: 13, 
                color: theme.text,
                padding: '6px 8px',
                background: theme.accent,
                borderRadius: 4,
                border: `1px solid ${theme.border}`
              }}>
                @{username || 'Player'}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <button
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: 13,
                borderRadius: 6,
                border: 'none',
                background: theme.primary,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
                opacity: isExporting ? 0.6 : 1
              }}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (t.share?.exporting || '导出中...') : (t.share?.export || '导出图片')}
            </button>

            <button
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: 13,
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                background: theme.accent,
                color: theme.text,
                cursor: 'pointer',
                fontWeight: 500,
                opacity: isExporting ? 0.6 : 1
              }}
              onClick={handleCopyToClipboard}
              disabled={isExporting}
            >
              {t.share?.copy || '复制到剪贴板'}
            </button>
          </div>
        </div>

        {showUsernameInput && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div style={{
              background: theme.card,
              padding: 24,
              borderRadius: 12,
              width: 300,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: theme.text, fontSize: 16 }}>
                {t.share?.set_username || '设置用户名'}
              </h4>
              <p style={{ margin: '0 0 16px 0', color: theme.textMuted, fontSize: 13 }}>
                {t.share?.username_desc || '用户名将显示在分享图片上'}
              </p>
              <input
                type="text"
                value={tempUsername}
                onChange={e => setTempUsername(e.target.value.slice(0, 15))}
                placeholder={t.share?.username_placeholder || '输入用户名'}
                maxLength={15}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 14,
                  borderRadius: 6,
                  border: `1px solid ${theme.border}`,
                  background: theme.accent,
                  color: theme.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 16
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: `1px solid ${theme.border}`,
                    background: theme.accent,
                    color: theme.text,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (username) {
                      setShowUsernameInput(false)
                    }
                  }}
                >
                  {t.common?.cancel || '取消'}
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    borderRadius: 6,
                    border: 'none',
                    background: theme.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    opacity: tempUsername.trim() ? 1 : 0.5
                  }}
                  onClick={handleSaveUsername}
                  disabled={!tempUsername.trim()}
                >
                  {t.common?.confirm || '确定'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
