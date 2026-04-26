import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { btnEvents } from '../styles/sharedStyles'

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function ManualInfoModal({
  theme,
  styles,
  t,
  show,
  gameId,
  currentTitle,
  currentLogoPath,
  onClose,
  onSaved,
}) {
  const [gameName, setGameName] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [imageSource, setImageSource] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [imageChanged, setImageChanged] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const modalRef = useRef(null)
  const overlayMousedownRef = useRef(false)

  useEffect(() => {
    if (show) {
      setGameName(currentTitle || '')
      if (currentLogoPath) {
        if (currentLogoPath.startsWith('http')) {
          setImagePreview(currentLogoPath)
        } else {
          try {
            setImagePreview(convertFileSrc(currentLogoPath))
          } catch {
            setImagePreview(currentLogoPath)
          }
        }
      } else {
        setImagePreview(null)
      }
      setImageSource(null)
      setImageData(null)
      setImageChanged(false)
      setIsSaving(false)
    }
  }, [show, currentTitle, currentLogoPath])

  const handlePaste = useCallback(async (e) => {
    if (!show) return
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const buffer = await file.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        const previewUrl = URL.createObjectURL(file)

        setImagePreview(previewUrl)
        setImageSource('clipboard')
        setImageData(base64)
        setImageChanged(true)
        break
      }
    }
  }, [show])

  useEffect(() => {
    if (show) {
      document.addEventListener('paste', handlePaste)
      return () => document.removeEventListener('paste', handlePaste)
    }
  }, [show, handlePaste])

  useEffect(() => {
    if (!show) {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [show, imagePreview])

  const handleFileSelect = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
    })

    if (selected) {
      const previewUrl = `https://asset.localhost/${encodeURIComponent(selected.replace(/\\/g, '/'))}`
      setImagePreview(previewUrl)
      setImageSource('file')
      setImageData(selected)
      setImageChanged(true)
    }
  }

  const handlePasteClick = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const buffer = await blob.arrayBuffer()
          const base64 = arrayBufferToBase64(buffer)
          const previewUrl = URL.createObjectURL(blob)

          setImagePreview(previewUrl)
          setImageSource('clipboard')
          setImageData(base64)
          setImageChanged(true)
          break
        }
      }
    } catch (e) {
      console.log('读取剪贴板失败:', e)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const buffer = await file.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        const previewUrl = URL.createObjectURL(file)

        setImagePreview(previewUrl)
        setImageSource('clipboard')
        setImageData(base64)
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleRemoveImage = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(null)
    setImageSource(null)
    setImageData(null)
    setImageChanged(true)
  }

  const handleSave = async () => {
    if (!gameName.trim()) return
    setIsSaving(true)
    try {
      const updatedGame = await invoke('save_manual_game_info', {
        gameId,
        displayName: gameName.trim(),
        imageSource: imageChanged ? imageSource : null,
        imageData: imageChanged ? imageData : null,
      })
      if (onSaved) onSaved(updatedGame)
      onClose()
    } catch (e) {
      console.error('保存失败:', e)
    }
    setIsSaving(false)
  }

  if (!show) return null

  return (
    <div style={styles.modalOverlay}
      onMouseDown={(e) => { overlayMousedownRef.current = (e.target === e.currentTarget) }}
      onClick={() => { if (overlayMousedownRef.current) onClose() }}
    >
      <div
        ref={modalRef}
        style={{ ...styles.modalContent, maxWidth: 500 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 20, textAlign: 'center' }}>{t.search.manual_input_title}</h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: theme.text, fontSize: 13, fontWeight: 500 }}>
              {t.search.game_name}
            </label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder={t.search.game_name}
              style={{ ...styles.input, width: '100%' }}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: theme.text, fontSize: 13, fontWeight: 500 }}>
              {t.search.game_thumbnail}
            </label>
            <div
              style={{
                width: '100%',
                aspectRatio: '460 / 215',
                background: isDragOver ? theme.primary : theme.accent,
                border: `2px dashed ${isDragOver ? theme.primary : theme.border}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'background 0.2s, border-color 0.2s',
                position: 'relative',
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleFileSelect}
            >
              {imagePreview ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img
                    src={imagePreview}
                    alt="preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveImage()
                    }}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: theme.textMuted, padding: 16 }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8, opacity: 0.5 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <div style={{ fontSize: 13 }}>{t.search.drag_drop_hint}</div>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{t.search.paste_hint}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              style={{ ...styles.btn, flex: 1, padding: '10px 16px', fontSize: 13 }}
              {...btnEvents}
              onClick={handleFileSelect}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {t.search.select_local_image}
              </span>
            </button>
            <button
              style={{ ...styles.btn, flex: 1, padding: '10px 16px', fontSize: 13 }}
              {...btnEvents}
              onClick={handlePasteClick}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {t.search.paste_clipboard}
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{ ...styles.btn, flex: 1 }}
              {...btnEvents}
              onClick={onClose}
              disabled={isSaving}
            >
              {t.search.cancel || t.settings.cancel}
            </button>
            <button
              style={{
                ...styles.btnPrimary,
                flex: 1,
                opacity: !gameName.trim() || isSaving ? 0.6 : 1,
                cursor: !gameName.trim() || isSaving ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSave}
              disabled={!gameName.trim() || isSaving}
            >
              {isSaving ? '...' : t.search.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
