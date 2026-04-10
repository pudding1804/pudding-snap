import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { btnEvents } from '../styles/sharedStyles'
import { useEffect, useRef } from 'react'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

export function ImportModal({
  theme,
  styles,
  t,
  show,
  files,
  isImporting,
  selectedGame,
  onClose,
  onFilesChange,
  onImport,
}) {
  const dropZoneRef = useRef(null)
  const isOverDropZone = useRef(false)

  useEffect(() => {
    if (!show) return

    console.log('[导入] 设置拖放监听器')
    isOverDropZone.current = false

    const unlisteners = []

    const setupListeners = async () => {
      const webview = getCurrentWebview()
      
      const unlistenDragEnter = await webview.listen('tauri://drag-enter', (event) => {
        console.log('[导入] Tauri drag-enter 事件:', event)
        if (dropZoneRef.current) {
          dropZoneRef.current.style.borderColor = theme.primary
          dropZoneRef.current.style.background = theme.card
        }
      })
      unlisteners.push(unlistenDragEnter)
      
      const unlistenDragLeave = await webview.listen('tauri://drag-leave', (event) => {
        console.log('[导入] Tauri drag-leave 事件:', event)
        if (dropZoneRef.current) {
          dropZoneRef.current.style.borderColor = theme.border
          dropZoneRef.current.style.background = theme.accent
        }
        isOverDropZone.current = false
      })
      unlisteners.push(unlistenDragLeave)
      
      const unlistenDragDrop = await webview.listen('tauri://drag-drop', async (event) => {
        console.log('[导入] Tauri drag-drop 事件:', event)
        
        const payload = event.payload
        const paths = payload.paths || []
        
        console.log('[导入] 拖放的文件路径:', paths)
        
        const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
        
        const imagePaths = paths.filter(p => {
          const ext = p.split('.').pop()?.toLowerCase()
          return imageExtensions.includes(ext || '')
        })
        
        console.log('[导入] 过滤后的图片文件:', imagePaths)
        
        const newFiles = []
        for (const path of imagePaths) {
          const fileName = path.split(/[/\\]/).pop()
          const stat = await invoke('get_file_metadata', { path }).catch((err) => {
            console.warn('[导入] 获取文件信息失败:', path, err)
            return null
          })
          
          newFiles.push({
            path,
            name: fileName,
            size: stat?.size || 0,
            created: stat?.created || Math.floor(Date.now() / 1000),
            modified: stat?.modified || Math.floor(Date.now() / 1000)
          })
        }
        
        console.log('[导入] 处理后的文件:', newFiles)
        
        if (newFiles.length > 0) {
          onFilesChange(prev => [...prev, ...newFiles])
        }
        
        if (dropZoneRef.current) {
          dropZoneRef.current.style.borderColor = theme.border
          dropZoneRef.current.style.background = theme.accent
        }
      })
      unlisteners.push(unlistenDragDrop)
      
      console.log('[导入] 拖放监听器已设置')
    }
    
    setupListeners()
    
    return () => {
      console.log('[导入] 清理拖放监听器')
      unlisteners.forEach(unlisten => unlisten())
    }
  }, [show, onFilesChange, theme])

  if (!show) return null

  const handleFileSelect = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
    })
    
    if (selected && Array.isArray(selected)) {
      const newFiles = await Promise.all(selected.map(async (path) => {
        const fileName = path.split(/[/\\]/).pop()
        const stat = await invoke('get_file_metadata', { path }).catch(() => null)
        return {
          path,
          name: fileName,
          size: stat?.size || 0,
          created: stat?.created || Math.floor(Date.now() / 1000),
          modified: stat?.modified || Math.floor(Date.now() / 1000)
        }
      }))
      onFilesChange(prev => [...prev, ...newFiles])
    }
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalContent, maxWidth: 600, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16 }}>{t.import.title}</h2>
          
          <div
            ref={dropZoneRef}
            style={{
              border: `2px dashed ${theme.border}`,
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              marginBottom: 16,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: theme.accent,
              pointerEvents: 'auto'
            }}
            onClick={handleFileSelect}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p style={{ color: theme.textMuted }}>{t.import.drag_hint}</p>
            <p style={{ color: theme.textMuted, marginTop: 8 }}>{t.import.or}</p>
            <button 
              style={{ ...styles.btnPrimary, marginTop: 12, padding: '8px 16px' }}
              {...btnEvents}
            >
              {t.import.add_files}
            </button>
          </div>
          
          {files.length > 0 && (
            <div style={{ marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px', color: theme.textMuted }}>{t.import.file_name}</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', color: theme.textMuted }}>{t.import.file_size}</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px', color: theme.textMuted }}>{t.import.file_created}</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '8px 4px', color: theme.text }}>{file.name}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', color: theme.textMuted }}>{formatBytes(file.size)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 4px', color: theme.textMuted }}>{formatDate(file.created)}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.danger }}
                          onClick={() => onFilesChange(prev => prev.filter((_, i) => i !== index))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button 
              style={styles.btn}
              {...btnEvents}
              onClick={() => {
                onClose()
                onFilesChange([])
              }}
            >
              {t.import.cancel}
            </button>
            <button 
              style={{ ...styles.btnPrimary, opacity: files.length === 0 || isImporting ? 0.5 : 1 }}
              {...btnEvents}
              disabled={files.length === 0 || isImporting}
              onClick={() => onImport && onImport()}
            >
              {isImporting ? t.import.importing : t.import.import}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
