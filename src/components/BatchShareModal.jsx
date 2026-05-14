import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

const IMAGES_PER_PAGE_OPTIONS = [
  { value: 8, label: '8 (2×4)' },
  { value: 12, label: '12 (3×4)' },
  { value: 16, label: '16 (4×4)' }
]

function ProgressBar({ theme, current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  return (
    <div style={{
      width: '100%',
      height: 8,
      background: theme.accent,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 12
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: theme.primary,
        borderRadius: 4,
        transition: 'width 0.2s ease'
      }} />
    </div>
  )
}

export function BatchShareModal({
  theme,
  styles,
  t,
  selectedCount,
  onExport,
  onClose,
}) {
  const [format, setFormat] = useState('html')
  const [imagesPerPage, setImagesPerPage] = useState(8)
  const [step, setStep] = useState('form')
  const [progressCurrent, setProgressCurrent] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [exportedFilePath, setExportedFilePath] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const unlistenRef = useRef(null)
  const cancelledRef = useRef(false)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current()
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleExport = async () => {
    setStep('processing')
    setProgressCurrent(0)
    setProgressTotal(0)
    setExportStatus('')
    cancelledRef.current = false

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const sessionId = Date.now().toString()

    let unlistenFn = null
    try {
      const { listen } = await import('@tauri-apps/api/event')
      unlistenFn = await listen('export-progress', (event) => {
        if (cancelledRef.current) return
        if (event.payload?.session_id !== sessionId) return
        const { current, total } = event.payload
        setProgressCurrent(current)
        setProgressTotal(total)
        setExportStatus(`正在处理图片... ${current}/${total}`)
      })
      unlistenRef.current = unlistenFn

      setExportStatus('正在获取截图数据...')
      const filePath = await onExport(format, imagesPerPage, abortController.signal, sessionId)

      if (cancelledRef.current) return

      setExportedFilePath(filePath)
      setStep('completed')
    } catch (e) {
      if (cancelledRef.current) return
      console.error('导出失败:', e)
      const msg = e?.message || String(e) || ''
      if (msg.includes('取消了保存') || msg.includes('cancel')) {
        setStep('form')
        return
      }
      setErrorMessage(msg || '导出失败')
      setStep('error')
    } finally {
      if (unlistenFn) {
        unlistenFn()
        unlistenRef.current = null
      }
      abortControllerRef.current = null
    }
  }

  const handleOpenFolder = async () => {
    try {
      await invoke('open_in_explorer', { filePath: exportedFilePath })
    } catch (e) {
      console.error('打开文件夹失败:', e)
    }
  }

  const handleClose = () => {
    cancelledRef.current = true
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }
    setStep('form')
    setProgressCurrent(0)
    setProgressTotal(0)
    setExportedFilePath('')
    setErrorMessage('')
    setExportStatus('')
    onClose()
  }

  const bst = t.batch_share || {}
  const isExporting = step === 'processing'

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isExporting) {
      handleClose()
    }
  }

  const modalWidth = step === 'completed' || step === 'error' ? 420 : 380

  return (
    <div style={styles.modal} onClick={handleOverlayClick}>
      <div
        style={{
          ...styles.modalContent,
          width: modalWidth,
          padding: 0,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          ...styles.modalHeader,
          padding: '14px 20px',
          flexShrink: 0
        }}>
          <h3 style={styles.modalTitle}>
            {step === 'completed' ? (bst.export_success || '导出成功')
              : step === 'error' ? (bst.export_failed || '导出失败')
              : (bst.title || '批量分享')}
          </h3>
          <button
            style={{
              ...styles.closeBtn,
              opacity: 1,
              cursor: 'pointer'
            }}
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {step === 'form' && (
            <>
              <div style={{
                fontSize: 13,
                color: theme.textMuted,
                marginBottom: 20,
                padding: '10px 14px',
                background: theme.accent,
                borderRadius: 8,
                border: `1px solid ${theme.border}`
              }}>
                {(bst.selected_count || '已选 {count} 张').replace('{count}', selectedCount)}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block',
                  fontSize: 12,
                  color: theme.textMuted,
                  marginBottom: 8,
                  fontWeight: 500
                }}>
                  {bst.format || '导出格式'}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: format === 'html'
                        ? `1px solid ${theme.primary}`
                        : `1px solid ${theme.border}`,
                      background: format === 'html' ? theme.primary : theme.accent,
                      color: format === 'html' ? '#fff' : theme.text,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontWeight: 500
                    }}
                    onClick={() => setFormat('html')}
                  >
                    {bst.html || '网页 (HTML)'}
                  </button>
                  <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                    <button
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: format === 'pdf'
                          ? `1px solid ${theme.primary}`
                          : `1px solid ${theme.border}`,
                        background: format === 'pdf' ? theme.primary : theme.accent,
                        color: format === 'pdf' ? '#fff' : theme.text,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontWeight: 500
                      }}
                      onClick={() => setFormat('pdf')}
                    >
                      {bst.pdf || 'PDF 文档'}
                    </button>
                  </div>
                </div>
              </div>

              {format === 'pdf' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    color: theme.textMuted,
                    marginBottom: 8,
                    fontWeight: 500
                  }}>
                    {bst.images_per_page || '每页图片数'}
                  </label>
                  <select
                    value={imagesPerPage}
                    onChange={(e) => setImagesPerPage(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: `1px solid ${theme.border}`,
                      background: theme.accent,
                      color: theme.text,
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {IMAGES_PER_PAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 13,
                  borderRadius: 8,
                  border: 'none',
                  background: theme.primary,
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'opacity 0.15s'
                }}
                onClick={handleExport}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {bst.export || '导出'}
              </button>
            </>
          )}

          {step === 'processing' && (
            <div style={{ padding: '8px 0', textAlign: 'center' }}>
              <div style={{
                fontSize: 13,
                color: theme.textMuted,
                marginBottom: 4
              }}>
                {exportStatus || (bst.exporting || '正在生成...')}
              </div>
              {(progressTotal > 0) && (
                <>
                  <ProgressBar theme={theme} current={progressCurrent} total={progressTotal} />
                  <div style={{
                    fontSize: 11,
                    color: theme.textMuted,
                    marginTop: 6
                  }}>
                    {progressCurrent} / {progressTotal}
                  </div>
                </>
              )}
              {progressTotal === 0 && (
                <div style={{
                  marginTop: 16,
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    border: `3px solid ${theme.border}`,
                    borderTopColor: theme.primary,
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                </div>
              )}
            </div>
          )}

          {step === 'completed' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
                padding: '12px 14px',
                background: '#e8f5e9',
                borderRadius: 8,
                color: '#2e7d32',
                fontSize: 13
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span style={{ fontWeight: 500 }}>{bst.export_success || '导出成功'}</span>
              </div>

              <div style={{
                fontSize: 12,
                color: theme.textMuted,
                marginBottom: 4
              }}>
                {(bst.file_path || '文件路径:')}
              </div>
              <div style={{
                fontSize: 11,
                color: theme.text,
                padding: '8px 10px',
                background: theme.accent,
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                wordBreak: 'break-all',
                marginBottom: 20,
                lineHeight: 1.4
              }}>
                {exportedFilePath}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    background: theme.accent,
                    color: theme.text,
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  onClick={handleOpenFolder}
                  onMouseEnter={e => (e.currentTarget.style.background = theme.cardHover || theme.accent)}
                  onMouseLeave={e => (e.currentTarget.style.background = theme.accent)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {(bst.open_folder || '打开文件夹')}
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    borderRadius: 8,
                    border: 'none',
                    background: theme.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  onClick={handleClose}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {t.common?.confirm || '确定'}
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
                padding: '12px 14px',
                background: '#fbe9e7',
                borderRadius: 8,
                color: '#c62828',
                fontSize: 13
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span style={{ fontWeight: 500 }}>{bst.export_failed || '导出失败'}</span>
              </div>
              <div style={{
                fontSize: 12,
                color: theme.textMuted,
                padding: '8px 10px',
                background: theme.accent,
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                wordBreak: 'break-word',
                marginBottom: 20,
                lineHeight: 1.4
              }}>
                {errorMessage}
              </div>
              <button
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: 13,
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  background: theme.accent,
                  color: theme.text,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
                onClick={handleClose}
              >
                {t.common?.confirm || '确定'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
