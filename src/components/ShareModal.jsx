import { useState, useRef, useEffect } from 'react'
import { toPng, toJpeg, toBlob } from 'html-to-image'
import {
  ShareCard,
  getImageSrc,
  STYLE_TYPES,
  EXPORT_FORMATS,
  LAYOUT_OPTIONS,
  SHARE_CARD_STYLES,
  MAX_CARD_WIDTH,
  MAX_CARD_HEIGHT,
  TEXT_AREA_HEIGHT,
  PREVIEW_MAX_HEIGHT,
  MIN_IMAGE_HEIGHT
} from './ShareCard'

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
  const [widthRatio, setWidthRatio] = useState(1)
  const [imageScale, setImageScale] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [heightRatio, setHeightRatio] = useState(1)
  const [originalCardWidth, setOriginalCardWidth] = useState(MAX_CARD_WIDTH)
  const [originalCardHeight, setOriginalCardHeight] = useState(MAX_CARD_HEIGHT)
  const [originalImageWidth, setOriginalImageWidth] = useState(0)
  const [originalImageHeight, setOriginalImageHeight] = useState(0)
  const [layoutMode, setLayoutMode] = useState('landscape16x9')
  const [useAdvancedMode, setUseAdvancedMode] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
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
        
        const currentStyleConfig = SHARE_CARD_STYLES[styleType] || SHARE_CARD_STYLES.minimalist
        const textAreaH = currentStyleConfig.textAreaHeight || TEXT_AREA_HEIGHT
        
        const paddingH = 48
        const paddingV = 40
        const imageMarginBottom = 16
        
        const maxImageAreaWidth = MAX_CARD_WIDTH - paddingH
        const maxImageAreaHeight = MAX_CARD_HEIGHT - textAreaH - paddingV - imageMarginBottom
        
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
        
        const calculatedHeight = imageDisplayHeight + textAreaH + paddingV + imageMarginBottom
        
        setOriginalCardHeight(Math.round(calculatedHeight))
        setOriginalImageWidth(Math.round(imageDisplayWidth))
        setOriginalImageHeight(Math.round(imageDisplayHeight))
        setCardHeight(Math.round(calculatedHeight))
        
        if (!useAdvancedMode) {
          const layoutOption = LAYOUT_OPTIONS.find(opt => opt.id === layoutMode)
          if (layoutOption) {
            const ratio = layoutOption.ratio
            const newCardWidth = Math.round(imageDisplayHeight * ratio) + paddingH
            setCardWidth(newCardWidth)
            setOriginalCardWidth(newCardWidth)
          }
        } else {
          const calculatedWidth = Math.min(MAX_CARD_WIDTH, imageDisplayWidth + paddingH)
          setCardWidth(Math.round(calculatedWidth))
          setOriginalCardWidth(Math.round(calculatedWidth))
        }
      }
      img.src = getImageSrc(screenshot.file_path)
    }
  }, [screenshot?.file_path])

  useEffect(() => {
    if (!originalImageHeight) return
    
    const currentStyleConfig = SHARE_CARD_STYLES[styleType] || SHARE_CARD_STYLES.minimalist
    const textAreaH = currentStyleConfig.textAreaHeight || TEXT_AREA_HEIGHT
    const paddingV = 40
    const imageMarginBottom = 16
    
    const newCardHeight = originalImageHeight + textAreaH + paddingV + imageMarginBottom
    setCardHeight(Math.round(newCardHeight))
    
    if (!useAdvancedMode) {
      const layoutOption = LAYOUT_OPTIONS.find(opt => opt.id === layoutMode)
      if (layoutOption) {
        const ratio = layoutOption.ratio
        const paddingH = 48
        const newImageWidth = Math.round(originalImageHeight * ratio)
        const newCardWidth = newImageWidth + paddingH
        setCardWidth(newCardWidth)
      }
    }
  }, [styleType, originalImageHeight, layoutMode, useAdvancedMode])

  useEffect(() => {
    if (useAdvancedMode || !originalImageHeight) return
    
    const layoutOption = LAYOUT_OPTIONS.find(opt => opt.id === layoutMode)
    if (!layoutOption) return
    
    const ratio = layoutOption.ratio
    const paddingH = 48
    const newImageWidth = Math.round(originalImageHeight * ratio)
    const newCardWidth = newImageWidth + paddingH
    
    setCardWidth(newCardWidth)
    setWidthRatio(1)
  }, [layoutMode, originalImageHeight, useAdvancedMode])

  const handleImageMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
  }

  const handleMouseMove = (e) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      
      setImagePosition(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }))
      dragStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseUp = () => {
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
      
      if (e.key === 'F5') {
        e.preventDefault()
        e.stopImmediatePropagation()
        setUseAdvancedMode(prev => !prev)
        return
      }
      
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }

    const handleWindowMouseDown = (e) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousedown', handleWindowMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('mousedown', handleWindowMouseDown, true)
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
    const newScale = Math.max(0.5, Math.min(3, imageScale + delta))
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
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      }
    } catch (err) {
      console.error('复制失败:', err)
    }
    setIsExporting(false)
  }

  if (!screenshot) return null

  const maxModalWidth = window.innerWidth * 0.98
  const maxModalHeight = window.innerHeight * 0.85
  
  const previewPadding = 20
  const outerPadding = 16
  const headerHeight = 48
  const rightPanelWidth = 200
  const gap = 16
  
  const availablePreviewWidth = maxModalWidth - outerPadding * 2 - rightPanelWidth - gap - previewPadding * 2
  const availablePreviewHeight = maxModalHeight - outerPadding * 2 - headerHeight - previewPadding * 2
  
  const displayWidth = useAdvancedMode ? cardWidth * widthRatio : cardWidth
  const displayHeight = cardHeight * heightRatio
  
  const scaleX = availablePreviewWidth / displayWidth
  const scaleY = availablePreviewHeight / displayHeight
  const autoPreviewScale = Math.min(1, scaleX, scaleY)
  const finalPreviewScale = Math.min(autoPreviewScale, previewScale)
  
  const scaledWidth = displayWidth * finalPreviewScale
  const scaledHeight = displayHeight * finalPreviewScale
  
  const modalWidth = Math.min(maxModalWidth, scaledWidth + previewPadding * 2 + outerPadding * 2 + rightPanelWidth + gap)
  const modalHeight = Math.min(maxModalHeight, scaledHeight + previewPadding * 2 + outerPadding * 2 + headerHeight)

  return (
    <div style={styles.modal} onClick={handleModalClick}>
      <div 
        style={{ 
          ...styles.modalContent, 
          width: modalWidth,
          height: modalHeight,
          display: 'flex',
          flexDirection: 'column'
        }} 
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
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
            width: scaledWidth + previewPadding * 2,
            height: scaledHeight + previewPadding * 2,
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
                width: displayWidth,
                height: displayHeight,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${finalPreviewScale})`
              }}>
                <ShareCard
                  styleType={styleType}
                  screenshot={screenshot}
                  gameInfo={gameInfo}
                  note={editNote}
                  username={username || 'Player'}
                  cardRef={cardRef}
                  cardWidth={displayWidth}
                  cardHeight={displayHeight}
                  imageScale={imageScale}
                  imagePosition={imagePosition}
                  imageRef={imageRef}
                  isDragging={isDragging}
                  handleImageMouseDown={handleImageMouseDown}
                  originalImageWidth={originalImageWidth}
                  originalImageHeight={originalImageHeight}
                  layoutMode={layoutMode}
                />
              </div>
            </div>
          </div>

          <div style={{ 
            width: rightPanelWidth, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 10,
            flexShrink: 0,
            overflowY: 'auto'
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

            {!useAdvancedMode ? (
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: 11, 
                  color: theme.textMuted, 
                  marginBottom: 6,
                  fontWeight: 500
                }}>
                  布局
                </label>
                <select
                  value={layoutMode}
                  onChange={(e) => setLayoutMode(e.target.value)}
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
                  {LAYOUT_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
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
              </>
            )}

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
                min="0.5"
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
                <span>50%</span>
                <span>300%</span>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <button
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: 'none',
                background: theme.primary,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
                opacity: isExporting ? 0.6 : 1,
                transition: 'opacity 0.15s'
              }}
              onClick={handleExport}
              disabled={isExporting}
              onMouseEnter={e => !isExporting && (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => !isExporting && (e.currentTarget.style.opacity = '1')}
            >
              {isExporting ? (t.share?.exporting || '导出中...') : (t.share?.export || '导出图片')}
            </button>

            <button
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                background: theme.accent,
                color: theme.text,
                cursor: 'pointer',
                fontWeight: 500,
                opacity: isExporting ? 0.6 : 1,
                transition: 'opacity 0.15s, background 0.15s'
              }}
              onClick={handleCopyToClipboard}
              disabled={isExporting}
              onMouseEnter={e => !isExporting && (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => !isExporting && (e.currentTarget.style.opacity = '1')}
            >
              {t.share?.copy || '复制到剪贴板'}
            </button>
          </div>
        </div>

        {copySuccess && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: theme.primary,
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: 13,
            zIndex: 100,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {t.share?.copy_success || '已复制到剪贴板'}
          </div>
        )}

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
