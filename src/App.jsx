import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'

const themes = {
  night: {
    name: '夜晚',
    colors: {
      bg: '#1a1a2e',
      sidebar: '#16213e',
      card: '#16213e',
      accent: '#0f3460',
      text: '#eee',
      textMuted: '#888',
      primary: '#4ade80',
      danger: '#ef4444',
      border: '#0f3460',
    }
  },
  day: {
    name: '白天',
    colors: {
      bg: '#f5f5f5',
      sidebar: '#ffffff',
      card: '#ffffff',
      accent: '#e8e8e8',
      text: '#333',
      textMuted: '#666',
      primary: '#3b82f6',
      danger: '#ef4444',
      border: '#ddd',
    }
  },
  pink: {
    name: '浅粉',
    colors: {
      bg: '#fce4ec',
      sidebar: '#f8bbd9',
      card: '#ffffff',
      accent: '#f48fb1',
      text: '#4a4a4a',
      textMuted: '#7a7a7a',
      primary: '#ec407a',
      danger: '#e57373',
      border: '#f8bbd9',
    }
  },
  blue: {
    name: '浅蓝',
    colors: {
      bg: '#e3f2fd',
      sidebar: '#bbdefb',
      card: '#ffffff',
      accent: '#90caf9',
      text: '#37474f',
      textMuted: '#607d8b',
      primary: '#2196f3',
      danger: '#ef5350',
      border: '#bbdefb',
    }
  },
  green: {
    name: '浅绿',
    colors: {
      bg: '#e8f5e9',
      sidebar: '#c8e6c9',
      card: '#ffffff',
      accent: '#a5d6a7',
      text: '#2e7d32',
      textMuted: '#558b2f',
      primary: '#4caf50',
      danger: '#ef5350',
      border: '#c8e6c9',
    }
  }
}

