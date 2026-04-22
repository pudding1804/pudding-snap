import { useState, useEffect } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'

function getImageSrc(path) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try {
    return convertFileSrc(path)
  } catch {
    return path
  }
}

export function ThumbnailImage({ thumbnailPath, theme, placeholderText = '缩略图生成中', style = {} }) {
  const [imgError, setImgError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    setImgError(false)
    setRetryKey(k => k + 1)
  }, [thumbnailPath])

  if (!thumbnailPath || imgError) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: theme.accent,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', lineHeight: 1.3 }}>
          {placeholderText}
        </span>
      </div>
    )
  }

  return (
    <img 
      key={retryKey}
      src={getImageSrc(thumbnailPath)} 
      alt="截图缩略图" 
      className="card-img"
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover',
        objectPosition: 'center center',
        transition: 'transform 0.3s ease',
        ...style,
      }}
      onError={(e) => { 
        setImgError(true)
      }}
      loading="lazy"
    />
  )
}
