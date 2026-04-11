import { useState, useRef, useEffect } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { toPng, toJpeg, toBlob } from 'html-to-image'

const STYLE_TYPES = [
  { id: 'minimalist', name: '极简', nameEn: 'Minimalist' },
  { id: 'cyberpunk', name: '赛博', nameEn: 'Cyberpunk' },
  { id: 'polaroid', name: '拍立得', nameEn: 'Polaroid' },
  { id: 'vaporwave', name: '蒸汽波', nameEn: 'Vaporwave' },
  { id: 'editorial', name: '杂志', nameEn: 'Editorial' },
  { id: 'pink', name: '少女粉', nameEn: 'Pink' },
  { id: 'gothic', name: '哥特', nameEn: 'Gothic' }
]

  const EXPORT_FORMATS = [
  { id: 'jpg', name: 'JPG' },
  { id: 'png', name: 'PNG' }
]

const MAX_CARD_WIDTH = 720
const MIN_CARD_WIDTH = 480
const MIN_CARD_HEIGHT = 400
const MAX_CARD_HEIGHT = 720
const TEXT_AREA_HEIGHT = 140
const PREVIEW_MAX_HEIGHT = 500
const MIN_IMAGE_HEIGHT = 180

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
  cardRef,
  cardWidth,
  cardHeight,
  imageScale = 1,
  imagePosition = { x: 0, y: 0 },
  imageRef,
  isDragging = false,
  handleImageMouseDown,
  handleImageMouseLeave
}) {
  const processName = screenshot?.game_id?.split('\\').pop().split('/').pop().replace('.exe', '') || '未知游戏'
  const gameTitle = screenshot?.display_title || screenshot?.game_title || gameInfo?.display_title || gameInfo?.game_title || processName
  const displayUsername = username || 'Player'
  const dateTime = formatDateTime(screenshot.timestamp)
  const imageSrc = getImageSrc(screenshot.file_path)

  const baseStyle = {
    width: cardWidth,
    height: cardHeight,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxSizing: 'border-box',
    overflow: 'hidden',
    margin: '0 auto'
  }

  const renderMinimalist = () => (
    <div style={{
      ...baseStyle,
      background: '#ffffff',
      padding: 24,
      fontFamily: '"Segoe UI", Arial, sans-serif'
    }} ref={cardRef}>
      <div style={{ 
        width: '100%',
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
          ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
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
        <div style={{ fontSize: 14, color: '#888', marginBottom: 12, fontVariantNumeric: 'tabular-nums' }}>
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
      fontFamily: 'Consolas, "Courier New", monospace',
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
        width: '100%',
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
          ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            filter: 'contrast(1.1) saturate(1.2)',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
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
          textShadow: '0 0 5px rgba(255,0,255,0.5)',
          fontVariantNumeric: 'tabular-nums'
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
      fontFamily: 'Georgia, "Times New Roman", serif',
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
          ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
        />
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ 
          fontSize: 22, 
          fontWeight: 500, 
          color: '#333', 
          marginBottom: 6,
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
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.5px'
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
        width: '100%',
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
            ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
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
          fontWeight: 'bold',
          fontVariantNumeric: 'tabular-nums'
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
        bottom: 10,
        right: 14,
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        fontWeight: 500,
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
      fontFamily: 'Georgia, "Times New Roman", serif'
    }} ref={cardRef}>
      <div style={{ 
        width: '100%',
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
          ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
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
          fontWeight: 600, 
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
          letterSpacing: '1px',
          fontVariantNumeric: 'tabular-nums'
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

  const renderPink = () => (
    <div style={{
      ...baseStyle,
      background: 'linear-gradient(180deg, #ffc8dd 0%, #ffafcc 50%, #bde0fe 100%)',
      padding: 24,
      fontFamily: '"Comic Sans MS", Tahoma, sans-serif'
    }} ref={cardRef}>
      <div style={{ 
        width: '100%',
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 8px 25px rgba(255,175,204,0.3)'
      }}>
        <img 
          src={imageSrc} 
          alt="截图" 
          ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
        />
      </div>
      <div style={{ 
        background: 'rgba(255,255,255,0.8)',
        borderRadius: 12,
        padding: 20,
        textAlign: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 15px rgba(255,175,204,0.2)'
      }}>
        <div style={{ 
          fontSize: 24, 
          fontWeight: 600, 
          color: '#e63946', 
          marginBottom: 8,
          textShadow: '1px 1px 0 rgba(255,175,204,0.5)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {gameTitle}
        </div>
        <div style={{ 
          fontSize: 14, 
          color: '#8d99ae', 
          marginBottom: 12,
          fontVariantNumeric: 'tabular-nums'
        }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 15, 
            color: '#457b9d', 
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
        <div style={{ 
          fontSize: 13, 
          color: '#e63946',
          fontWeight: 500
        }}>
          by {displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 14,
        fontSize: 10,
        color: 'rgba(0,0,0,0.3)',
        fontWeight: 500,
        letterSpacing: '0.3px'
      }}>
        PuddingSnap
      </div>
    </div>
  )

  const renderGothic = () => (
    <div style={{
      ...baseStyle,
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a1a 30%, #2a1010 70%, #1a0a0a 100%)',
      padding: 24,
      fontFamily: '"Times New Roman", Georgia, serif',
      border: '2px solid #6a040f',
      boxShadow: '0 0 40px rgba(106, 4, 15, 0.3)'
    }} ref={cardRef}>
      {/* 尖顶装饰元素 */}
      <div style={{
        position: 'absolute',
        top: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '20px solid transparent',
        borderRight: '20px solid transparent',
        borderBottom: '20px solid #6a040f'
      }} />
      
      {/* 花纹装饰 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, #c1121f, transparent)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, #c1121f, transparent)'
      }} />
      
      <div style={{ 
        width: '100%',
        flex: 1,
        background: 'rgba(0,0,0,0.9)',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        border: '2px solid #c1121f',
        boxShadow: 'inset 0 0 30px rgba(193, 18, 31, 0.3)'
      }}>
        <img 
          src={imageSrc} 
          alt="截图" 
          ref={imageRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            filter: 'contrast(1.2) brightness(0.8) saturate(1.1) sepia(0.2)',
            transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
            transformOrigin: 'center center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleImageMouseDown}
        />
      </div>
      <div style={{ 
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 4,
        padding: 20,
        textAlign: 'center',
        flexShrink: 0,
        border: '1px solid #c1121f',
        boxShadow: '0 4px 15px rgba(193, 18, 31, 0.2)'
      }}>
        <div style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          color: '#f8edeb', 
          marginBottom: 8,
          textShadow: '0 0 15px rgba(193, 18, 31, 0.5)',
          fontStyle: 'italic',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '1px'
        }}>
          {gameTitle}
        </div>
        <div style={{ 
          fontSize: 14, 
          color: '#e63946', 
          marginBottom: 12,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '1.5px',
          textShadow: '0 0 5px rgba(230, 57, 70, 0.3)'
        }}>
          {dateTime}
        </div>
        {note && (
          <div style={{ 
            fontSize: 15, 
            color: '#d1d5db', 
            lineHeight: 1.6,
            fontStyle: 'italic',
            marginBottom: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            textShadow: '0 0 5px rgba(209, 213, 219, 0.2)'
          }}>
            "{note}"
          </div>
        )}
        <div style={{ 
          fontSize: 13, 
          color: '#f8edeb',
          fontStyle: 'italic',
          textShadow: '0 0 10px rgba(193, 18, 31, 0.3)'
        }}>
          by {displayUsername}
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 14,
        fontSize: 10,
        color: 'rgba(230, 57, 70, 0.3)',
        letterSpacing: '0.8px',
        fontStyle: 'italic'
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
    case 'pink': return renderPink()
    case 'gothic': return renderGothic()
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
  const [exportFormat, setExportFormat] = useState('jpg')
  const [isExporting, setIsExporting] = useState(false)
  const [showUsernameInput, setShowUsernameInput] = useState(false)
  const [tempUsername, setTempUsername] = useState(username || '')
  const [editNote, setEditNote] = useState(screenshot?.note || '')
  const [cardWidth, setCardWidth] = useState(MAX_CARD_WIDTH)
  const [cardHeight, setCardHeight] = useState(MAX_CARD_HEIGHT)
  const [previewScale, setPreviewScale] = useState(1)
  const [widthRatio, setWidthRatio] = useState(1) // 1 = 100%, 0.5 = 50%
  const [imageScale, setImageScale] = useState(1) // 1 = 100%, 1.5 = 150%
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [heightRatio, setHeightRatio] = useState(1) // 1 = 100%, 2 = 200%
  const [originalCardWidth, setOriginalCardWidth] = useState(MAX_CARD_WIDTH)
  const [originalCardHeight, setOriginalCardHeight] = useState(MAX_CARD_HEIGHT)
  const cardRef = useRef(null)
  const imageRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const previewRef = useRef(null)
  const dragEndTimeRef = useRef(0)

  useEffect(() => {
    if (!username) {
      setShowUsernameInput(true)
    }
  }, [username])

  useEffect(() => {
    if (screenshot?.file_path) {
      const img = new Image()
      img.onload = () => {
        const imgWidth = img.naturalWidth
        const imgHeight = img.naturalHeight
        const aspectRatio = imgWidth / imgHeight
        
        const paddingH = 48
        const paddingV = 48
        const imageAreaPadding = 16
        
        let calculatedWidth = MAX_CARD_WIDTH
        let calculatedHeight = MAX_CARD_HEIGHT
        
        const maxImageAreaWidth = MAX_CARD_WIDTH - paddingH - imageAreaPadding * 2
        const maxImageAreaHeight = MAX_CARD_HEIGHT - TEXT_AREA_HEIGHT - paddingV - imageAreaPadding * 2
        
        const imageAreaAspectRatio = maxImageAreaWidth / maxImageAreaHeight
        
        let imageDisplayWidth, imageDisplayHeight
        
        if (aspectRatio > imageAreaAspectRatio) {
          imageDisplayWidth = maxImageAreaWidth
          imageDisplayHeight = maxImageAreaWidth / aspectRatio
        } else {
          imageDisplayHeight = maxImageAreaHeight
          imageDisplayWidth = maxImageAreaHeight * aspectRatio
        }
        
        if (imageDisplayHeight < MIN_IMAGE_HEIGHT) {
          imageDisplayHeight = MIN_IMAGE_HEIGHT
          imageDisplayWidth = MIN_IMAGE_HEIGHT * aspectRatio
        }
        
        calculatedWidth = Math.min(MAX_CARD_WIDTH, imageDisplayWidth + paddingH + imageAreaPadding * 2)
        calculatedHeight = imageDisplayHeight + TEXT_AREA_HEIGHT + paddingV + imageAreaPadding * 2
        
        if (calculatedHeight > MAX_CARD_HEIGHT) {
          calculatedHeight = MAX_CARD_HEIGHT
        }
        
        setOriginalCardWidth(Math.round(calculatedWidth))
        setOriginalCardHeight(Math.round(calculatedHeight))
        setCardWidth(Math.round(calculatedWidth))
        setCardHeight(Math.round(calculatedHeight))
        
        const scale = Math.min(1, PREVIEW_MAX_HEIGHT / calculatedHeight)
        setPreviewScale(scale)
      }
      img.src = getImageSrc(screenshot.file_path)
    }
  }, [screenshot?.file_path])

  const handleImageMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    console.log('[DEBUG] handleImageMouseDown:', { x: e.clientX, y: e.clientY, isDragging: isDraggingRef.current })
  }

  const handleMouseMove = (e) => {
    console.log('[DEBUG] handleMouseMove:', { isDragging: isDraggingRef.current, x: e.clientX, y: e.clientY })
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      console.log('[DEBUG] dragging:', { dx, dy, imagePosition: imagePosition })
      
      setImagePosition(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }))
      dragStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseUp = () => {
    console.log('[DEBUG] handleMouseUp')
    if (isDraggingRef.current) {
      dragEndTimeRef.current = Date.now()
    }
    isDraggingRef.current = false
    setIsDragging(false)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return
      }
      
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    const handleWindowMouseDown = (e) => {
      console.log('[DEBUG] handleWindowMouseDown:', { button: e.button, target: e.target.tagName })
      if (e.button === 3 || e.button === 4) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleWindowMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleWindowMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onClose])

  const handleWidthChange = (e) => {
    const value = parseFloat(e.target.value)
    setWidthRatio(value)
  }

  const handleImageScaleChange = (e) => {
    const value = parseFloat(e.target.value)
    setImageScale(value)
  }

  const handleHeightChange = (e) => {
    const value = parseFloat(e.target.value)
    setHeightRatio(value)
  }

  const handleImageMouseLeave = () => {
    isDraggingRef.current = false
    setIsDragging(false)
  }

  const handleModalClick = (e) => {
    if (Date.now() - dragEndTimeRef.current < 100) {
      return
    }
    onClose()
  }

  const handlePreviewWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    const newScale = Math.max(1, Math.min(3, imageScale + delta))
    setImageScale(newScale)
  }

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
        pixelRatio: 2,
        backgroundColor: '#ffffff'
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

  const scaledWidth = cardWidth * widthRatio * previewScale
  const scaledHeight = cardHeight * heightRatio * previewScale
  const previewPadding = 20
  const outerPadding = 16
  const headerHeight = 48
  const rightPanelWidth = 180
  const gap = 20
  
  // 计算原始大小的弹窗宽高，确保弹窗大小维持不变
  const originalScaledWidth = cardWidth * previewScale
  const originalScaledHeight = cardHeight * previewScale
  const modalWidth = originalScaledWidth + previewPadding * 2 + outerPadding * 2 + rightPanelWidth + gap + 20
  const modalHeight = originalScaledHeight + previewPadding * 2 + outerPadding * 2 + headerHeight + 20

  return (
    <div style={styles.modal} onClick={handleModalClick}>
      <div 
        style={{ 
          ...styles.modalContent, 
          width: Math.min(95 * window.innerWidth / 100, modalWidth),
          height: Math.min(90 * window.innerHeight / 100, modalHeight),
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
          display: 'flex', 
          gap: gap, 
          padding: outerPadding,
          flex: 1,
          minHeight: 0
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: theme.accent,
            borderRadius: 8,
            padding: previewPadding,
            width: originalScaledWidth + previewPadding * 2,
            height: originalScaledHeight + previewPadding * 2,
            flexShrink: 0
          }}
            ref={previewRef}
            onWheel={handlePreviewWheel}
          >
            <div style={{ 
              width: scaledWidth,
              height: scaledHeight,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ 
                transformOrigin: 'center center',
                width: cardWidth * widthRatio,
                height: cardHeight * heightRatio,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${previewScale})`
              }}>
                <ShareCard
                  styleType={styleType}
                  screenshot={screenshot}
                  gameInfo={gameInfo}
                  note={editNote}
                  username={username || 'Player'}
                  cardRef={cardRef}
                  cardWidth={cardWidth * widthRatio}
                  cardHeight={cardHeight * heightRatio}
                  imageScale={imageScale}
                  imagePosition={imagePosition}
                  imageRef={imageRef}
                  isDragging={isDragging}
                  handleImageMouseDown={handleImageMouseDown}
                  handleImageMouseLeave={handleImageMouseLeave}
                />
              </div>
            </div>
          </div>

          <div style={{ 
            width: rightPanelWidth, 
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
              <select
                value={styleType}
                onChange={(e) => setStyleType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: `1px solid ${theme.border}`,
                  background: theme.accent,
                  color: theme.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                {STYLE_TYPES.map(style => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
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

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 10, 
                color: theme.textMuted, 
                marginBottom: 4,
                fontWeight: 500
              }}>
                高度调整
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={heightRatio}
                onChange={handleHeightChange}
                style={{
                  width: '100%',
                  height: 4,
                  background: theme.accent,
                  borderRadius: 2,
                  outline: 'none',
                  appearance: 'none'
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 9, 
                color: theme.textMuted,
                marginTop: 2
              }}>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 10, 
                color: theme.textMuted, 
                marginBottom: 4,
                fontWeight: 500
              }}>
                宽度调整
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={widthRatio}
                onChange={handleWidthChange}
                style={{
                  width: '100%',
                  height: 4,
                  background: theme.accent,
                  borderRadius: 2,
                  outline: 'none',
                  appearance: 'none'
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 9, 
                color: theme.textMuted,
                marginTop: 2
              }}>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: 10, 
                color: theme.textMuted, 
                marginBottom: 4,
                fontWeight: 500
              }}>
                图片缩放
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={imageScale}
                onChange={handleImageScaleChange}
                style={{
                  width: '100%',
                  height: 4,
                  background: theme.accent,
                  borderRadius: 2,
                  outline: 'none',
                  appearance: 'none'
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 9, 
                color: theme.textMuted,
                marginTop: 2
              }}>
                <span>100%</span>
                <span>300%</span>
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