function App() {
  const [currentView, setCurrentView] = useState('time')
  const [screenshots, setScreenshots] = useState([])
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState(null)
  const [sortOrder, setSortOrder] = useState('desc')
  const [isLoading, setIsLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState(['应用启动...'])
  const [noteText, setNoteText] = useState('')
  const [currentTheme, setCurrentTheme] = useState('night')
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  // 多选删除相关状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedScreenshots, setSelectedScreenshots] = useState([])
  
  // 文件夹相关状态
  const [storagePath, setStoragePath] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState(0)
  
  // 鼠标捕捉设置
  const [captureMouse, setCaptureMouse] = useState(false)

  const theme = themes[currentTheme].colors
  const gridRef = useRef(null)

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString()
    console.log(`[${time}] ${msg}`)
    setLogs(prev => [...prev.slice(-20), `[${time}] ${msg}`])
  }

  const loadGames = async () => {
    try {
      addLog('调用 get_games')
      const gData = await invoke('get_games')
      addLog(`游戏数据: ${gData ? gData.length : 0} 条`)
      setGames(gData || [])
    } catch (e) {
      addLog(`游戏加载失败: ${e}`)
    }
  }

  const loadStoragePath = async () => {
    try {
      const path = await invoke('get_storage_path')
      setStoragePath(path || '程序目录/screenshot-data/')
    } catch (e) {
      addLog(`获取存储路径失败: ${e}`)
    }
  }

  const loadCaptureMouse = async () => {
    try {
      const enabled = await invoke('get_capture_mouse')
      setCaptureMouse(enabled)
    } catch (e) {
      addLog(`获取鼠标捕捉设置失败: ${e}`)
    }
  }

  const saveCaptureMouse = async (enabled) => {
    try {
      await invoke('set_capture_mouse', { enabled })
      setCaptureMouse(enabled)
      addLog(`鼠标捕捉设置已保存: ${enabled}`)
    } catch (e) {
      addLog(`保存鼠标捕捉设置失败: ${e}`)
    }
  }

  useEffect(() => {
    addLog('useEffect 初始化')
    
    const loadData = async () => {
      addLog('开始加载数据')
      try {
        await loadStoragePath()
        await loadCaptureMouse()
        await loadScreenshotsWithPagination(1, null)
      } catch (e) {
        addLog(`数据加载失败: ${e}`)
        setError('加载数据失败: ' + String(e))
      }
      
      await loadGames()
      
      setIsLoading(false)
      addLog('数据加载完成')
    }
    
    loadData()

    const unlisten = listen('screenshot-taken', () => {
      addLog('收到截图事件，重新加载数据')
      loadScreenshotsWithPagination(1, selectedGame?.game_id || null)
    })

    const unlistenTray = listen('tray-click', async () => {
      addLog('托盘点击事件')
      try {
        await invoke('show_window')
      } catch (e) {
        addLog(`显示窗口失败: ${e}`)
      }
    })

    const unlistenNotify = listen('show-notification', (event) => {
      const { title, body } = event.payload
      addLog(`通知: ${title} - ${body}`)
      setNotification({ title, body })
      setTimeout(() => setNotification(null), 3000)
    })

    const unlistenSettings = listen('navigate-to-settings', () => {
      addLog('导航到设置')
      setCurrentView('settings')
    })

    return () => {
      unlisten.then(f => f())
      unlistenTray.then(f => f())
      unlistenNotify.then(f => f())
      unlistenSettings.then(f => f())
    }
  }, [])

  const loadScreenshotsWithPagination = async (page, gameId = null) => {
    setIsLoading(true)
    try {
      addLog(`调用 get_screenshots_with_pagination, 页码: ${page}, 游戏ID: ${gameId || 'null'}`)
      const data = await invoke('get_screenshots_with_pagination', {
        gameId,
        sortOrder,
        page,
        pageSize
      })
      addLog(`截图数据: ${data.screenshots ? data.screenshots.length : 0} 条, 总页数: ${data.total_pages}`)
      setScreenshots(data.screenshots || [])
      setCurrentPage(page)
      setTotalPages(data.total_pages || 1)
    } catch (e) {
      addLog(`截图加载失败: ${e}`)
      setError('加载截图失败: ' + String(e))
    }
    setIsLoading(false)
  }

  const loadMoreScreenshots = async () => {
    if (isLoadingMore || currentPage >= totalPages) return
    
    setIsLoadingMore(true)
    try {
      addLog(`加载更多截图，页码: ${currentPage + 1}`)
      const data = await invoke('get_screenshots_with_pagination', {
        gameId: selectedGame?.game_id || null,
        sortOrder,
        page: currentPage + 1,
        pageSize
      })
      setScreenshots(prev => [...prev, ...(data.screenshots || [])])
      setCurrentPage(currentPage + 1)
    } catch (e) {
      addLog(`加载更多截图失败: ${e}`)
    }
    setIsLoadingMore(false)
  }

  const toggleSort = async () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(newOrder)
    await loadScreenshotsWithPagination(1, selectedGame?.game_id || null)
  }

  const selectGame = async (game) => {
    setSelectedGame(game)
    setCurrentView('game-detail')
    await loadScreenshotsWithPagination(1, game.game_id)
  }

  const backToGames = async () => {
    setSelectedGame(null)
    setCurrentView('games')
    await loadGames()
    await loadScreenshotsWithPagination(1, null)
  }

  const switchToGames = async () => {
    setCurrentView('games')
    setSelectedGame(null)
    await loadGames()
  }

  const switchToTimeView = async () => {
    setCurrentView('time')
    setSelectedGame(null)
    await loadScreenshotsWithPagination(1, null)
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN')
  }

  const saveNote = async (id, note) => {
    try {
      await invoke('update_note', { id, note })
      addLog(`附注保存成功: ID=${id}`)
      await loadScreenshotsWithPagination(currentPage, selectedGame?.game_id || null)
      setNotification({ title: '保存成功', body: '附注已保存' })
      setTimeout(() => setNotification(null), 2000)
    } catch (e) {
      addLog(`附注保存失败: ${e}`)
      setError('保存附注失败: ' + String(e))
    }
  }

  const deleteScreenshot = async (id) => {
    if (!confirm('确定要删除这张截图吗？')) return
    try {
      await invoke('delete_screenshot', { id })
      addLog(`截图删除成功: ID=${id}`)
      await loadScreenshotsWithPagination(currentPage, selectedGame?.game_id || null)
      setSelectedScreenshot(null)
    } catch (e) {
      addLog(`截图删除失败: ${e}`)
      setError('删除截图失败: ' + String(e))
    }
  }

  const openInExplorer = async (filePath) => {
    try {
      await invoke('open_in_explorer', { filePath })
      addLog(`打开文件夹: ${filePath}`)
    } catch (e) {
      addLog(`打开文件夹失败: ${e}`)
      setError('打开文件夹失败: ' + String(e))
    }
  }

  const deleteSelectedScreenshots = async () => {
    if (selectedScreenshots.length === 0) return
    
    if (!confirm(`确定要删除 ${selectedScreenshots.length} 张截图吗？`)) return
    
    try {
      await invoke('delete_screenshots', { ids: selectedScreenshots })
      addLog(`批量删除成功: ${selectedScreenshots.length} 张`)
      await loadScreenshotsWithPagination(currentPage, selectedGame?.game_id || null)
      setIsMultiSelectMode(false)
      setSelectedScreenshots([])
      setNotification({ title: '删除成功', body: `已删除 ${selectedScreenshots.length} 张截图` })
      setTimeout(() => setNotification(null), 2000)
    } catch (e) {
      addLog(`批量删除失败: ${e}`)
      setError('批量删除失败: ' + String(e))
    }
  }

  const toggleSelectScreenshot = (id) => {
    setSelectedScreenshots(prev => {
      if (prev.includes(id)) {
        return prev.filter(sid => sid !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const changeStoragePath = async () => {
    try {
      // 使用简单的 prompt 暂时替代 dialog
      const newPath = prompt('请输入新的存储目录路径:');
      
      if (newPath) {
        setIsMigrating(true)
        setMigrationProgress(0)
        
        addLog(`开始迁移数据到: ${newPath}`)
        const result = await invoke('migrate_data', { newPath })
        
        if (result.success) {
          setStoragePath(newPath)
          setNotification({ title: '迁移成功', body: '数据已成功迁移到新目录' })
          await loadScreenshotsWithPagination(1, selectedGame?.game_id || null)
          await loadGames()
        } else {
          setError('迁移失败: ' + (result.error || '未知错误'))
        }
      }
    } catch (e) {
      addLog(`更改存储路径失败: ${e}`)
      setError('更改存储路径失败: ' + String(e))
    } finally {
      setIsMigrating(false)
      setMigrationProgress(0)
    }
  }

  const getImageSrc = (filePath) => {
    try {
      return convertFileSrc(filePath)
    } catch (e) {
      addLog(`图片路径转换失败: ${e}`)
      return ''
    }
  }

  const handleScroll = () => {
    if (!gridRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = gridRef.current
    const threshold = 100
    
    if (scrollHeight - scrollTop - clientHeight < threshold && !isLoadingMore && currentPage < totalPages) {
      loadMoreScreenshots()
    }
  }

  const styles = {
    container: { display: 'flex', height: '100vh', background: theme.bg, color: theme.text, fontFamily: 'system-ui, sans-serif' },
    sidebar: { width: 200, background: theme.sidebar, padding: 16, display: 'flex', flexDirection: 'column' },
    sidebarTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 24, color: theme.primary },
    navItem: { padding: '12px 16px', cursor: 'pointer', borderRadius: 8, marginBottom: 4, transition: 'background 0.2s' },
    navItemActive: { background: theme.accent },
    main: { flex: 1, padding: 24, overflow: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 'bold' },
    btn: { padding: '8px 16px', background: theme.accent, border: 'none', borderRadius: 6, color: theme.text, cursor: 'pointer' },
    btnPrimary: { padding: '8px 16px', background: theme.primary, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 'bold' },
    btnDanger: { padding: '8px 16px', background: theme.danger, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' },
    btnDisabled: { padding: '8px 16px', background: theme.accent, border: 'none', borderRadius: 6, color: theme.textMuted, cursor: 'not-allowed', opacity: 0.6 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
    card: { background: theme.card, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' },
    cardImage: { width: '100%', height: 150, objectFit: 'cover', background: theme.accent },
    cardInfo: { padding: 12 },
    cardTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    cardDate: { fontSize: 12, color: theme.textMuted },
    gameCard: { background: theme.card, borderRadius: 8, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s' },
    gameIcon: { width: 80, height: 80, borderRadius: 12, background: theme.accent, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden' },
    gameIconImage: { width: '100%', height: '100%', objectFit: 'cover' },
    gameTitle: { fontWeight: 'bold', marginBottom: 4 },
    gameCount: { fontSize: 12, color: theme.textMuted },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: theme.card, borderRadius: 12, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' },
    modalHeader: { padding: 16, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalBody: { padding: 16 },
    modalFooter: { padding: 16, borderTop: `1px solid ${theme.border}` },
    input: { width: '100%', padding: 8, background: theme.accent, border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.text, boxSizing: 'border-box' },
    notification: { position: 'fixed', top: 16, right: 16, background: theme.primary, color: '#fff', padding: '12px 24px', borderRadius: 8, zIndex: 2000, fontWeight: 'bold' },
    debugPanel: { marginTop: 'auto', padding: 8, background: theme.accent, borderRadius: 4, fontSize: 10, maxHeight: 100, overflow: 'auto' },
    debugLine: { color: theme.primary, marginBottom: 2 },
    empty: { textAlign: 'center', padding: 48, color: theme.textMuted },
    loading: { textAlign: 'center', padding: 48, color: theme.primary },
    themeBtn: { padding: '10px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.2s' },
    themeBtnActive: { transform: 'scale(1.05)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
    pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 16, background: theme.card, borderRadius: 8 },
    paginationBtn: { padding: '6px 12px', background: theme.accent, border: 'none', borderRadius: 4, color: theme.text, cursor: 'pointer' },
    paginationBtnActive: { background: theme.primary, color: '#fff' },
    paginationInfo: { fontSize: 14, color: theme.textMuted },
    selectCheckbox: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, border: `2px solid ${theme.border}`, borderRadius: 3, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    selectCheckboxChecked: { background: theme.primary, borderColor: theme.primary },
    selectCheckboxInner: { width: 8, height: 8, background: '#fff' },
    cardWithCheckbox: { position: 'relative' },
    cardSelected: { transform: 'scale(0.98)', boxShadow: `0 0 0 2px ${theme.primary}` },
    migrationProgress: { width: '100%', height: 8, background: theme.accent, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
    migrationProgressBar: { height: '100%', background: theme.primary, transition: 'width 0.3s ease' },
  }

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <div style={styles.sidebarTitle}>截图管理器</div>
        
        <div 
          style={{ ...styles.navItem, ...(currentView === 'time' ? styles.navItemActive : {}) }}
          onClick={switchToTimeView}
        >
          按时间浏览
        </div>
        <div 
          style={{ ...styles.navItem, ...(currentView === 'games' || currentView === 'game-detail' ? styles.navItemActive : {}) }}
          onClick={switchToGames}
        >
          按游戏浏览
        </div>
        <div 
          style={{ ...styles.navItem, ...(currentView === 'settings' ? styles.navItemActive : {}) }}
          onClick={() => setCurrentView('settings')}
        >
          设置
        </div>

        <div style={styles.debugPanel}>
          {logs.slice(-5).map((log, i) => (
            <div key={i} style={styles.debugLine}>{log}</div>
          ))}
        </div>
      </nav>

      <main style={styles.main} ref={gridRef} onScroll={handleScroll}>
        {notification && (
          <div style={styles.notification}>
            {notification.title}: {notification.body}
          </div>
        )}

        {isLoading ? (
          <div style={styles.loading}>加载中...</div>
        ) : currentView === 'time' ? (
          <div>
            <div style={styles.header}>
              <h1 style={styles.title}>按时间浏览</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isMultiSelectMode ? (
                  <>
                    <button style={styles.btn} onClick={() => {
                      setIsMultiSelectMode(false)
                      setSelectedScreenshots([])
                    }}>
                      取消选定
                    </button>
                    <button 
                      style={selectedScreenshots.length > 0 ? styles.btnDanger : styles.btnDisabled}
                      onClick={deleteSelectedScreenshots}
                      disabled={selectedScreenshots.length === 0}
                    >
                      确定删除 ({selectedScreenshots.length})
                    </button>
                  </>
                ) : (
                  <>
                    <button style={styles.btn} onClick={toggleSort}>
                      排序: {sortOrder === 'desc' ? '从新到旧' : '从旧到新'}
                    </button>
                    <button style={styles.btn} onClick={() => setIsMultiSelectMode(true)}>
                      多选删除
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {screenshots.length === 0 ? (
              <div style={styles.empty}>
                <p>还没有截图</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>按 PrintScreen 或 F12 进行截图</p>
              </div>
            ) : (
              <>
                <div style={styles.grid}>
                  {screenshots.map(ss => (
                    <div 
                      key={ss.id} 
                      style={{ 
                        ...styles.card, 
                        ...(isMultiSelectMode ? styles.cardWithCheckbox : {}),
                        ...(isMultiSelectMode && selectedScreenshots.includes(ss.id) ? styles.cardSelected : {})
                      }}
                      onClick={() => {
                        if (isMultiSelectMode) {
                          toggleSelectScreenshot(ss.id)
                        } else {
                          setSelectedScreenshot(ss)
                          setNoteText(ss.note || '')
                        }
                      }}
                    >
                      {isMultiSelectMode && (
                        <div style={{
                          ...styles.selectCheckbox,
                          ...(selectedScreenshots.includes(ss.id) ? styles.selectCheckboxChecked : {})
                        }}>
                          {selectedScreenshots.includes(ss.id) && (
                            <div style={styles.selectCheckboxInner} />
                          )}
                        </div>
                      )}
                      <img 
                        src={getImageSrc(ss.thumbnail_path)} 
                        alt="截图缩略图" 
                        style={styles.cardImage}
                        onError={(e) => { e.target.style.background = theme.accent; e.target.style.display = 'none'; }}
                        loading="lazy"
                      />
                      <div style={styles.cardInfo}>
                        <div style={styles.cardTitle}>{ss.display_title || ss.game_title}</div>
                        <div style={styles.cardDate}>{formatDate(ss.timestamp)}</div>
                        {ss.note && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ss.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {isLoadingMore && (
                  <div style={styles.loading}>加载更多...</div>
                )}
                
                <div style={styles.pagination}>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(1, null)}
                    disabled={currentPage === 1}
                  >
                    首页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(Math.max(1, currentPage - 1), null)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span style={styles.paginationInfo}>
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(Math.min(totalPages, currentPage + 1), null)}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(totalPages, null)}
                    disabled={currentPage === totalPages}
                  >
                    末页
                  </button>
                </div>
              </>
            )}
          </div>
        ) : currentView === 'games' ? (
          <div>
            <div style={styles.header}>
              <h1 style={styles.title}>按游戏浏览</h1>
            </div>
            
            {games.length === 0 ? (
              <div style={styles.empty}>
                <p>还没有游戏记录</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>截图后会自动识别游戏</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {games.map(game => (
                  <div key={game.game_id} style={styles.gameCard} onClick={() => selectGame(game)}>
                    <div style={styles.gameIcon}>
                      {game.game_icon_path ? (
                        <img 
                          src={getImageSrc(game.game_icon_path)} 
                          alt={`${game.display_title || game.game_title} 图标`}
                          style={styles.gameIconImage}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?';
                          }}
                        />
                      ) : (
                        game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?'
                      )}
                    </div>
                    <div style={styles.gameTitle}>{game.display_title || game.game_title}</div>
                    <div style={styles.gameCount}>{game.count} 张截图</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                      最后更新于: {formatDate(game.last_timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : currentView === 'game-detail' ? (
          <div>
            <div style={styles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectedGame?.game_icon_path ? (
                  <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden' }}>
                    <img 
                      src={getImageSrc(selectedGame.game_icon_path)} 
                      alt={`${selectedGame.display_title || selectedGame.game_title} 图标`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                ) : null}
                <h1 style={styles.title}>{selectedGame?.display_title || selectedGame?.game_title}</h1>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isMultiSelectMode ? (
                  <>
                    <button style={styles.btn} onClick={() => {
                      setIsMultiSelectMode(false)
                      setSelectedScreenshots([])
                    }}>
                      取消选定
                    </button>
                    <button 
                      style={selectedScreenshots.length > 0 ? styles.btnDanger : styles.btnDisabled}
                      onClick={deleteSelectedScreenshots}
                      disabled={selectedScreenshots.length === 0}
                    >
                      确定删除 ({selectedScreenshots.length})
                    </button>
                    <button style={styles.btn} onClick={backToGames}>
                      返回游戏列表
                    </button>
                  </>
                ) : (
                  <>
                    <button style={styles.btn} onClick={() => setIsMultiSelectMode(true)}>
                      多选删除
                    </button>
                    <button style={styles.btn} onClick={backToGames}>
                      返回游戏列表
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {screenshots.length === 0 ? (
              <div style={styles.empty}>该游戏没有截图</div>
            ) : (
              <>
                <div style={styles.grid}>
                  {screenshots.map(ss => (
                    <div 
                      key={ss.id} 
                      style={{ 
                        ...styles.card, 
                        ...(isMultiSelectMode ? styles.cardWithCheckbox : {}),
                        ...(isMultiSelectMode && selectedScreenshots.includes(ss.id) ? styles.cardSelected : {})
                      }}
                      onClick={() => {
                        if (isMultiSelectMode) {
                          toggleSelectScreenshot(ss.id)
                        } else {
                          setSelectedScreenshot(ss)
                          setNoteText(ss.note || '')
                        }
                      }}
                    >
                      {isMultiSelectMode && (
                        <div style={{
                          ...styles.selectCheckbox,
                          ...(selectedScreenshots.includes(ss.id) ? styles.selectCheckboxChecked : {})
                        }}>
                          {selectedScreenshots.includes(ss.id) && (
                            <div style={styles.selectCheckboxInner} />
                          )}
                        </div>
                      )}
                      <img 
                        src={getImageSrc(ss.thumbnail_path)} 
                        alt="截图缩略图" 
                        style={styles.cardImage}
                        onError={(e) => { e.target.style.background = theme.accent; e.target.style.display = 'none'; }}
                        loading="lazy"
                      />
                      <div style={styles.cardInfo}>
                        <div style={styles.cardDate}>{formatDate(ss.timestamp)}</div>
                        {ss.note && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{ss.note.slice(0, 30)}...</div>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {isLoadingMore && (
                  <div style={styles.loading}>加载更多...</div>
                )}
                
                <div style={styles.pagination}>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(1, selectedGame?.game_id)}
                    disabled={currentPage === 1}
                  >
                    首页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(Math.max(1, currentPage - 1), selectedGame?.game_id)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span style={styles.paginationInfo}>
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(Math.min(totalPages, currentPage + 1), selectedGame?.game_id)}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    onClick={() => loadScreenshotsWithPagination(totalPages, selectedGame?.game_id)}
                    disabled={currentPage === totalPages}
                  >
                    末页
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <h1 style={styles.title}>设置</h1>
            <div style={{ marginTop: 24 }}>
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>主题</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(themes).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setCurrentTheme(key)}
                      style={{
                        ...styles.themeBtn,
                        ...(currentTheme === key ? styles.themeBtnActive : {}),
                        background: t.colors.primary,
                        color: key === 'night' ? '#fff' : '#333',
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>存储位置</h3>
                <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
                  当前存储位置: {storagePath}
                </p>
                <button 
                  style={styles.btnPrimary} 
                  onClick={changeStoragePath}
                  disabled={isMigrating}
                >
                  {isMigrating ? '迁移中...' : '更改存储位置'}
                </button>
                {isMigrating && (
                  <div style={styles.migrationProgress}>
                    <div 
                      style={{
                        ...styles.migrationProgressBar,
                        width: `${migrationProgress}%`
                      }}
                    />
                  </div>
                )}
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  数据库和截图在同一目录，可直接复制整个文件夹到其他电脑使用
                </p>
              </div>
              
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>快捷键</h3>
                <p style={{ color: theme.textMuted, fontSize: 14 }}>PrintScreen - 截图</p>
                <p style={{ color: theme.textMuted, fontSize: 14 }}>F12 - 测试截图（调试模式）</p>
              </div>

              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>截图选项</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    id="captureMouse"
                    checked={captureMouse}
                    onChange={(e) => saveCaptureMouse(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="captureMouse" style={{ cursor: 'pointer', color: theme.text }}>
                    捕捉鼠标光标
                  </label>
                </div>
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  启用后，截图时会包含鼠标光标
                </p>
              </div>

              <div style={{ background: theme.card, padding: 16, borderRadius: 8 }}>
                <h3 style={{ marginBottom: 12 }}>关于</h3>
                <p style={{ color: theme.textMuted, fontSize: 14 }}>极简游戏截图管理器 v0.1.0</p>
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>Rust + Tauri + React</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedScreenshot && (
        <div style={styles.modal} onClick={() => setSelectedScreenshot(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>{formatDate(selectedScreenshot.timestamp)}</h3>
              <button style={styles.btn} onClick={() => setSelectedScreenshot(null)}>关闭</button>
            </div>
            <div style={styles.modalBody}>
              <img src={getImageSrc(selectedScreenshot.file_path)} alt="截图" style={{ width: '100%', maxWidth: 800 }} />
            </div>
            <div style={styles.modalFooter}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: theme.textMuted }}>附注 (最多120字)</label>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  maxLength={120}
                  style={{ ...styles.input, height: 60, resize: 'none' }}
                  placeholder="写下你的感悟..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: theme.textMuted }}>游戏: {selectedScreenshot.display_title || selectedScreenshot.game_title}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={styles.btnPrimary} onClick={() => saveNote(selectedScreenshot.id, noteText)}>保存附注</button>
                  <button style={styles.btn} onClick={() => openInExplorer(selectedScreenshot.file_path)}>打开文件夹</button>
                  <button style={styles.btnDanger} onClick={() => deleteScreenshot(selectedScreenshot.id)}>删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
