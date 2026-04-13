import { convertFileSrc } from '@tauri-apps/api/core'
import { SHARE_CARD_STYLES } from './shareCardStyles'

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

function renderDecorations(decorations) {
  if (!decorations) return null
  return decorations.map((decoration, index) => (
    <div key={index} style={decoration.style} />
  ))
}

function ImageContainer({
  styleConfig,
  imageSrc,
  imageRef,
  originalImageWidth,
  originalImageHeight,
  imageScale,
  imagePosition,
  isDragging,
  handleImageMouseDown
}) {
  const containerStyle = styleConfig.imageContainer || {}
  const imageStyle = styleConfig.image || {}

  if (containerStyle.innerWrapper) {
    return (
      <div style={{
        width: '100%',
        height: originalImageHeight ? originalImageHeight + 24 : 'auto',
        ...containerStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative'
      }}>
        <div style={{
          width: 'calc(100% - 24px)',
          height: 'calc(100% - 24px)',
          ...containerStyle.innerWrapper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <img
            src={imageSrc}
            alt="截图"
            ref={imageRef}
            style={{
              width: originalImageWidth || '100%',
              height: originalImageHeight || '100%',
              objectFit: 'contain',
              transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
              transformOrigin: 'center center',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -((originalImageWidth || 0) / 2),
              marginTop: -((originalImageHeight || 0) / 2),
              ...imageStyle
            }}
            onMouseDown={handleImageMouseDown}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height: originalImageHeight || 'auto',
      ...containerStyle,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <img
        src={imageSrc}
        alt="截图"
        ref={imageRef}
        style={{
          width: originalImageWidth || '100%',
          height: originalImageHeight || '100%',
          objectFit: 'contain',
          transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
          transformOrigin: 'center center',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          position: 'absolute',
          top: '50%',
          left: '50%',
          marginLeft: -((originalImageWidth || 0) / 2),
          marginTop: -((originalImageHeight || 0) / 2),
          ...imageStyle
        }}
        onMouseDown={handleImageMouseDown}
      />
    </div>
  )
}

function TextSection({ styleConfig, gameTitle, dateTime, note, displayUsername, layoutMode }) {
  const sectionStyle = styleConfig.textSection || {}
  const textAreaHeight = styleConfig.textAreaHeight || 120
  
  let titleStyle = styleConfig.title || {}
  let dateTimeStyle = styleConfig.dateTime || {}
  let noteStyle = styleConfig.note || {}
  let usernameStyle = styleConfig.username || {}
  
  if (styleConfig.responsive && layoutMode) {
    const responsiveConfig = styleConfig.responsive[layoutMode]
    if (responsiveConfig) {
      titleStyle = { ...titleStyle, ...responsiveConfig.title }
      noteStyle = { ...noteStyle, ...responsiveConfig.note }
    }
  }

  const getTitleStyle = () => {
    const baseStyle = { ...titleStyle }
    
    if (gameTitle.length > 20) {
      baseStyle.fontSize = Math.max(16, titleStyle.fontSize * 0.8)
    } else if (gameTitle.length > 30) {
      baseStyle.fontSize = Math.max(14, titleStyle.fontSize * 0.6)
    }
    
    return baseStyle
  }

  const getNoteStyle = () => {
    const baseStyle = { ...noteStyle }
    
    if (note && note.length > 50) {
      baseStyle.fontSize = Math.max(12, noteStyle.fontSize * 0.8)
    } else if (note && note.length > 80) {
      baseStyle.fontSize = Math.max(10, noteStyle.fontSize * 0.6)
    }
    
    return baseStyle
  }

  return (
    <div style={{ 
      textAlign: 'center', 
      flexShrink: 0,
      height: textAreaHeight,
      ...sectionStyle,
      wordBreak: 'break-word',
      overflowWrap: 'break-word'
    }}>
      <div style={{
        ...getTitleStyle(),
        overflow: 'hidden',
        lineHeight: titleStyle.lineHeight || 1.2
      }}>
        {gameTitle}
      </div>
      <div style={{
        fontVariantNumeric: 'tabular-nums',
        ...dateTimeStyle
      }}>
        {dateTime}
      </div>
      {note && (
        <div style={{
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          ...getNoteStyle()
        }}>
          "{note}"
        </div>
      )}
      <div style={usernameStyle}>
        by {displayUsername}
      </div>
    </div>
  )
}

function Watermark({ styleConfig }) {
  const watermarkStyle = styleConfig.watermark || {}
  return (
    <div style={{
      position: 'absolute',
      ...watermarkStyle
    }}>
      PuddingSnap
    </div>
  )
}

export function ShareCard({
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
  originalImageWidth,
  originalImageHeight,
  layoutMode = 'landscape16x9'
}) {
  const processName = screenshot?.game_id?.split('\\').pop().split('/').pop().replace('.exe', '') || '未知游戏'
  const gameTitle = screenshot?.display_title || screenshot?.game_title || gameInfo?.display_title || gameInfo?.game_title || processName
  const displayUsername = username || 'Player'
  const dateTime = formatDateTime(screenshot.timestamp)
  const imageSrc = getImageSrc(screenshot.file_path)

  const styleConfig = SHARE_CARD_STYLES[styleType] || SHARE_CARD_STYLES.minimalist

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

  const containerStyle = styleConfig.container || {}

  return (
    <div style={{ ...baseStyle, ...containerStyle }} ref={cardRef}>
      {renderDecorations(styleConfig.decorations)}
      
      <ImageContainer
        styleConfig={styleConfig}
        imageSrc={imageSrc}
        imageRef={imageRef}
        originalImageWidth={originalImageWidth}
        originalImageHeight={originalImageHeight}
        imageScale={imageScale}
        imagePosition={imagePosition}
        isDragging={isDragging}
        handleImageMouseDown={handleImageMouseDown}
      />
      
      <TextSection
        styleConfig={styleConfig}
        gameTitle={gameTitle}
        dateTime={dateTime}
        note={note}
        displayUsername={displayUsername}
        layoutMode={layoutMode}
      />
      
      <Watermark styleConfig={styleConfig} />
    </div>
  )
}

export { getImageSrc, formatDateTime }
